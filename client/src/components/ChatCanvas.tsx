import React from 'react';
import {
  Bot,
  Square,
  User,
} from 'lucide-react';
import { Message, ToolExecution } from '@/types';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ThinkingBlock } from './ThinkingBlock';
import { ToolExecutionCard } from './ToolExecutionCard';
import { ScrollAnchorBadge } from './ScrollAnchorBadge';
import { ThinkingState } from '@/hooks/useSessionStream';

interface ChatCanvasProps {
  messages: Message[];
  currentThought: ThinkingState;
  streamingContent: string;
  activeTools: ToolExecution[];
  isGenerating: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
  showScrollBadge: boolean;
  onScroll: () => void;
  onScrollToBottom: () => void;
  onAbort: () => void;
  onQuickPrompt?: (text: string) => void;
  onViewDiff?: (filePath: string) => void;
}

export const ChatCanvas: React.FC<ChatCanvasProps> = ({
  messages,
  currentThought,
  streamingContent,
  activeTools,
  isGenerating,
  containerRef,
  showScrollBadge,
  onScroll,
  onScrollToBottom,
  onAbort,
  onQuickPrompt,
  onViewDiff,
}) => {
  const quickSuggestions = [
    { title: 'Opracuj plan wdrożenia', text: '/plan Przygotuj plan implementacji nowych funkcjonalności' },
    { title: 'Przegląd projektu', text: 'Przeanalizuj strukturę projektu i zaproponuj usprawnienia' },
    { title: 'Sprawdź ostatnie zmiany', text: '/review' },
  ];

  return (
    <div className="relative flex-1 min-h-0 flex flex-col">
      {/* Scrollable messages stream */}
      <div
        ref={containerRef}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-6"
      >
        {messages.length === 0 && !isGenerating ? (
          <div className="flex flex-col items-center justify-center min-h-[360px] text-center max-w-lg mx-auto py-12">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-4 shadow-xs">
              <Bot className="w-7 h-7" />
            </div>
            <h2 className="text-lg font-bold text-main mb-2">
              W czym mogę Ci dziś pomóc w projekcie?
            </h2>
            <p className="text-xs sm:text-sm text-muted mb-8 leading-relaxed">
              Zadaj pytanie, poproś o plan działania lub wskaż pliki do modyfikacji. Wszelkie operacje są wykonywane bezpiecznie i prezentowane na żywo.
            </p>

            <div className="w-full space-y-2">
              <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block mb-1">
                Szybkie rozpoczęcie:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {quickSuggestions.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onQuickPrompt?.(s.text)}
                    className="p-3 rounded-xl border border-border bg-card hover:bg-surface-hover hover:border-primary/40 text-left transition-all cursor-pointer shadow-2xs"
                  >
                    <div className="text-xs font-semibold text-main mb-1">
                      {s.title}
                    </div>
                    <div className="text-[11px] text-muted truncate">
                      {s.text}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => {
              if (msg.role === 'user') {
                return (
                  <div key={msg.id} className="flex items-start gap-3 max-w-3xl ml-auto justify-end">
                    <div className="p-4 rounded-2xl bg-card border border-border text-main shadow-xs max-w-2xl break-words">
                      <MarkdownRenderer content={msg.content} />
                    </div>
                    <div className="w-8 h-8 rounded-xl bg-surface border border-border flex items-center justify-center text-muted shrink-0 mt-0.5">
                      <User className="w-4 h-4" />
                    </div>
                  </div>
                );
              }

              if (msg.role === 'system') {
                return (
                  <div key={msg.id} className="max-w-3xl mx-auto my-2 p-3 rounded-xl bg-surface border border-border/70 text-xs text-muted">
                    <MarkdownRenderer content={msg.content} />
                  </div>
                );
              }

              // Assistant message
              return (
                <div key={msg.id} className="flex items-start gap-3 max-w-3xl mr-auto justify-start">
                  <div className="w-8 h-8 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary shrink-0 mt-0.5 shadow-2xs">
                    <Bot className="w-4 h-4" />
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Collapsible Thinking block */}
                    {msg.thought && (
                      <ThinkingBlock
                        thought={msg.thought}
                        durationMs={msg.thought_duration_ms}
                        isActive={false}
                      />
                    )}

                    {/* Tool executions */}
                    {msg.tool_executions && msg.tool_executions.length > 0 && (
                      <div className="space-y-1.5 my-2">
                        {msg.tool_executions.map((tool) => (
                          <ToolExecutionCard
                            key={tool.id}
                            tool={tool}
                            onViewDiff={onViewDiff}
                          />
                        ))}
                      </div>
                    )}

                    {/* Message body */}
                    {msg.content && (
                      <div className="p-4 rounded-2xl bg-card border border-border text-main shadow-xs leading-relaxed">
                        <MarkdownRenderer content={msg.content} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Live Streaming Block */}
            {isGenerating && (
              <div className="flex items-start gap-3 max-w-3xl mr-auto justify-start">
                <div className="w-8 h-8 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary shrink-0 mt-0.5 shadow-2xs">
                  <Bot className="w-4 h-4 animate-pulse" />
                </div>

                <div className="flex-1 min-w-0">
                  {/* Live Thinking Block */}
                  {(currentThought.isActive || currentThought.thought) && (
                    <ThinkingBlock
                      thought={currentThought.thought}
                      durationMs={currentThought.durationMs}
                      isActive={currentThought.isActive}
                    />
                  )}

                  {/* Active tools in progress */}
                  {activeTools.length > 0 && (
                    <div className="space-y-1.5 my-2">
                      {activeTools.map((tool) => (
                        <ToolExecutionCard
                          key={tool.id}
                          tool={tool}
                          onViewDiff={onViewDiff}
                        />
                      ))}
                    </div>
                  )}

                  {/* Live streaming message text */}
                  {streamingContent && (
                    <div className="p-4 rounded-2xl bg-card border border-border text-main shadow-xs leading-relaxed">
                      <MarkdownRenderer content={streamingContent} />
                      <span className="inline-block w-2 h-4 bg-primary ml-1 animate-pulse align-middle" />
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Floating Scroll Anchor Badge */}
      <ScrollAnchorBadge show={showScrollBadge} onClick={onScrollToBottom} />

      {/* Floating Stop Button during generation */}
      {isGenerating && (
        <div className="absolute top-4 right-6 z-20">
          <button
            type="button"
            onClick={onAbort}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold shadow-lg transition-all duration-150 cursor-pointer"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>Zatrzymaj generowanie</span>
          </button>
        </div>
      )}
    </div>
  );
};
