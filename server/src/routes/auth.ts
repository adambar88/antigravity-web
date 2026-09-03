import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { validateToken, setAuthCookie, clearAuthCookie } from '../security/authGuard.js';
import { getDefaultWorkspaceRoot } from '../security/workspaceGuard.js';
import { getSetting } from '../db/index.js';
import type { AuthLoginResponse, AuthMeResponse } from '../types/contract.js';

const LoginSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/api/auth/login', async (request, reply) => {
    const parseResult = LoginSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        message: 'Invalid request body: token is required',
      });
    }

    const { token } = parseResult.data;
    const isValid = validateToken(token);

    if (!isValid) {
      return reply.status(401).send({
        success: false,
        message: 'Invalid credentials or token',
      } satisfies AuthLoginResponse);
    }

    setAuthCookie(reply, token);

    return reply.status(200).send({
      success: true,
      message: 'Authentication successful',
    } satisfies AuthLoginResponse);
  });

  fastify.get('/api/auth/me', async (_request, reply) => {
    const defaultModel = getSetting('default_model') || 'gemini-3.8-flash-medium';
    const workspaceRoot = getDefaultWorkspaceRoot();

    const response: AuthMeResponse = {
      authenticated: true,
      workspace_root: workspaceRoot,
      default_model: defaultModel,
      version: '1.0.0',
    };

    return reply.status(200).send(response);
  });

  fastify.post('/api/auth/logout', async (_request, reply) => {
    clearAuthCookie(reply);
    return reply.status(200).send({
      success: true,
      message: 'Logged out successfully',
    });
  });
};
