import type { FastifyPluginAsync } from 'fastify';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
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
import { getSubagentsForSession, getSubagentDetails } from '../agent/subagentTracker.js';
import { getDefaultWorkspaceRoot } from '../security/workspaceGuard.js';
import type {
  ReasoningEffort,
  Session,
  SessionSummary,
  HydratedSession,
  AttachmentPayload,
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

const AttachmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  mimeType: z.string(),
  size: z.number(),
  dataUrl: z.string().optional(),
  filePath: z.string().optional(),
});

const PromptSchema = z.object({
  prompt: z.string().min(1, 'Prompt cannot be empty'),
  model: z.string().optional(),
  effort: z.enum(['low', 'medium', 'high']).optional(),
  attachments: z.array(AttachmentSchema).optional(),
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
  fastify.post<{ Params: { id: string } }>(
    '/api/sessions/:id/prompt',
    { bodyLimit: 30 * 1024 * 1024 },
    async (req, reply) => {
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

      const { prompt, model, effort, attachments } = parseResult.data;

      // Ingest attachments if present with dataUrl
      if (attachments && attachments.length > 0) {
        const attachmentsDir = path.join(session.workspace_path, '.antigravity', 'attachments');
        if (!fs.existsSync(attachmentsDir)) {
          fs.mkdirSync(attachmentsDir, { recursive: true });
        }

        for (const att of attachments) {
          if (att.dataUrl) {
            const sanitized = path.basename(att.name).replace(/[^a-zA-Z0-9._-]/g, '_');
            const storageName = `${Date.now()}_${crypto.randomUUID().slice(0, 8)}_${sanitized}`;
            const absolutePath = path.join(attachmentsDir, storageName);

            const base64Data = att.dataUrl.includes(';base64,')
              ? att.dataUrl.split(';base64,')[1]
              : att.dataUrl;
            const buffer = Buffer.from(base64Data, 'base64');
            fs.writeFileSync(absolutePath, buffer);

            att.filePath = absolutePath;
            delete att.dataUrl;
          }
        }
      }

      // Launch the agent turn asynchronously
      runAgentTurn({
        sessionId: id,
        prompt,
        model,
        effort: effort as ReasoningEffort | undefined,
        attachments,
      }).catch((err) => {
        console.error(`[AgentTurnError:${id}]`, err);
      });

      return reply.status(202).send({
        accepted: true,
        session_id: id,
      });
    }
  );

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

  // GET /api/sessions/:id/subagents
  fastify.get<{ Params: { id: string } }>('/api/sessions/:id/subagents', async (req, reply) => {
    const { id } = req.params;
    const session = getSession(id);

    if (!session) {
      return reply.status(404).send({
        error: 'Not Found',
        message: `Session ${id} not found`,
      });
    }

    const subagents = getSubagentsForSession(id);
    return reply.status(200).send({ subagents });
  });

  // GET /api/sessions/:id/subagents/:subagentId
  fastify.get<{ Params: { id: string; subagentId: string } }>(
    '/api/sessions/:id/subagents/:subagentId',
    async (req, reply) => {
      const { id, subagentId } = req.params;
      const session = getSession(id);

      if (!session) {
        return reply.status(404).send({
          error: 'Not Found',
          message: `Session ${id} not found`,
        });
      }

      const details = getSubagentDetails(id, subagentId);
      if (!details) {
        return reply.status(404).send({
          error: 'Not Found',
          message: `Subagent ${subagentId} not found in session ${id}`,
        });
      }

      return reply.status(200).send(details);
    }
  );

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

    // Send initial subagents list if available
    try {
      const existingSubs = getSubagentsForSession(id);
      if (existingSubs.length > 0) {
        const subEnv = {
          seq: sessionEventHub.getNextSeq(id),
          session_id: id,
          timestamp: Date.now(),
          type: 'subagent_update',
          payload: { subagents: existingSubs },
        };
        rawRes.write(
          `id: ${subEnv.seq}\nevent: subagent_update\ndata: ${JSON.stringify(subEnv)}\n\n`
        );
      }
    } catch {
      // non-fatal
    }

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
