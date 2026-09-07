/**
 * REST API client for Antigravity Web
 */

import {
  AttachmentPayload,
  FileDiff,
  AuthMeResponse,
  CreateSessionRequest,
  HealthResponse,
  HydratedSession,
  PromptRequest,
  ReasoningEffort,
  Session,
  SessionSummary,
  UpdateSessionRequest,
  WorkspaceFileResponse,
  WorkspaceTreeNode,
  WorkspaceTreeResponse,
  WorkspaceDirectoriesResponse,
  SubagentSession,
  SubagentDetailResponse,
} from '@/types';

const getApiBase = () => {
  const base = import.meta.env.BASE_URL || '/';
  return (base.endsWith('/') ? base : `${base}/`) + 'api';
};

const BASE_URL = getApiBase();

async function customFetch(url: string, options: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      ...options.headers,
    },
  });
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errMsg = `Wystąpił błąd (${res.status})`;
    try {
      const errJson = await res.json();
      if (errJson.message) errMsg = errJson.message;
      else if (errJson.error) errMsg = errJson.error;
    } catch {
      // fallback
    }
    throw new Error(errMsg);
  }
  return res.json();
}

export const api = {
  async getHealth(): Promise<HealthResponse> {
    const res = await customFetch(`${BASE_URL}/health`);
    return handleResponse<HealthResponse>(res);
  },

  async getAuthMe(): Promise<AuthMeResponse> {
    const res = await customFetch(`${BASE_URL}/auth/me`);
    return handleResponse<AuthMeResponse>(res);
  },

  async getSessions(): Promise<SessionSummary[]> {
    const res = await customFetch(`${BASE_URL}/sessions`);
    return handleResponse<SessionSummary[]>(res);
  },

  async createSession(payload?: CreateSessionRequest): Promise<Session> {
    const res = await customFetch(`${BASE_URL}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {}),
    });
    return handleResponse<Session>(res);
  },

  async getSession(id: string): Promise<HydratedSession> {
    const res = await customFetch(`${BASE_URL}/sessions/${id}`);
    return handleResponse<HydratedSession>(res);
  },

  async updateSession(id: string, payload: UpdateSessionRequest): Promise<Session> {
    const res = await customFetch(`${BASE_URL}/sessions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<Session>(res);
  },

  async deleteSession(id: string): Promise<{ success: boolean }> {
    const res = await customFetch(`${BASE_URL}/sessions/${id}`, {
      method: 'DELETE',
    });
    return handleResponse<{ success: boolean }>(res);
  },

  async generateTitle(prompt: string): Promise<{ title: string }> {
    const res = await customFetch(`${BASE_URL}/sessions/generate-title`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    return handleResponse<{ title: string }>(res);
  },

  async sendPrompt(
    sessionId: string,
    prompt: string,
    model?: string,
    effort?: ReasoningEffort,
    attachments?: AttachmentPayload[]
  ): Promise<{ message_id: string }> {
    const body: PromptRequest = { prompt, model, effort, attachments };
    const res = await customFetch(`${BASE_URL}/sessions/${sessionId}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return handleResponse<{ message_id: string }>(res);
  },

  async abortSession(sessionId: string): Promise<{ success: boolean }> {
    const res = await customFetch(`${BASE_URL}/sessions/${sessionId}/abort`, {
      method: 'POST',
    });
    return handleResponse<{ success: boolean }>(res);
  },

  async getWorkspaceTree(root?: string, depth?: number): Promise<WorkspaceTreeResponse> {
    const params = new URLSearchParams();
    if (root) params.set('root', root);
    if (depth) params.set('depth', depth.toString());
    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await customFetch(`${BASE_URL}/workspace/tree${query}`);
    return handleResponse<WorkspaceTreeResponse>(res);
  },

  async getWorkspaceFile(filePath: string, root?: string): Promise<WorkspaceFileResponse> {
    const params = new URLSearchParams({ path: filePath });
    if (root) params.set('root', root);
    const res = await customFetch(`${BASE_URL}/workspace/file?${params.toString()}`);
    return handleResponse<WorkspaceFileResponse>(res);
  },

  async getWorkspaceDirectories(path?: string): Promise<WorkspaceDirectoriesResponse> {
    const params = path ? `?path=${encodeURIComponent(path)}` : '';
    const res = await customFetch(`${BASE_URL}/workspace/directories${params}`);
    return handleResponse<WorkspaceDirectoriesResponse>(res);
  },

  async getWorkspaceChildren(folderPath: string, root?: string): Promise<{
    root: string;
    path: string;
    children: WorkspaceTreeNode[];
  }> {
    const params = new URLSearchParams({ path: folderPath });
    if (root) params.set('root', root);
    const res = await customFetch(`${BASE_URL}/workspace/children?${params.toString()}`);
    return handleResponse<{
      root: string;
      path: string;
      children: WorkspaceTreeNode[];
    }>(res);
  },

  getWorkspaceRawUrl(filePath: string, root?: string, download = false): string {
    const params = new URLSearchParams({ path: filePath });
    if (root) params.set('root', root);
    if (download) params.set('download', '1');
    return `${BASE_URL}/workspace/raw?${params.toString()}`;
  },

  async getWorkspaceDiffs(root?: string): Promise<{
    root: string;
    diffs: FileDiff[];
  }> {
    const params = root ? `?root=${encodeURIComponent(root)}` : '';
    const res = await customFetch(`${BASE_URL}/workspace/diffs${params}`);
    return handleResponse<{
      root: string;
      diffs: FileDiff[];
    }>(res);
  },

  async getSubagents(sessionId: string): Promise<{ subagents: SubagentSession[] }> {
    const res = await customFetch(`${BASE_URL}/sessions/${sessionId}/subagents`);
    return handleResponse<{ subagents: SubagentSession[] }>(res);
  },

  async getSubagentDetails(sessionId: string, subagentId: string): Promise<SubagentDetailResponse> {
    const res = await customFetch(`${BASE_URL}/sessions/${sessionId}/subagents/${subagentId}`);
    return handleResponse<SubagentDetailResponse>(res);
  },
};
