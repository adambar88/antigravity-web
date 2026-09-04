import fs from 'node:fs';
import path from 'node:path';
import type { FastifyPluginAsync } from 'fastify';
import {
  WorkspaceSecurityError,
  getDefaultWorkspaceRoot,
  getFileCategoryAndMime,
  getWorkspaceDirectoryChildren,
  getWorkspaceTree,
  listWorkspaceDirectories,
  readWorkspaceFile,
  resolveWorkspacePath,
} from '../security/workspaceGuard.js';
import { collectWorkspaceGitDiffs } from '../agent/slashCommands.js';
import type { WorkspaceFileResponse, WorkspaceTreeResponse, WorkspaceDirectoriesResponse } from '../types/contract.js';

export const workspaceRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/workspace/directories
  fastify.get<{
    Querystring: { path?: string };
  }>('/api/workspace/directories', async (req, reply) => {
    const requestedPath = req.query.path || '/home/adam';
    const basePath = fs.existsSync(requestedPath) ? requestedPath : getDefaultWorkspaceRoot();
    const dirs = await listWorkspaceDirectories(basePath);
    const parent = basePath !== '/' ? path.dirname(basePath) : null;
    const response: WorkspaceDirectoriesResponse = {
      base: basePath,
      parent,
      directories: dirs,
      common: [
        { name: 'Katalog domowy (~/)', path: '/home/adam' },
        { name: 'my-domain', path: '/home/adam/projects/my-domain' },
        { name: 'minesweeper-repo', path: '/home/adam/projects/minesweeper-repo' },
        { name: 'projects', path: '/home/adam/projects' },
      ],
    };
    return reply.status(200).send(response);
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

  // GET /api/workspace/children (drill down into any deep folder)
  fastify.get<{
    Querystring: { path?: string; root?: string };
  }>('/api/workspace/children', async (req, reply) => {
    const dirPath = req.query.path || '';
    const root = req.query.root || getDefaultWorkspaceRoot();

    try {
      const children = await getWorkspaceDirectoryChildren(root, dirPath);
      return reply.status(200).send({
        root,
        path: dirPath,
        children,
      });
    } catch (err: any) {
      if (err instanceof WorkspaceSecurityError) {
        return reply.status(err.statusCode).send({
          error: 'Forbidden',
          message: err.message,
        });
      }
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: err.message || 'Failed to inspect directory children',
      });
    }
  });

  // GET /api/workspace/raw (stream raw binary / media / download)
  fastify.get<{
    Querystring: { path?: string; root?: string; download?: string };
  }>('/api/workspace/raw', async (req, reply) => {
    const filePath = req.query.path;
    if (!filePath || typeof filePath !== 'string') {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Query parameter "path" is required',
      });
    }

    const root = req.query.root || getDefaultWorkspaceRoot();

    try {
      const resolved = resolveWorkspacePath(root, filePath);
      const stats = await fs.promises.stat(resolved);
      if (!stats.isFile()) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Path is not a regular file',
        });
      }

      const { mimeType } = getFileCategoryAndMime(resolved);
      const isDownload = req.query.download === 'true' || req.query.download === '1';
      const filename = path.basename(resolved);

      reply.header('Content-Type', mimeType.split(';')[0]);
      reply.header('Content-Length', stats.size);
      if (isDownload) {
        reply.header('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
      } else {
        reply.header('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`);
      }

      const stream = fs.createReadStream(resolved);
      return reply.send(stream);
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
        message: err.message || 'Failed to stream workspace file',
      });
    }
  });

  // GET /api/workspace/diffs (retrieve live working-tree git diffs including submodules)
  fastify.get<{
    Querystring: { root?: string };
  }>('/api/workspace/diffs', async (req, reply) => {
    const root = req.query.root || getDefaultWorkspaceRoot();
    try {
      const diffs = collectWorkspaceGitDiffs(root);
      return reply.status(200).send({
        root,
        diffs,
      });
    } catch (err: any) {
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: err.message || 'Failed to inspect workspace diffs',
      });
    }
  });
};

