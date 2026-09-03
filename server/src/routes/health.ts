import type { FastifyPluginAsync } from 'fastify';
import { processRegistry } from '../agent/processGroup.js';
import type { HealthResponse } from '../types/contract.js';

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/health', async (_req, reply) => {
    const response: HealthResponse = {
      status: 'ok',
      version: '1.0.0',
      uptime_seconds: Math.floor(process.uptime()),
      wal_mode: true,
      active_sessions: processRegistry.count(),
      timestamp: Date.now(),
    };
    return reply.status(200).send(response);
  });
};
