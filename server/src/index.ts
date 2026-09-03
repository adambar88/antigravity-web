import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';

import { getDatabase } from './db/index.js';
import { authGuard } from './security/authGuard.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { sessionRoutes } from './routes/sessions.js';
import { workspaceRoutes } from './routes/workspace.js';
import { processRegistry } from './agent/processGroup.js';

dotenv.config();

const PORT = parseInt(process.env.PORT || '3333', 10);
const HOST = process.env.HOST || '0.0.0.0';

export async function buildServer() {
  const server = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
    },
  });

  // 1. Initialize SQLite Database
  getDatabase();

  // 2. CORS plugin
  await server.register(cors, {
    origin: true,
    credentials: true,
  });

  // 3. Cookie plugin
  await server.register(cookie, {
    secret: process.env.COOKIE_SECRET || 'ag-session-secret-key-2025',
  });

  // 4. Authentication Guard PreHandler
  server.addHook('preHandler', authGuard);

  // 5. Register REST & SSE Routes
  await server.register(healthRoutes);
  await server.register(authRoutes);
  await server.register(sessionRoutes);
  await server.register(workspaceRoutes);

  // 6. Serve static client build if available
  const candidateClientDirs = [
    path.resolve(process.cwd(), '../client/dist'),
    path.resolve(process.cwd(), 'client/dist'),
    path.resolve(process.cwd(), 'public'),
  ];

  const clientDist = candidateClientDirs.find((dir) => fs.existsSync(dir));

  if (clientDist) {
    server.log.info(`[Static] Serving client assets from: ${clientDist}`);
    await server.register(fastifyStatic, {
      root: clientDist,
      prefix: '/',
      wildcard: false,
    });

    // SPA fallback: non-API routes fallback to client index.html
    server.setNotFoundHandler((request, reply) => {
      const url = request.raw.url || '';
      if (!url.startsWith('/api') && !url.startsWith('/health')) {
        const indexPath = path.join(clientDist, 'index.html');
        if (fs.existsSync(indexPath)) {
          return reply.sendFile('index.html');
        }
      }
      return reply.status(404).send({
        error: 'Not Found',
        message: `Route ${url} not found`,
      });
    });
  }

  return server;
}

async function start() {
  try {
    const server = await buildServer();

    // Graceful shutdown handling
    const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
    for (const signal of signals) {
      process.on(signal, async () => {
        server.log.info(`Received ${signal}. Gracefully shutting down...`);
        try {
          await server.close();
          const db = getDatabase();
          db.close();
          server.log.info('Server and database closed. Bye!');
          process.exit(0);
        } catch (err) {
          server.log.error(err, 'Error during graceful shutdown');
          process.exit(1);
        }
      });
    }

    await server.listen({ port: PORT, host: HOST });
    console.log(`🚀 Antigravity Web backend running on http://${HOST}:${PORT}`);
  } catch (err) {
    console.error('Fatal startup error:', err);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  start();
}
