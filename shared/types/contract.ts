/**
 * Antigravity Web (agy-web)
 * Unified Contract & Type Definitions
 * Shared between Server (Fastify) and Client (React 19)
 */

// ============================================================================
// 1. Core Domain Models
// ============================================================================

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';
export type SessionStatus = 'idle' | 'running' | 'completed' | 'aborted' | 'failed';
export type ToolStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type DiffStatus = 'applied' | 'reverted' | 'staged' | 'failed';
export type ReasoningEffort = 'low' | 'medium' | 'high';

export interface Session {
  id: string;
  title: string;
  workspace_path: string;
  model: string;
  effort: ReasoningEffort;
  status: SessionStatus;
  agy_conversation_id?: string | null;
  created_at: number; // ms
  updated_at: number; // ms
}

export interface Message {
  id: string;
  session_id: string;
  sequence_num: number;
  role: MessageRole;
  content: string;
  thought?: string | null;
  thought_duration_ms?: number | null;
  status: 'pending' | 'streaming' | 'completed' | 'failed';
  created_at: number; // ms
  tool_executions?: ToolExecution[];
}

export interface ToolExecution {
  id: string;
  message_id: string;
  session_id: string;
  tool_name: string;
  tool_args: Record<string, unknown>;
  tool_result?: string | null;
  status: ToolStatus;
  duration_ms?: number | null;
  created_at: number; // ms
  diffs?: FileDiff[];
}

export interface FileDiff {
  id: string;
  tool_execution_id: string;
  session_id: string;
  file_path: string;
  before_content?: string | null;
  after_content?: string | null;
  additions: number;
  deletions: number;
  status: DiffStatus;
  created_at: number; // ms
}

export interface Artifact {
  id: string;
  session_id: string;
  identifier: string;
  title: string;
  type: 'markdown' | 'diff' | 'diagram' | 'code' | 'table';
  content: string;
  file_path?: string | null;
  created_at: number; // ms
  updated_at: number; // ms
}

export interface SessionSummary extends Session {
  message_count: number;
  tool_count: number;
  last_message_preview?: string | null;
}

export interface HydratedSession extends Session {
  messages: Message[];
  artifacts: Artifact[];
}

// ============================================================================
// 2. REST API Request / Response DTOs
// ============================================================================

export interface HealthResponse {
  status: 'ok';
  version: string;
  uptime_seconds: number;
  wal_mode: boolean;
  active_sessions: number;
  timestamp: number;
}

export interface AuthLoginRequest {
  token: string;
}

export interface AuthLoginResponse {
  success: boolean;
  message: string;
}

export interface AuthMeResponse {
  authenticated: boolean;
  workspace_root: string;
  default_model: string;
  version: string;
}

export interface CreateSessionRequest {
  title?: string;
  workspace_path?: string;
  model?: string;
  effort?: ReasoningEffort;
}

export interface UpdateSessionRequest {
  title?: string;
  workspace_path?: string;
  model?: string;
  effort?: ReasoningEffort;
}

export interface PromptRequest {
  prompt: string;
  model?: string;
  effort?: ReasoningEffort;
}

export interface WorkspaceTreeNode {
  name: string;
  path: string; // relative to workspace
  type: 'file' | 'directory';
  size?: number;
  children?: WorkspaceTreeNode[];
}

export interface WorkspaceTreeResponse {
  root: string;
  tree: WorkspaceTreeNode[];
}

export interface WorkspaceFileResponse {
  path: string;
  content: string;
  size: number;
  modified: number;
}

// ============================================================================
// 3. Real-Time Streaming (SSE) Protocol
// ============================================================================

export type SSEEventType =
  | 'session_status'
  | 'thought_delta'
  | 'thought_complete'
  | 'message_delta'
  | 'message_complete'
  | 'tool_start'
  | 'tool_progress'
  | 'tool_complete'
  | 'diff_created'
  | 'slash_command_result'
  | 'turn_error'
  | 'heartbeat';

export interface SSEEventEnvelope<T = unknown> {
  seq: number;
  session_id: string;
  timestamp: number;
  type: SSEEventType;
  payload: T;
}

export interface ThoughtDeltaPayload {
  step_index: number;
  delta: string;
}

export interface ThoughtCompletePayload {
  step_index: number;
  thought: string;
  duration_ms: number;
}

export interface MessageDeltaPayload {
  step_index: number;
  delta: string;
}

export interface MessageCompletePayload {
  message_id: string;
  content: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
}

export interface ToolStartPayload {
  tool_execution_id: string;
  step_index: number;
  tool_name: string;
  tool_args: Record<string, unknown>;
}

export interface ToolProgressPayload {
  tool_execution_id: string;
  step_index: number;
  chunk: string;
}

export interface ToolCompletePayload {
  tool_execution_id: string;
  step_index: number;
  tool_name: string;
  output?: string;
  duration_ms: number;
  status: ToolStatus;
}

export interface DiffCreatedPayload {
  diff_id: string;
  tool_execution_id: string;
  file_path: string;
  before_content?: string | null;
  after_content?: string | null;
  additions: number;
  deletions: number;
}

export interface SlashCommandResultPayload {
  command: string;
  output: string;
}
