import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  listSessions,
  createSession,
  getSession,
  getSessionWithHistory,
  updateSession,
  deleteSession,
  updateSessionStatus,
} from '../db/index.js';
import { processRegistry } from '../agent/processGroup.js';
import { runAgentTurn, sessionEventHub } from '../agent/protocolTranslator.js';
import { getDefaultWorkspaceRoot } from '../security/workspaceGuard.js';
import type {
  ReasoningEffort,
  Session,
  SessionSummary,
  HydratedSession,
} from '../types/contract.js';

const CreateSessionSchema = z.object({
  title: z.string().optional(),
  workspace_path: z.string().optional(),
  model: z.string().optional(),
  effort: z.enum(['low', 'medium', 'high']).optional(),
});

const UpdateSessionSchema = z.object({
  title: z.string().optional(),
  workspace_path: z.string().optional(),
  model: z.string().optional(),
  effort: z.enum(['low', 'medium', 'high']).optional(),
});

const PromptSchema = z.object({
  prompt: z.string().min(1, 'Prompt cannot be empty'),
  model: z.string().optional(),
  effort: z.enum(['low', 'medium', 'high']).optional(),
});

export const sessionRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/sessions
  fastify.get('/api/sessions', async (_req, reply) => {
    const sessions = listSessions();
    return reply.status(200).send(sessions);
  });

  // POST /api/sessions
  fastify.post('/api/sessions', async (req, reply) => {
    const parseResult = CreateSessionSchema.safeParse(req.body || {});
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Bad Request',
        details: parseResult.error.flatten(),
      });
    }

    const { title, workspace_path, model, effort } = parseResult.data;
    const session = createSession({
      title: title || 'New Chat Session',
      workspace_path: workspace_path || getDefaultWorkspaceRoot(),
      model: model || 'gemini-3.8-flash-medium',
      effort: (effort as ReasoningEffort) || 'medium',
    });

    return reply.status(201).send(session);
  });

  // GET /api/sessions/:id
  fastify.get<{ Params: { id: string } }>('/api/sessions/:id', async (req, reply) => {
    const { id } = req.params;
    const hydrated = getSessionWithHistory(id);

    if (!hydrated) {
      return reply.status(404).send({
        error: 'Not Found',
        message: `Session ${id} not found`,
      });
    }

    return reply.status(200).send(hydrated);
  });

  // PATCH /api/sessions/:id
  fastify.patch<{ Params: { id: string } }>('/api/sessions/:id', async (req, reply) => {
    const { id } = req.params;
    const parseResult = UpdateSessionSchema.safeParse(req.body || {});
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Bad Request',
        details: parseResult.error.flatten(),
      });
    }

    const updated = updateSession(id, parseResult.data);
    if (!updated) {
      return reply.status(404).send({
        error: 'Not Found',
        message: `Session ${id} not found`,
      });
    }

    return reply.status(200).send(updated);
  });

  // DELETE /api/sessions/:id
  fastify.delete<{ Params: { id: string } }>('/api/sessions/:id', async (req, reply) => {
    const { id } = req.params;

    // Terminate any active process first
    await processRegistry.cancel(id);

    const deleted = deleteSession(id);
    if (!deleted) {
      return reply.status(404).send({
        error: 'Not Found',
        message: `Session ${id} not found`,
      });
    }

    return reply.status(200).send({ success: true });
  });

  // POST /api/sessions/:id/prompt
  fastify.post<{ Params: { id: string } }>('/api/sessions/:id/prompt', async (req, reply) => {
    const { id } = req.params;
    const session = getSession(id);

    if (!session) {
      return reply.status(404).send({
        error: 'Not Found',
        message: `Session ${id} not found`,
      });
    }

    const parseResult = PromptSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Bad Request',
        details: parseResult.error.flatten(),
      });
    }

    const { prompt, model, effort } = parseResult.data;

    // Launch the agent turn asynchronously
    runAgentTurn({
      sessionId: id,
      prompt,
      model,
      effort: effort as ReasoningEffort | undefined,
    }).catch((err) => {
      console.error(`[AgentTurnError:${id}]`, err);
    });

    return reply.status(202).send({
      accepted: true,
      session_id: id,
    });
  });

  // POST /api/sessions/:id/cancel
  fastify.post<{ Params: { id: string } }>('/api/sessions/:id/cancel', async (req, reply) => {
    const { id } = req.params;
    const session = getSession(id);

    if (!session) {
      return reply.status(404).send({
        error: 'Not Found',
        message: `Session ${id} not found`,
      });
    }

    const cancelled = await processRegistry.cancel(id);
    updateSessionStatus(id, 'aborted');
    sessionEventHub.broadcast(id, 'session_status', { status: 'aborted' });

    return reply.status(200).send({
      success: true,
      cancelled,
      message: cancelled ? 'Agent process cancelled' : 'Session marked as aborted',
    });
  });

  // GET /api/sessions/:id/stream (SSE)
  fastify.get<{ Params: { id: string } }>('/api/sessions/:id/stream', async (req, reply) => {
    const { id } = req.params;
    const session = getSession(id);

    if (!session) {
      return reply.status(404).send({
        error: 'Not Found',
        message: `Session ${id} not found`,
      });
    }

    // Hijack the underlying raw socket for SSE streaming
    reply.hijack();
    const rawRes = reply.raw;

    rawRes.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    // Send initial status event immediately
    const initialStatusEnvelope = {
      seq: sessionEventHub.getNextSeq(id),
      session_id: id,
      timestamp: Date.now(),
      type: 'session_status',
      payload: { status: session.status },
    };
    rawRes.write(
      `id: ${initialStatusEnvelope.seq}\nevent: session_status\ndata: ${JSON.stringify(
        initialStatusEnvelope
      )}\n\n`
    );

    // Heartbeat every 15s to keep proxy connections alive
    const heartbeatInterval = setInterval(() => {
      if (!rawRes.writableEnded) {
        rawRes.write(': keep-alive\n\n');
      }
    }, 15000);

    // Subscribe to session events
    const unsubscribe = sessionEventHub.subscribe(id, (_envelope, rawData) => {
      if (!rawRes.writableEnded) {
        rawRes.write(rawData);
      }
    });

    // Clean up on client disconnect
    req.raw.on('close', () => {
      clearInterval(heartbeatInterval);
      unsubscribe();
    });

    rawRes.on('error', () => {
      clearInterval(heartbeatInterval);
      unsubscribe();
    });
  });
};
