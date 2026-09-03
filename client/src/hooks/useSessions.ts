import { useCallback, useEffect, useState } from 'react';
import { CreateSessionRequest, SessionSummary } from '@/types';
import { api } from '@/services/api';

export function useSessions() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getSessions();
      setSessions(data);
      if (data.length > 0 && !activeSessionId) {
        setActiveSessionId(data[0].id);
      }
    } catch (err) {
      console.warn('Błąd podczas pobierania sesji:', err);
      // If server is not responding yet or empty, provide a fallback active session ID
      if (sessions.length === 0) {
        const fallbackSession: SessionSummary = {
          id: 'default-session',
          title: 'Nowy projekt',
          workspace_path: '/home/adam/projects/my-domain',
          model: 'claude-3-7-sonnet',
          effort: 'high',
          status: 'idle',
          created_at: Date.now(),
          updated_at: Date.now(),
          message_count: 0,
          tool_count: 0,
        };
        setSessions([fallbackSession]);
        setActiveSessionId(fallbackSession.id);
      }
      setError(err instanceof Error ? err.message : 'Nie udało się połączyć z serwerem');
    } finally {
      setIsLoading(false);
    }
  }, [activeSessionId, sessions.length]);

  useEffect(() => {
    fetchSessions();
  }, []);

  const createNewSession = useCallback(
    async (req?: CreateSessionRequest) => {
      try {
        const newSession = await api.createSession({
          title: req?.title || 'Nowe zadanie',
          workspace_path: req?.workspace_path || '/home/adam/projects/my-domain',
          model: req?.model || 'claude-3-7-sonnet',
          effort: req?.effort || 'high',
        });

        const summary: SessionSummary = {
          ...newSession,
          message_count: 0,
          tool_count: 0,
          last_message_preview: null,
        };

        setSessions((prev) => [summary, ...prev.filter((s) => s.id !== newSession.id)]);
        setActiveSessionId(newSession.id);
        return newSession;
      } catch (err) {
        console.warn('Błąd tworzenia sesji na serwerze, używam lokalnej sesji:', err);
        const localSession: SessionSummary = {
          id: `session-${Date.now()}`,
          title: req?.title || 'Nowe zadanie',
          workspace_path: '/home/adam/projects/my-domain',
          model: 'claude-3-7-sonnet',
          effort: req?.effort || 'high',
          status: 'idle',
          created_at: Date.now(),
          updated_at: Date.now(),
          message_count: 0,
          tool_count: 0,
        };
        setSessions((prev) => [localSession, ...prev]);
        setActiveSessionId(localSession.id);
        return localSession;
      }
    },
    []
  );

  const deleteSession = useCallback(
    async (id: string) => {
      try {
        await api.deleteSession(id);
      } catch (err) {
        console.warn('Nie udało się usunąć sesji na serwerze:', err);
      }
      setSessions((prev) => {
        const next = prev.filter((s) => s.id !== id);
        if (activeSessionId === id) {
          setActiveSessionId(next.length > 0 ? next[0].id : null);
        }
        return next;
      });
    },
    [activeSessionId]
  );

  const updateSessionTitle = useCallback(async (id: string, title: string) => {
    try {
      await api.updateSession(id, { title });
    } catch {
      // local update
    }
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, title, updated_at: Date.now() } : s))
    );
  }, []);

  return {
    sessions,
    activeSessionId,
    setActiveSessionId,
    createNewSession,
    deleteSession,
    updateSessionTitle,
    isLoading,
    error,
    refreshSessions: fetchSessions,
  };
}
