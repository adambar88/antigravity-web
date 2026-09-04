import React, { useState, useEffect } from 'react';
import {
  Users,
  Bot,
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronRight,
  ChevronDown,
  Copy,
  Check,
  RefreshCw,
  Terminal,
  FileText,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { SubagentSession, SubagentTranscriptTurn } from '@/types';
import { api } from '@/services/api';

interface SubagentViewerProps {
  sessionId: string;
  subagents: SubagentSession[];
  selectedSubagentId?: string | null;
  onSelectSubagent?: (id: string) => void;
  onRefresh?: () => void;
  isLoading?: boolean;
}

export const SubagentViewer: React.FC<SubagentViewerProps> = ({
  sessionId,
  subagents,
  selectedSubagentId,
  onSelectSubagent,
  onRefresh,
  isLoading = false,
}) => {
  const [activeId, setActiveId] = useState<string | null>(
    selectedSubagentId || (subagents.length > 0 ? subagents[0].id : null)
  );
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [transcript, setTranscript] = useState<SubagentTranscriptTurn[]>([]);
  const [loadingTranscript, setLoadingTranscript] = useState(false);
  const [expandedTurns, setExpandedTurns] = useState<Set<number>>(new Set());

  // Keep activeId in sync with selectedSubagentId
  useEffect(() => {
    if (selectedSubagentId) {
      setActiveId(selectedSubagentId);
    } else if (!activeId && subagents.length > 0) {
      setActiveId(subagents[0].id);
    }
  }, [selectedSubagentId, subagents]);

  const activeSubagent = subagents.find((s) => s.id === activeId);

  // Fetch full transcript turns when activeSubagent changes
  useEffect(() => {
    if (!activeId || !sessionId) return;
    let isMounted = true;
    setLoadingTranscript(true);

    api
      .getSubagentDetails(sessionId, activeId)
      .then((res) => {
        if (isMounted) {
          setTranscript(res.transcript || []);
        }
      })
      .catch((err) => {
        console.warn('Nie udało się pobrać szczegółów podagenta:', err);
      })
      .finally(() => {
        if (isMounted) setLoadingTranscript(false);
      });

    return () => {
      isMounted = false;
    };
  }, [sessionId, activeId]);

  const handleCopyPrompt = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const toggleTurnExpand = (stepIndex: number) => {
    setExpandedTurns((prev) => {
      const next = new Set(prev);
      if (next.has(stepIndex)) {
        next.delete(stepIndex);
      } else {
        next.add(stepIndex);
      }
      return next;
    });
  };

  const renderStateBadge = (state: SubagentSession['state']) => {
    switch (state) {
      case 'running':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-500 border border-amber-500/30 animate-pulse">
            <Loader2 className="w-2.5 h-2.5 animate-spin" />
            <span>W trakcie</span>
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
            <CheckCircle2 className="w-2.5 h-2.5" />
            <span>Zakończono</span>
          </span>
        );
      case 'errored':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/15 text-rose-500 border border-rose-500/30">
            <AlertCircle className="w-2.5 h-2.5" />
            <span>Błąd</span>
          </span>
        );
      case 'waiting_for_message':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/15 text-blue-500 border border-blue-500/30">
            <Clock className="w-2.5 h-2.5" />
            <span>Oczekuje</span>
          </span>
        );
      case 'idle':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-500/15 text-neutral-400 border border-neutral-500/30">
            <span>Bezczynny</span>
          </span>
        );
    }
  };

  if (subagents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center h-full">
        <div className="w-12 h-12 rounded-2xl bg-surface border border-border flex items-center justify-center text-muted mb-3 shadow-xs">
          <Users className="w-6 h-6 text-subtle" />
        </div>
        <h3 className="text-sm font-semibold text-main mb-1">Brak aktywnych podsesji</h3>
        <p className="text-xs text-muted max-w-xs mb-4">
          Podagenci (subagents) są automatycznie rejestrowani podczas uruchamiania równoległych swarmów, pre-mortem lub specjalistycznych ról roboczych.
        </p>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-hover border border-border text-xs text-main transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Odśwież stan</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-main">Podsesje i Agenci</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-primary/20 text-primary font-mono font-medium">
            {subagents.length}
          </span>
        </div>

        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            title="Odśwież stan podsesji"
            className="p-1 rounded-md text-muted hover:text-main hover:bg-surface-hover transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left / Top Subagents List */}
        <div className="w-full md:w-64 md:shrink-0 border-b md:border-b-0 md:border-r border-border overflow-y-auto max-h-52 md:max-h-none p-2 space-y-1.5 bg-surface/50">
          {subagents.map((sub) => {
            const isSelected = sub.id === activeId;
            return (
              <div
                key={sub.id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  setActiveId(sub.id);
                  onSelectSubagent?.(sub.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setActiveId(sub.id);
                    onSelectSubagent?.(sub.id);
                  }
                }}
                className={`p-2 rounded-xl text-left transition-all cursor-pointer border ${
                  isSelected
                    ? 'bg-card border-primary/40 shadow-xs ring-1 ring-primary/20'
                    : 'bg-card/40 hover:bg-card border-border/70 text-muted'
                }`}
              >
                <div className="flex items-start justify-between gap-1 mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Bot className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-primary' : 'text-muted'}`} />
                    <span className="text-xs font-semibold text-main truncate">{sub.role}</span>
                  </div>
                  {renderStateBadge(sub.state)}
                </div>

                <div className="flex items-center gap-1 text-[10px] text-muted mb-1 flex-wrap font-mono">
                  <span className="px-1 py-0.2 rounded bg-surface border border-border/80">
                    {sub.type}
                  </span>
                  {sub.stepsCount > 0 && (
                    <span className="text-subtle font-sans">
                      • {sub.stepsCount} {sub.stepsCount === 1 ? 'krok' : 'kroków'}
                    </span>
                  )}
                </div>

                {sub.currentStep && (
                  <p className="text-[10px] text-muted/80 line-clamp-1 italic">
                    {sub.currentStep}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Right / Main Subagent Details Pane */}
        <div className="flex-1 flex flex-col overflow-y-auto p-3 sm:p-4 bg-card">
          {activeSubagent ? (
            <div className="space-y-4 max-w-3xl">
              {/* Header card */}
              <div className="p-3.5 rounded-xl border border-border bg-surface/70 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-semibold text-main">{activeSubagent.role}</h4>
                      {renderStateBadge(activeSubagent.state)}
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-surface border border-border text-muted">
                        {activeSubagent.type}
                      </span>
                      {activeSubagent.model && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-primary/10 text-primary border border-primary/20">
                          {activeSubagent.model}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-muted font-mono mt-1 select-all">
                      ID: {activeSubagent.id}
                    </div>
                  </div>

                  {activeSubagent.stepsCount > 0 && (
                    <div className="text-right shrink-0">
                      <div className="text-xs font-semibold text-main font-mono">
                        {activeSubagent.stepsCount}
                      </div>
                      <div className="text-[10px] text-muted">kroków</div>
                    </div>
                  )}
                </div>

                {/* Live Action Banner */}
                {activeSubagent.currentStep && (
                  <div className="p-2 rounded-lg bg-surface border border-border/80 flex items-center gap-2 text-xs">
                    <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="text-muted shrink-0 font-medium">Bieżący stan:</span>
                    <span className="text-main font-mono text-[11px] truncate">
                      {activeSubagent.currentStep}
                    </span>
                  </div>
                )}
              </div>

              {/* Task Prompt Section */}
              {activeSubagent.prompt && (
                <div className="p-3.5 rounded-xl border border-border bg-surface/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-main flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-primary" />
                      Instrukcja zadania (Prompt)
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyPrompt(activeSubagent.prompt || '')}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded bg-surface hover:bg-surface-hover border border-border text-[10px] text-muted hover:text-main transition-colors"
                    >
                      {copiedPrompt ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-500" />
                          <span className="text-emerald-500">Skopiowano</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Kopiuj</span>
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="text-xs text-main bg-card p-3 rounded-lg border border-border/70 overflow-x-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed max-h-48">
                    {activeSubagent.prompt}
                  </pre>
                </div>
              )}

              {/* Recent Logs & Activity Timeline */}
              {activeSubagent.recentLogs && activeSubagent.recentLogs.length > 0 && (
                <div className="p-3.5 rounded-xl border border-border bg-surface/50 space-y-2">
                  <span className="text-xs font-semibold text-main flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-primary" />
                    Ostatnie wpisy z dziennika zdarzeń
                  </span>
                  <div className="space-y-1">
                    {activeSubagent.recentLogs.map((log, idx) => (
                      <div
                        key={idx}
                        className="px-2.5 py-1.5 rounded bg-card border border-border/60 text-xs font-mono text-muted text-[11px] truncate"
                      >
                        {log}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Full Transcript Turns Accordion */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-main flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-primary" />
                    Historia kroków ({transcript.length})
                  </span>
                  {loadingTranscript && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-muted" />
                  )}
                </div>

                {transcript.length > 0 ? (
                  <div className="space-y-1.5">
                    {transcript.map((turn) => {
                      const isExpanded = expandedTurns.has(turn.step_index);
                      const hasDetails = Boolean(turn.thinking || turn.tool_calls || turn.content);

                      return (
                        <div
                          key={turn.step_index}
                          className="rounded-lg border border-border bg-surface/40 overflow-hidden text-xs"
                        >
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => hasDetails && toggleTurnExpand(turn.step_index)}
                            onKeyDown={(e) => {
                              if ((e.key === 'Enter' || e.key === ' ') && hasDetails) {
                                toggleTurnExpand(turn.step_index);
                              }
                            }}
                            className={`flex items-center justify-between p-2 hover:bg-surface transition-colors ${
                              hasDetails ? 'cursor-pointer' : ''
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="px-1.5 py-0.2 rounded bg-card border border-border text-[10px] font-mono text-muted">
                                #{turn.step_index}
                              </span>
                              <span className="font-semibold text-main truncate">
                                {turn.source} / {turn.type}
                              </span>
                              {turn.status === 'ERROR' && (
                                <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-500 text-[10px]">
                                  Błąd
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1">
                              {turn.created_at && (
                                <span className="text-[10px] text-muted font-mono hidden sm:inline">
                                  {new Date(turn.created_at).toLocaleTimeString()}
                                </span>
                              )}
                              {hasDetails &&
                                (isExpanded ? (
                                  <ChevronDown className="w-3.5 h-3.5 text-muted" />
                                ) : (
                                  <ChevronRight className="w-3.5 h-3.5 text-muted" />
                                ))}
                            </div>
                          </div>

                          {isExpanded && hasDetails && (
                            <div className="p-3 border-t border-border/70 bg-card space-y-2 text-[11px]">
                              {turn.thinking && (
                                <div className="space-y-1">
                                  <span className="font-semibold text-muted text-[10px] uppercase">
                                    Rozumowanie (Thinking)
                                  </span>
                                  <pre className="p-2 rounded bg-surface border border-border/60 text-muted whitespace-pre-wrap font-sans text-xs">
                                    {turn.thinking}
                                  </pre>
                                </div>
                              )}

                              {turn.tool_calls && turn.tool_calls.length > 0 && (
                                <div className="space-y-1">
                                  <span className="font-semibold text-muted text-[10px] uppercase">
                                    Wywołane narzędzia
                                  </span>
                                  <div className="space-y-1">
                                    {turn.tool_calls.map((tc, tcIdx) => (
                                      <div
                                        key={tcIdx}
                                        className="p-2 rounded bg-surface border border-border/60 font-mono text-[10px] space-y-1"
                                      >
                                        <div className="font-bold text-primary">{tc.name}</div>
                                        <pre className="text-muted overflow-x-auto">
                                          {JSON.stringify(tc.args, null, 2)}
                                        </pre>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {turn.content && (
                                <div className="space-y-1">
                                  <span className="font-semibold text-muted text-[10px] uppercase">
                                    Odpowiedź / Wynik
                                  </span>
                                  <pre className="p-2 rounded bg-surface border border-border/60 text-main whitespace-pre-wrap text-xs font-sans">
                                    {turn.content}
                                  </pre>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted italic">
                    Brak zarejestrowanych kroków w dzienniku podagenta.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-8 text-center h-full text-muted">
              <Bot className="w-8 h-8 text-subtle mb-2" />
              <p className="text-xs">Wybierz podagenta z listy po lewej stronie, aby wyświetlić szczegóły.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
