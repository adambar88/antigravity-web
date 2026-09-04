import React, { useMemo, useState } from 'react';
import {
  MessageSquare,
  Plus,
  Search,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import { SessionSummary } from '@/types';
import { groupSessionsByDate } from '@/utils/formatters';

interface SidebarProps {
  sessions: SessionSummary[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onCreateSession: () => void;
  onDeleteSession: (id: string) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  sessions,
  activeSessionId,
  onSelectSession,
  onCreateSession,
  onDeleteSession,
  isOpenMobile,
  onCloseMobile,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const q = searchQuery.toLowerCase();
    return sessions.filter((s) => s.title.toLowerCase().includes(q));
  }, [sessions, searchQuery]);

  const grouped = useMemo(() => {
    return groupSessionsByDate(filteredSessions);
  }, [filteredSessions]);

  const renderGroup = (title: string, list: SessionSummary[]) => {
    if (list.length === 0) return null;

    return (
      <div className="mb-4">
        <div className="px-3 py-1 text-[11px] font-semibold text-muted uppercase tracking-wider">
          {title}
        </div>
        <div className="mt-1 space-y-1">
          {list.map((session) => {
            const isActive = session.id === activeSessionId;
            const isDeleting = confirmDeleteId === session.id;

            return (
              <div
                key={session.id}
                className={`group relative flex items-center justify-between rounded-xl px-3 py-2 text-xs transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-primary/15 text-primary font-semibold'
                    : 'text-main hover:bg-surface-hover'
                }`}
                onClick={() => {
                  onSelectSession(session.id);
                  onCloseMobile();
                }}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <MessageSquare
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-primary' : 'text-subtle group-hover:text-main'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs break-words line-clamp-2 leading-snug font-medium">
                      {session.title || 'Zadanie bez nazwy'}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-muted font-normal">
                      <span
                        className="truncate max-w-[120px] px-1 py-0.2 rounded bg-surface border border-border text-[9px] font-mono text-muted"
                        title={session.workspace_path}
                      >
                        {session.workspace_path ? session.workspace_path.replace(/^\/home\/adam\/?/, '~/') || '~' : '~'}
                      </span>
                      <span>•</span>
                      <span>{session.message_count || 0} wiad.</span>
                      {session.tool_count > 0 && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-0.5">
                            <Wrench className="w-2.5 h-2.5" />
                            {session.tool_count}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Delete button or confirmation */}
                <div className="shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
                  {isDeleting ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          onDeleteSession(session.id);
                          setConfirmDeleteId(null);
                        }}
                        className="px-1.5 py-0.5 rounded text-[10px] bg-rose-500 text-white font-medium hover:bg-rose-600 cursor-pointer"
                      >
                        Usuń
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-1.5 py-0.5 rounded text-[10px] bg-card text-muted hover:text-main border border-border cursor-pointer"
                      >
                        Nie
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      title="Usuń to zadanie"
                      onClick={() => setConfirmDeleteId(session.id)}
                      className="p-1 rounded-md text-subtle opacity-0 group-hover:opacity-100 hover:text-rose-500 hover:bg-surface transition-all cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-30 md:hidden"
        />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 w-64 md:w-56 lg:w-64 shrink-0 bg-surface border-r border-border flex flex-col z-40 transition-transform duration-200 md:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Top bar: Brand + New Task button */}
        <div className="p-3 border-b border-border space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-white font-bold text-sm shadow-xs">
                A
              </div>
              <span className="font-bold text-sm text-main tracking-tight">
                Antigravity Web
              </span>
            </div>

            <button
              type="button"
              onClick={onCloseMobile}
              className="p-1.5 rounded-lg text-muted hover:text-main hover:bg-surface-hover md:hidden transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              onCreateSession();
              onCloseMobile();
            }}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nowe zadanie</span>
          </button>
        </div>

        {/* Search input */}
        <div className="px-3 py-2 border-b border-border/50">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Szukaj zadań..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-card border border-border text-xs text-main placeholder:text-muted focus:outline-hidden focus:border-primary"
            />
          </div>
        </div>

        {/* Sessions list */}
        <div className="flex-1 overflow-y-auto p-2">
          {renderGroup('Dzisiaj', grouped.today)}
          {renderGroup('Wczoraj', grouped.yesterday)}
          {renderGroup('Ostatnie 7 dni', grouped.lastWeek)}
          {renderGroup('Starsze', grouped.older)}

          {filteredSessions.length === 0 && (
            <div className="p-6 text-center text-xs text-subtle">
              {searchQuery ? 'Brak pasujących zadań' : 'Brak zadań w historii'}
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
