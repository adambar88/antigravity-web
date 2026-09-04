import path from 'node:path';
import fs from 'node:fs';
import type { WorkspaceTreeNode, WorkspaceFileResponse, FileCategory } from '../types/contract.js';

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
/**
 * Detects file category, MIME type and binary flag from file extension or content.
 */
export function getFileCategoryAndMime(filePath: string): {
  category: FileCategory;
  mimeType: string;
  isBinary: boolean;
} {
  const ext = path.extname(filePath).toLowerCase().replace('.', '');
  const basename = path.basename(filePath).toLowerCase();

  // Images
  const imageMimes: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    webp: 'image/webp',
    ico: 'image/x-icon',
    bmp: 'image/bmp',
    avif: 'image/avif',
  };
  if (imageMimes[ext]) {
    return { category: 'image', mimeType: imageMimes[ext], isBinary: ext !== 'svg' };
  }

  // Markdown
  if (ext === 'md' || ext === 'markdown' || ext === 'mdx') {
    return { category: 'markdown', mimeType: 'text/markdown; charset=utf-8', isBinary: false };
  }

  // PDF
  if (ext === 'pdf') {
    return { category: 'pdf', mimeType: 'application/pdf', isBinary: true };
  }

  // Audio
  const audioMimes: Record<string, string> = {
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    aac: 'audio/aac',
    m4a: 'audio/mp4',
    flac: 'audio/flac',
  };
  if (audioMimes[ext]) {
    return { category: 'audio', mimeType: audioMimes[ext], isBinary: true };
  }

  // Video
  const videoMimes: Record<string, string> = {
    mp4: 'video/mp4',
    webm: 'video/webm',
    ogv: 'video/ogg',
    mov: 'video/quicktime',
    mkv: 'video/x-matroska',
  };
  if (videoMimes[ext]) {
    return { category: 'video', mimeType: videoMimes[ext], isBinary: true };
  }

  // JSON
  if (ext === 'json') {
    return { category: 'json', mimeType: 'application/json; charset=utf-8', isBinary: false };
  }

  // Code
  const codeExtensions = new Set([
    'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs',
    'py', 'pyw', 'sh', 'bash', 'zsh', 'fish',
    'html', 'htm', 'css', 'scss', 'sass', 'less',
    'yml', 'yaml', 'toml', 'ini', 'cfg', 'conf',
    'sql', 'graphql', 'gql',
    'go', 'rs', 'java', 'kt', 'kts',
    'c', 'cpp', 'cc', 'cxx', 'h', 'hpp',
    'cs', 'php', 'rb', 'lua', 'swift', 'r',
    'vue', 'svelte', 'astro',
    'dockerfile', 'dockerignore', 'gitignore', 'env',
  ]);

  if (codeExtensions.has(ext) || basename === 'dockerfile' || basename === 'makefile') {
    return { category: 'code', mimeType: 'text/plain; charset=utf-8', isBinary: false };
  }

  // Plain text / logs / CSV
  if (ext === 'txt' || ext === 'log' || ext === 'csv' || ext === 'tsv') {
    return { category: 'text', mimeType: 'text/plain; charset=utf-8', isBinary: false };
  }

  return { category: 'binary', mimeType: 'application/octet-stream', isBinary: true };
}

/**
 * Recursively builds a filtered workspace directory tree up to maxDepth with symlink resolution.
 */
export async function getWorkspaceTree(
  workspaceRoot: string,
  maxDepth = 8,
  currentDepth = 0,
  currentDir = workspaceRoot,
  visited = new Set<string>()
): Promise<WorkspaceTreeNode[]> {
  const rootCanonical = fs.realpathSync(workspaceRoot);
  let dirCanonical = currentDir;
  try {
    dirCanonical = fs.realpathSync(currentDir);
  } catch {
    return [];
  }

  if (visited.has(dirCanonical)) {
    return [];
  }
  visited.add(dirCanonical);

  if (currentDepth >= maxDepth) {
    return [];
  }

  let entries: fs.Dirent[] = [];
  try {
    entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const result: WorkspaceTreeNode[] = [];

  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);
    const relativePath = path.relative(rootCanonical, fullPath);

    let isDir = entry.isDirectory();
    let isF = entry.isFile();

    // Properly inspect symlinks to identify if target is directory or file
    if (entry.isSymbolicLink()) {
      try {
        const targetStat = await fs.promises.stat(fullPath);
        if (targetStat.isDirectory()) {
          isDir = true;
        } else if (targetStat.isFile()) {
          isF = true;
        }
      } catch {
        continue;
      }
    }

    if (isDir) {
      if (IGNORED_DIRECTORIES.has(entry.name)) {
        continue;
      }

      const children = await getWorkspaceTree(
        rootCanonical,
        maxDepth,
        currentDepth + 1,
        fullPath,
        new Set(visited)
      );

      result.push({
        name: entry.name,
        path: relativePath,
        type: 'directory',
        children,
      });
    } else if (isF) {
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
 * Returns immediate children of a specific directory inside the workspace.
 * Enables infinite on-demand drilldown for deeply nested directories.
 */
export async function getWorkspaceDirectoryChildren(
  workspaceRoot: string,
  relativeDirPath: string
): Promise<WorkspaceTreeNode[]> {
  const rootCanonical = fs.realpathSync(workspaceRoot);
  const resolved = resolveWorkspacePath(workspaceRoot, relativeDirPath || '.');
  const stats = await fs.promises.stat(resolved);

  if (!stats.isDirectory()) {
    throw new WorkspaceSecurityError(`Path is not a directory: ${relativeDirPath}`, 400);
  }

  const entries = await fs.promises.readdir(resolved, { withFileTypes: true });
  const result: WorkspaceTreeNode[] = [];

  for (const entry of entries) {
    const fullPath = path.join(resolved, entry.name);
    const relativePath = path.relative(rootCanonical, fullPath);

    let isDir = entry.isDirectory();
    let isF = entry.isFile();

    if (entry.isSymbolicLink()) {
      try {
        const targetStat = await fs.promises.stat(fullPath);
        isDir = targetStat.isDirectory();
        isF = targetStat.isFile();
      } catch {
        continue;
      }
    }

    if (isDir) {
      if (IGNORED_DIRECTORIES.has(entry.name)) continue;
      result.push({
        name: entry.name,
        path: relativePath,
        type: 'directory',
        children: [],
      });
    } else if (isF) {
      if (isSensitivePath(relativePath)) continue;
      let size = 0;
      try {
        const s = await fs.promises.stat(fullPath);
        size = s.size;
      } catch {}

      result.push({
        name: entry.name,
        path: relativePath,
        type: 'file',
        size,
      });
    }
  }

  result.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return result;
}

/**
 * Reads a workspace file after canonical security verification, supporting all formats:
 * text, code, markdown, images, audio, video, PDF, and binary.
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

  // Limit file reading size to 25MB to prevent memory exhaustion
  if (stats.size > 25 * 1024 * 1024) {
    throw new WorkspaceSecurityError(`Plik przekracza limit rozmiaru podglądu (25MB)`, 413);
  }

  const { category, mimeType, isBinary } = getFileCategoryAndMime(resolved);
  const buffer = await fs.promises.readFile(resolved);

  // For images, audio, video, and PDF: embed base64 dataUrl for instant rich preview
  if (category === 'image' || category === 'audio' || category === 'video' || category === 'pdf') {
    const rawMime = mimeType.split(';')[0];
    const dataUrl = `data:${rawMime};base64,${buffer.toString('base64')}`;
    return {
      path: path.relative(fs.realpathSync(workspaceRoot), resolved),
      content: '',
      dataUrl,
      size: stats.size,
      modified: Math.floor(stats.mtimeMs),
      category,
      mimeType,
      isBinary: true,
    };
  }

  // Binary files: hex dump of first 256 bytes
  if (isBinary) {
    const hexSlice = buffer.subarray(0, 256).toString('hex').match(/.{1,2}/g)?.join(' ') || '';
    return {
      path: path.relative(fs.realpathSync(workspaceRoot), resolved),
      content: hexSlice,
      size: stats.size,
      modified: Math.floor(stats.mtimeMs),
      category: 'binary',
      mimeType,
      isBinary: true,
    };
  }

  // Text, code, markdown, json
  const content = buffer.toString('utf-8');
  return {
    path: path.relative(fs.realpathSync(workspaceRoot), resolved),
    content,
    size: stats.size,
    modified: Math.floor(stats.mtimeMs),
    category,
    mimeType,
    isBinary: false,
  };
}
