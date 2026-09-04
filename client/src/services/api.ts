/**
 * REST API client for Antigravity Web
 */

import {
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
  WorkspaceTreeResponse,
} from '@/types';

const getApiBase = () => {
  const base = import.meta.env.BASE_URL || '/';
  return (base.endsWith('/') ? base : `${base}/`) + 'api';
};

const BASE_URL = getApiBase();

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
    const res = await fetch(`${BASE_URL}/health`);
    return handleResponse<HealthResponse>(res);
  },

  async getAuthMe(): Promise<AuthMeResponse> {
    const res = await fetch(`${BASE_URL}/auth/me`);
    return handleResponse<AuthMeResponse>(res);
  },

  async getSessions(): Promise<SessionSummary[]> {
    const res = await fetch(`${BASE_URL}/sessions`);
    return handleResponse<SessionSummary[]>(res);
  },

  async createSession(payload?: CreateSessionRequest): Promise<Session> {
    const res = await fetch(`${BASE_URL}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {}),
    });
    return handleResponse<Session>(res);
  },

  async getSession(id: string): Promise<HydratedSession> {
    const res = await fetch(`${BASE_URL}/sessions/${id}`);
    return handleResponse<HydratedSession>(res);
  },

  async updateSession(id: string, payload: UpdateSessionRequest): Promise<Session> {
    const res = await fetch(`${BASE_URL}/sessions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<Session>(res);
  },

  async deleteSession(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`${BASE_URL}/sessions/${id}`, {
      method: 'DELETE',
    });
    return handleResponse<{ success: boolean }>(res);
  },

  async sendPrompt(
    sessionId: string,
    prompt: string,
    model?: string,
    effort?: ReasoningEffort
  ): Promise<{ message_id: string }> {
    const body: PromptRequest = { prompt, model, effort };
    const res = await fetch(`${BASE_URL}/sessions/${sessionId}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return handleResponse<{ message_id: string }>(res);
  },

  async abortSession(sessionId: string): Promise<{ success: boolean }> {
    const res = await fetch(`${BASE_URL}/sessions/${sessionId}/abort`, {
      method: 'POST',
    });
    return handleResponse<{ success: boolean }>(res);
  },

  async getWorkspaceTree(root?: string, depth?: number): Promise<WorkspaceTreeResponse> {
    const params = new URLSearchParams();
    if (root) params.set('root', root);
    if (depth) params.set('depth', depth.toString());
    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${BASE_URL}/workspace/tree${query}`);
    return handleResponse<WorkspaceTreeResponse>(res);
  },

  async getWorkspaceFile(filePath: string, root?: string): Promise<WorkspaceFileResponse> {
    const params = new URLSearchParams({ path: filePath });
    if (root) params.set('root', root);
    const res = await fetch(`${BASE_URL}/workspace/file?${params.toString()}`);
    return handleResponse<WorkspaceFileResponse>(res);
  },

  async getWorkspaceDirectories(path?: string): Promise<{
    base: string;
    directories: { path: string; name: string }[];
    common: { path: string; name: string }[];
  }> {
    const params = path ? `?path=${encodeURIComponent(path)}` : '';
    const res = await fetch(`${BASE_URL}/workspace/directories${params}`);
    return handleResponse<{
      base: string;
      directories: { path: string; name: string }[];
      common: { path: string; name: string }[];
    }>(res);
  },
};
