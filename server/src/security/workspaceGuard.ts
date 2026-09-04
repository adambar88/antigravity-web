import path from 'node:path';
import fs from 'node:fs';
import type { WorkspaceTreeNode, WorkspaceFileResponse } from '../types/contract.js';

export class WorkspaceSecurityError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 403) {
    super(message);
    this.name = 'WorkspaceSecurityError';
    this.statusCode = statusCode;
  }
}

export function getDefaultWorkspaceRoot(): string {
  const envRoot = process.env.WORKSPACE_ROOT;
  if (envRoot && fs.existsSync(envRoot)) {
    return fs.realpathSync(envRoot);
  }

  // Prioritize user home directory if mounted
  if (fs.existsSync('/home/adam')) {
    return '/home/adam';
  }

  // Check parent project directory or current working directory
  const candidateParent = path.resolve(process.cwd(), '..');
  if (fs.existsSync(candidateParent)) {
    return fs.realpathSync(candidateParent);
  }

  return fs.realpathSync(process.cwd());
}

export async function listWorkspaceDirectories(
  basePath = '/home/adam'
): Promise<{ path: string; name: string }[]> {
  const targetDir = fs.existsSync(basePath) ? basePath : getDefaultWorkspaceRoot();
  try {
    const entries = await fs.promises.readdir(targetDir, { withFileTypes: true });
    const dirs: { path: string; name: string }[] = [];
    for (const entry of entries) {
      if (
        entry.isDirectory() &&
        !entry.name.startsWith('.') &&
        !IGNORED_DIRECTORIES.has(entry.name)
      ) {
        dirs.push({
          name: entry.name,
          path: path.join(targetDir, entry.name),
        });
      }
    }
    dirs.sort((a, b) => a.name.localeCompare(b.name));
    return dirs;
  } catch {
    return [];
  }
}

/**
 * List of sensitive filenames and regexes to block from workspace file inspection.
 */
const SENSITIVE_PATTERNS = [
  /^\.env(\..+)?$/i,
  /^id_(rsa|ed25519|ecdsa|dsa)(\.pub)?$/i,
  /\.(pem|key|pfx|p12)$/i,
  /^\.git\/config$/i,
  /^\.git\/credentials$/i,
  /credential.*\.json$/i,
  /service_account.*\.json$/i,
  /^\.aws\//i,
  /^\.ssh\//i,
];

const IGNORED_DIRECTORIES = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.cache',
  '.turbo',
  '.next',
  '.nuxt',
  '.output',
  'coverage',
]);

/**
 * Validates whether a given relative or basename path targets sensitive files.
 */
export function isSensitivePath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  const basename = path.basename(normalized);

  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(basename) || pattern.test(normalized)) {
      return true;
    }
  }

  return false;
}

/**
 * Safely resolves a path inside the workspace root using canonical realpath verification.
 * Throws WorkspaceSecurityError if the path attempts directory traversal or points to sensitive files.
 */
export function resolveWorkspacePath(workspaceRoot: string, targetPath: string): string {
  if (!workspaceRoot) {
    throw new WorkspaceSecurityError('Workspace root is not defined', 400);
  }

  const rootCanonical = fs.realpathSync(workspaceRoot);
  const candidate = path.isAbsolute(targetPath)
    ? path.resolve(targetPath)
    : path.resolve(rootCanonical, targetPath);

  let realCandidate: string;
  if (fs.existsSync(candidate)) {
    realCandidate = fs.realpathSync(candidate);
  } else {
    // If the file doesn't exist yet, resolve the closest existing parent
    let parent = path.dirname(candidate);
    while (!fs.existsSync(parent) && parent !== path.dirname(parent)) {
      parent = path.dirname(parent);
    }
    const realParent = fs.realpathSync(parent);
    const relativeToParent = path.relative(parent, candidate);
    realCandidate = path.resolve(realParent, relativeToParent);
  }

  // Verify that realCandidate is strictly inside rootCanonical
  const isInside =
    realCandidate === rootCanonical ||
    realCandidate.startsWith(rootCanonical + path.sep);

  if (!isInside) {
    throw new WorkspaceSecurityError(
      `Access denied: path traversal out of workspace root (${targetPath})`,
      403
    );
  }

  const relative = path.relative(rootCanonical, realCandidate);
  if (isSensitivePath(relative)) {
    throw new WorkspaceSecurityError(
      `Access denied: sensitive file protection (${path.basename(realCandidate)})`,
      403
    );
  }

  return realCandidate;
}

/**
 * Recursively builds a filtered workspace directory tree up to maxDepth.
 */
export async function getWorkspaceTree(
  workspaceRoot: string,
  maxDepth = 4,
  currentDepth = 0,
  currentDir = workspaceRoot
): Promise<WorkspaceTreeNode[]> {
  const rootCanonical = fs.realpathSync(workspaceRoot);
  const dirCanonical = fs.realpathSync(currentDir);

  if (currentDepth >= maxDepth) {
    return [];
  }

  const entries = await fs.promises.readdir(dirCanonical, { withFileTypes: true });
  const result: WorkspaceTreeNode[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dirCanonical, entry.name);
    const relativePath = path.relative(rootCanonical, fullPath);

    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name)) {
        continue;
      }

      const children = await getWorkspaceTree(
        rootCanonical,
        maxDepth,
        currentDepth + 1,
        fullPath
      );

      result.push({
        name: entry.name,
        path: relativePath,
        type: 'directory',
        children,
      });
    } else if (entry.isFile()) {
      if (isSensitivePath(relativePath)) {
        continue;
      }

      let size = 0;
      try {
        const stats = await fs.promises.stat(fullPath);
        size = stats.size;
      } catch {
        // Ignore stat errors
      }

      result.push({
        name: entry.name,
        path: relativePath,
        type: 'file',
        size,
      });
    }
  }

  // Sort directories first, then alphabetical
  result.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  return result;
}

/**
 * Reads a workspace file after canonical security verification.
 */
export async function readWorkspaceFile(
  workspaceRoot: string,
  relativePath: string
): Promise<WorkspaceFileResponse> {
  const resolved = resolveWorkspacePath(workspaceRoot, relativePath);
  const stats = await fs.promises.stat(resolved);

  if (!stats.isFile()) {
    throw new WorkspaceSecurityError(`Path is not a regular file: ${relativePath}`, 400);
  }

  // Limit file reading size to 5MB to prevent memory exhaustion
  if (stats.size > 5 * 1024 * 1024) {
    throw new WorkspaceSecurityError(`File exceeds maximum readable size limit (5MB)`, 413);
  }

  const content = await fs.promises.readFile(resolved, 'utf-8');

  return {
    path: path.relative(fs.realpathSync(workspaceRoot), resolved),
    content,
    size: stats.size,
    modified: Math.floor(stats.mtimeMs),
  };
}
