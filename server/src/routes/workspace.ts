import type { FastifyPluginAsync } from 'fastify';
import {
  getWorkspaceTree,
  readWorkspaceFile,
  getDefaultWorkspaceRoot,
  listWorkspaceDirectories,
  WorkspaceSecurityError,
} from '../security/workspaceGuard.js';
import type { WorkspaceTreeResponse, WorkspaceFileResponse } from '../types/contract.js';

export const workspaceRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/workspace/directories
  fastify.get<{
    Querystring: { path?: string };
  }>('/api/workspace/directories', async (req, reply) => {
    const basePath = req.query.path || '/home/adam';
    const dirs = await listWorkspaceDirectories(basePath);
    return reply.status(200).send({
      base: basePath,
      directories: dirs,
      common: [
        { name: 'Katalog domowy (~/)', path: '/home/adam' },
        { name: 'my-domain', path: '/home/adam/projects/my-domain' },
        { name: 'minesweeper-repo', path: '/home/adam/projects/minesweeper-repo' },
        { name: 'projects', path: '/home/adam/projects' },
      ],
    });
  });
  // GET /api/workspace/tree
  fastify.get<{
    Querystring: { depth?: string; root?: string };
  }>('/api/workspace/tree', async (req, reply) => {
    const depth = req.query.depth ? parseInt(req.query.depth, 10) : 4;
    const root = req.query.root || getDefaultWorkspaceRoot();

    try {
      const tree = await getWorkspaceTree(root, isNaN(depth) ? 4 : depth);
      const response: WorkspaceTreeResponse = {
        root,
        tree,
      };
      return reply.status(200).send(response);
    } catch (err: any) {
      if (err instanceof WorkspaceSecurityError) {
        return reply.status(err.statusCode).send({
          error: 'Forbidden',
          message: err.message,
        });
      }
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: err.message || 'Failed to inspect workspace tree',
      });
    }
  });

  // GET /api/workspace/file
  fastify.get<{
    Querystring: { path?: string; root?: string };
  }>('/api/workspace/file', async (req, reply) => {
    const filePath = req.query.path;
    if (!filePath || typeof filePath !== 'string') {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Query parameter "path" is required',
      });
    }

    const root = req.query.root || getDefaultWorkspaceRoot();

    try {
      const fileData: WorkspaceFileResponse = await readWorkspaceFile(root, filePath);
      return reply.status(200).send(fileData);
    } catch (err: any) {
      if (err instanceof WorkspaceSecurityError) {
        return reply.status(err.statusCode).send({
          error: 'Forbidden',
          message: err.message,
        });
      }
      if (err.code === 'ENOENT') {
        return reply.status(404).send({
          error: 'Not Found',
          message: `File not found: ${filePath}`,
        });
      }
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: err.message || 'Failed to read workspace file',
      });
    }
  });
};
