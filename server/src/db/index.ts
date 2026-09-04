import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import type {
  Session,
  SessionSummary,
  HydratedSession,
  Message,
  ToolExecution,
  FileDiff,
  Artifact,
  ReasoningEffort,
  SessionStatus,
  MessageRole,
  ToolStatus,
  DiffStatus,
} from '../types/contract.js';

export interface DatabaseConfig {
  dbPath?: string;
}

let dbInstance: Database.Database | null = null;

export function getDatabase(customPath?: string): Database.Database {
  if (dbInstance && !customPath) {
    return dbInstance;
  }

  const defaultDir = path.resolve(process.cwd(), 'data');
  if (!fs.existsSync(defaultDir)) {
    fs.mkdirSync(defaultDir, { recursive: true });
  }

  const resolvedPath = customPath || process.env.DB_PATH || path.join(defaultDir, 'antigravity.db');
  const parentDir = path.dirname(resolvedPath);
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true });
  }

  const db = new Database(resolvedPath);

  // WAL Mode, foreign keys, synchronous normal, and 5000ms busy timeout
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  db.pragma('synchronous = NORMAL');

  initSchema(db);

  if (!customPath) {
    dbInstance = db;
  }

  return db;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      workspace_path TEXT NOT NULL,
      model TEXT NOT NULL,
      effort TEXT NOT NULL,
      status TEXT NOT NULL,
      agy_conversation_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );


    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      sequence_num INTEGER NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      thought TEXT,
      thought_duration_ms INTEGER,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tool_executions (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      tool_name TEXT NOT NULL,
      tool_args TEXT NOT NULL,
      tool_result TEXT,
      status TEXT NOT NULL,
      duration_ms INTEGER,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS file_diffs (
      id TEXT PRIMARY KEY,
      tool_execution_id TEXT NOT NULL REFERENCES tool_executions(id) ON DELETE CASCADE,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      file_path TEXT NOT NULL,
      before_content TEXT,
      after_content TEXT,
      additions INTEGER NOT NULL DEFAULT 0,
      deletions INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS artifacts (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      identifier TEXT NOT NULL,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      file_path TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_messages_session_seq ON messages(session_id, sequence_num);
    CREATE INDEX IF NOT EXISTS idx_tool_executions_session ON tool_executions(session_id);
    CREATE INDEX IF NOT EXISTS idx_tool_executions_msg ON tool_executions(message_id);
    CREATE INDEX IF NOT EXISTS idx_file_diffs_tool ON file_diffs(tool_execution_id);
    CREATE INDEX IF NOT EXISTS idx_artifacts_session ON artifacts(session_id);
  `);

  try {
    db.exec('ALTER TABLE sessions ADD COLUMN agy_conversation_id TEXT;');
  } catch {
    // Column already exists
  }
}

// ============================================================================
// Zero-N+1 Query Methods
// ============================================================================

export interface CreateSessionParams {
  id?: string;
  title?: string;
  workspace_path?: string;
  model?: string;
  effort?: ReasoningEffort;
  agy_conversation_id?: string | null;
}

export function createSession(params: CreateSessionParams, db = getDatabase()): Session {
  const now = Date.now();
  const id = params.id || crypto.randomUUID();
  const title = params.title || 'New Session';
  const workspace_path = params.workspace_path || process.env.WORKSPACE_ROOT || '/home/adam/projects/my-domain';
  const model = params.model || 'gemini-3.8-flash-medium';
  const effort = params.effort || 'medium';
  const status: SessionStatus = 'idle';
  const agy_conversation_id = params.agy_conversation_id || null;

  const stmt = db.prepare(`
    INSERT INTO sessions (id, title, workspace_path, model, effort, status, agy_conversation_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(id, title, workspace_path, model, effort, status, agy_conversation_id, now, now);

  return {
    id,
    title,
    workspace_path,
    model,
    effort,
    status,
    agy_conversation_id,
    created_at: now,
    updated_at: now,
  };
}

export function listSessions(db = getDatabase()): SessionSummary[] {
  const query = `
    SELECT 
      s.id, s.title, s.workspace_path, s.model, s.effort, s.status, s.agy_conversation_id, s.created_at, s.updated_at,
      COALESCE(m.msg_count, 0) AS message_count,
      COALESCE(t.tool_count, 0) AS tool_count,
      lm.content AS last_message_preview
    FROM sessions s
    LEFT JOIN (
      SELECT session_id, COUNT(*) AS msg_count
      FROM messages
      GROUP BY session_id
    ) m ON s.id = m.session_id
    LEFT JOIN (
      SELECT session_id, COUNT(*) AS tool_count
      FROM tool_executions
      GROUP BY session_id
    ) t ON s.id = t.session_id
    LEFT JOIN (
      SELECT m1.session_id, m1.content
      FROM messages m1
      INNER JOIN (
        SELECT session_id, MAX(sequence_num) AS max_seq
        FROM messages
        GROUP BY session_id
      ) m2 ON m1.session_id = m2.session_id AND m1.sequence_num = m2.max_seq
    ) lm ON s.id = lm.session_id
    ORDER BY s.updated_at DESC
  `;

  const rows = db.prepare(query).all() as Array<{
    id: string;
    title: string;
    workspace_path: string;
    model: string;
    effort: ReasoningEffort;
    status: SessionStatus;
    agy_conversation_id: string | null;
    created_at: number;
    updated_at: number;
    message_count: number;
    tool_count: number;
    last_message_preview: string | null;
  }>;

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    workspace_path: r.workspace_path,
    model: r.model,
    effort: r.effort,
    status: r.status,
    agy_conversation_id: r.agy_conversation_id,
    created_at: r.created_at,
    updated_at: r.updated_at,
    message_count: r.message_count,
    tool_count: r.tool_count,
    last_message_preview: r.last_message_preview,
  }));
}

export function getSession(id: string, db = getDatabase()): Session | null {
  const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as Session | undefined;
  return row || null;
}

export function getSessionWithHistory(id: string, db = getDatabase()): HydratedSession | null {
  const session = getSession(id, db);
  if (!session) {
    return null;
  }

  // 1. Fetch messages
  const messageRows = db.prepare(`
    SELECT * FROM messages WHERE session_id = ? ORDER BY sequence_num ASC
  `).all(id) as Array<{
    id: string;
    session_id: string;
    sequence_num: number;
    role: MessageRole;
    content: string;
    thought: string | null;
    thought_duration_ms: number | null;
    status: 'pending' | 'streaming' | 'completed' | 'failed';
    created_at: number;
  }>;

  // 2. Fetch tool executions
  const toolRows = db.prepare(`
    SELECT * FROM tool_executions WHERE session_id = ? ORDER BY created_at ASC
  `).all(id) as Array<{
    id: string;
    message_id: string;
    session_id: string;
    tool_name: string;
    tool_args: string;
    tool_result: string | null;
    status: ToolStatus;
    duration_ms: number | null;
    created_at: number;
  }>;

  // 3. Fetch file diffs
  const diffRows = db.prepare(`
    SELECT * FROM file_diffs WHERE session_id = ? ORDER BY created_at ASC
  `).all(id) as Array<{
    id: string;
    tool_execution_id: string;
    session_id: string;
    file_path: string;
    before_content: string | null;
    after_content: string | null;
    additions: number;
    deletions: number;
    status: DiffStatus;
    created_at: number;
  }>;

  // 4. Fetch artifacts
  const artifactRows = db.prepare(`
    SELECT * FROM artifacts WHERE session_id = ? ORDER BY created_at DESC
  `).all(id) as Artifact[];

  // Stitch diffs into tool executions
  const diffsByToolId = new Map<string, FileDiff[]>();
  for (const diff of diffRows) {
    const list = diffsByToolId.get(diff.tool_execution_id) || [];
    list.push(diff);
    diffsByToolId.set(diff.tool_execution_id, list);
  }

  // Stitch tool executions into messages
  const toolsByMessageId = new Map<string, ToolExecution[]>();
  for (const row of toolRows) {
    let parsedArgs: Record<string, unknown> = {};
    try {
      parsedArgs = JSON.parse(row.tool_args);
    } catch {
      parsedArgs = { raw: row.tool_args };
    }

    const toolExecution: ToolExecution = {
      id: row.id,
      message_id: row.message_id,
      session_id: row.session_id,
      tool_name: row.tool_name,
      tool_args: parsedArgs,
      tool_result: row.tool_result,
      status: row.status,
      duration_ms: row.duration_ms,
      created_at: row.created_at,
      diffs: diffsByToolId.get(row.id) || [],
    };

    const list = toolsByMessageId.get(row.message_id) || [];
    list.push(toolExecution);
    toolsByMessageId.set(row.message_id, list);
  }

  // Stitch messages with their tool executions
  const messages: Message[] = messageRows.map((m) => ({
    id: m.id,
    session_id: m.session_id,
    sequence_num: m.sequence_num,
    role: m.role,
    content: m.content,
    thought: m.thought,
    thought_duration_ms: m.thought_duration_ms,
    status: m.status,
    created_at: m.created_at,
    tool_executions: toolsByMessageId.get(m.id) || [],
  }));

  return {
    ...session,
    messages,
    artifacts: artifactRows,
  };
}

export function updateSession(
  id: string,
  updates: Partial<Pick<Session, 'title' | 'model' | 'effort' | 'status' | 'workspace_path' | 'agy_conversation_id'>>,
  db = getDatabase()
): Session | null {
  const existing = getSession(id, db);
  if (!existing) return null;

  const now = Date.now();
  const title = updates.title ?? existing.title;
  const model = updates.model ?? existing.model;
  const effort = updates.effort ?? existing.effort;
  const status = updates.status ?? existing.status;
  const workspace_path = updates.workspace_path ?? existing.workspace_path;
  const agy_conversation_id = updates.agy_conversation_id !== undefined ? updates.agy_conversation_id : existing.agy_conversation_id;

  db.prepare(`
    UPDATE sessions
    SET title = ?, model = ?, effort = ?, status = ?, workspace_path = ?, agy_conversation_id = ?, updated_at = ?
    WHERE id = ?
  `).run(title, model, effort, status, workspace_path, agy_conversation_id, now, id);

  return {
    ...existing,
    title,
    model,
    effort,
    status,
    workspace_path,
    agy_conversation_id,
    updated_at: now,
  };
}

export function updateSessionStatus(id: string, status: SessionStatus, db = getDatabase()): void {
  const now = Date.now();
  db.prepare('UPDATE sessions SET status = ?, updated_at = ? WHERE id = ?').run(status, now, id);
}

export function updateMessage(
  id: string,
  updates: {
    content?: string;
    thought?: string | null;
    thought_duration_ms?: number | null;
    status?: 'pending' | 'streaming' | 'completed' | 'failed';
  },
  db = getDatabase()
): void {
  const current = db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as any;
  if (!current) return;
  const content = updates.content !== undefined ? updates.content : current.content;
  const thought = updates.thought !== undefined ? updates.thought : current.thought;
  const thought_duration_ms = updates.thought_duration_ms !== undefined ? updates.thought_duration_ms : current.thought_duration_ms;
  const status = updates.status !== undefined ? updates.status : current.status;

  db.prepare(`
    UPDATE messages
    SET content = ?, thought = ?, thought_duration_ms = ?, status = ?
    WHERE id = ?
  `).run(content, thought, thought_duration_ms, status, id);
}

export function deleteSession(id: string, db = getDatabase()): boolean {
  const result = db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
  return result.changes > 0;
}

export interface AppendTurnParams {
  id?: string;
  role: MessageRole;
  content: string;
  thought?: string | null;
  thought_duration_ms?: number | null;
  status?: 'pending' | 'streaming' | 'completed' | 'failed';
  sequence_num?: number;
  tool_executions?: ToolExecution[];
}

export function appendTurn(
  sessionId: string,
  params: AppendTurnParams,
  db = getDatabase()
): Message {
  const now = Date.now();
  const id = params.id || crypto.randomUUID();
  const status = params.status || 'completed';

  const transaction = db.transaction(() => {
    // Determine sequence number if not explicitly given
    let seq = params.sequence_num;
    if (seq === undefined) {
      const maxRow = db
        .prepare('SELECT COALESCE(MAX(sequence_num), -1) AS max_seq FROM messages WHERE session_id = ?')
        .get(sessionId) as { max_seq: number };
      seq = maxRow.max_seq + 1;
    }

    db.prepare(`
      INSERT INTO messages (id, session_id, sequence_num, role, content, thought, thought_duration_ms, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      sessionId,
      seq,
      params.role,
      params.content,
      params.thought ?? null,
      params.thought_duration_ms ?? null,
      status,
      now
    );

    // If tool executions provided, insert them
    if (params.tool_executions && params.tool_executions.length > 0) {
      for (const tool of params.tool_executions) {
        updateToolExecution(sessionId, {
          ...tool,
          message_id: id,
        }, db);
      }
    }

    // Touch session updated_at
    db.prepare('UPDATE sessions SET updated_at = ? WHERE id = ?').run(now, sessionId);

    return {
      id,
      session_id: sessionId,
      sequence_num: seq,
      role: params.role,
      content: params.content,
      thought: params.thought ?? null,
      thought_duration_ms: params.thought_duration_ms ?? null,
      status,
      created_at: now,
      tool_executions: params.tool_executions || [],
    };
  });

  return transaction();
}

export interface UpdateToolExecutionParams {
  id: string;
  message_id: string;
  tool_name: string;
  tool_args: Record<string, unknown>;
  tool_result?: string | null;
  status: ToolStatus;
  duration_ms?: number | null;
  created_at?: number;
  diffs?: FileDiff[];
}

export function updateToolExecution(
  sessionId: string,
  params: UpdateToolExecutionParams,
  db = getDatabase()
): ToolExecution {
  const now = Date.now();
  const createdAt = params.created_at || now;
  const argsJson = JSON.stringify(params.tool_args || {});

  const transaction = db.transaction(() => {
    db.prepare(`
      INSERT INTO tool_executions (id, message_id, session_id, tool_name, tool_args, tool_result, status, duration_ms, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        tool_args = excluded.tool_args,
        tool_result = excluded.tool_result,
        status = excluded.status,
        duration_ms = excluded.duration_ms
    `).run(
      params.id,
      params.message_id,
      sessionId,
      params.tool_name,
      argsJson,
      params.tool_result ?? null,
      params.status,
      params.duration_ms ?? null,
      createdAt
    );

    if (params.diffs && params.diffs.length > 0) {
      for (const diff of params.diffs) {
        upsertFileDiff(sessionId, params.id, diff, db);
      }
    }

    return {
      id: params.id,
      message_id: params.message_id,
      session_id: sessionId,
      tool_name: params.tool_name,
      tool_args: params.tool_args,
      tool_result: params.tool_result ?? null,
      status: params.status,
      duration_ms: params.duration_ms ?? null,
      created_at: createdAt,
      diffs: params.diffs || [],
    };
  });

  return transaction();
}

export function upsertFileDiff(
  sessionId: string,
  toolExecutionId: string,
  diff: FileDiff,
  db = getDatabase()
): void {
  const now = Date.now();
  db.prepare(`
    INSERT INTO file_diffs (id, tool_execution_id, session_id, file_path, before_content, after_content, additions, deletions, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      before_content = excluded.before_content,
      after_content = excluded.after_content,
      additions = excluded.additions,
      deletions = excluded.deletions,
      status = excluded.status
  `).run(
    diff.id,
    toolExecutionId,
    sessionId,
    diff.file_path,
    diff.before_content ?? null,
    diff.after_content ?? null,
    diff.additions,
    diff.deletions,
    diff.status,
    diff.created_at || now
  );
}

export function upsertArtifact(artifact: Artifact, db = getDatabase()): void {
  const now = Date.now();
  db.prepare(`
    INSERT INTO artifacts (id, session_id, identifier, title, type, content, file_path, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      identifier = excluded.identifier,
      title = excluded.title,
      type = excluded.type,
      content = excluded.content,
      file_path = excluded.file_path,
      updated_at = excluded.updated_at
  `).run(
    artifact.id,
    artifact.session_id,
    artifact.identifier,
    artifact.title,
    artifact.type,
    artifact.content,
    artifact.file_path ?? null,
    artifact.created_at || now,
    artifact.updated_at || now
  );
}

export function getSetting(key: string, db = getDatabase()): string | null {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row ? row.value : null;
}

export function setSetting(key: string, value: string, db = getDatabase()): void {
  db.prepare(`
    INSERT INTO settings (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, value);
}
