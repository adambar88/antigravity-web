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
  attachments?: AttachmentPayload[];
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

export type ArtifactType = 'plan' | 'document' | 'markdown' | 'diff' | 'diagram' | 'code' | 'table';

export interface Artifact {
  id: string;
  session_id: string;
  identifier: string;
  title: string;
  type: ArtifactType;
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

export interface AttachmentPayload {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  dataUrl?: string;
  filePath?: string;
}

export interface PromptRequest {
  prompt: string;
  model?: string;
  effort?: ReasoningEffort;
  attachments?: AttachmentPayload[];
}

export interface WorkspaceTreeNode {
  name: string;
  path: string; // relative to workspace
  type: 'file' | 'directory';
  size?: number;
  children?: WorkspaceTreeNode[];
}

export interface WorkspaceDirectoryItem {
  name: string;
  path: string;
  hasChildren?: boolean;
  isGit?: boolean;
}

export interface WorkspaceDirectoriesResponse {
  base: string;
  parent?: string | null;
  directories: WorkspaceDirectoryItem[];
  common: { name: string; path: string }[];
}

export interface WorkspaceTreeResponse {
  root: string;
  tree: WorkspaceTreeNode[];
}

export type FileCategory =
  | 'text'
  | 'code'
  | 'markdown'
  | 'image'
  | 'audio'
  | 'video'
  | 'pdf'
  | 'json'
  | 'binary';

export interface WorkspaceFileResponse {
  path: string;
  content: string;
  size: number;
  modified: number;
  category?: FileCategory;
  mimeType?: string;
  dataUrl?: string;
  isBinary?: boolean;
}

export type SubagentState =
  | 'running'
  | 'idle'
  | 'waiting_for_message'
  | 'completed'
  | 'errored'
  | 'unspecified';

export interface SubagentSession {
  id: string; // conversationId
  parentId: string;
  role: string;
  type: string;
  model?: string;
  prompt?: string;
  state: SubagentState;
  stateDetail?: string;
  currentStep?: string;
  stepsCount: number;
  lastActive?: number;
  createdAt?: number;
  transcriptUri?: string;
  recentLogs?: string[];
}

export interface SubagentsListResponse {
  subagents: SubagentSession[];
}

export interface SubagentTranscriptTurn {
  step_index: number;
  source: string;
  type: string;
  status: string;
  created_at: string;
  content?: string;
  thinking?: string;
  tool_calls?: Array<{
    name: string;
    args: Record<string, unknown>;
  }>;
}

export interface SubagentDetailResponse {
  subagent: SubagentSession;
  transcript: SubagentTranscriptTurn[];
}

export interface SubagentUpdatePayload {
  subagents: SubagentSession[];
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
  | 'artifact_created'
  | 'artifact_updated'
  | 'slash_command_result'
  | 'subagent_update'
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
