import React from 'react';
import {
  Bot,
  ExternalLink,
  File,
  FileCode,
  FileText,
  User,
} from 'lucide-react';
import { Message, ToolExecution } from '@/types';
import { formatFileSize } from '@/utils/formatters';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ThinkingBlock } from './ThinkingBlock';
import { ToolExecutionCard } from './ToolExecutionCard';
import { ScrollAnchorBadge } from './ScrollAnchorBadge';
import { ThinkingState } from '@/hooks/useSessionStream';

function getFileIcon(name: string, mimeType: string) {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (
    [
      'ts', 'tsx', 'js', 'jsx', 'json', 'py', 'rs', 'go', 'html', 'css',
      'scss', 'sh', 'sql', 'yaml', 'yml', 'c', 'cpp', 'h', 'java',
    ].includes(ext)
  ) {
    return <FileCode className="w-4 h-4 text-emerald-500" />;
  }
  if (['md', 'txt', 'rtf', 'doc', 'docx', 'pdf'].includes(ext) || mimeType.startsWith('text/')) {
    return <FileText className="w-4 h-4 text-blue-500" />;
  }
  return <File className="w-4 h-4 text-amber-500" />;
}

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
  onAbort?: () => void;
  onQuickPrompt?: (text: string) => void;
  onViewDiff?: (filePath: string) => void;
  onOpenSubagents?: () => void;
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
  onQuickPrompt,
  onViewDiff,
  onOpenSubagents,
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
                const hasAttachments = Boolean(msg.attachments && msg.attachments.length > 0);
                const imageAttachments = msg.attachments?.filter((a) => a.mimeType.startsWith('image/')) || [];
                const otherAttachments = msg.attachments?.filter((a) => !a.mimeType.startsWith('image/')) || [];

                return (
                  <div key={msg.id} className="flex items-start gap-3 w-full max-w-4xl xl:max-w-5xl 2xl:max-w-6xl ml-auto justify-end">
                    <div className="p-4 rounded-2xl bg-card border border-border text-main shadow-xs max-w-2xl xl:max-w-3xl break-words space-y-3">
                      {/* Attachments rendering */}
                      {hasAttachments && (
                        <div className="space-y-2">
                          {/* Image attachments grid */}
                          {imageAttachments.length > 0 && (
                            <div className={`grid gap-2 ${imageAttachments.length > 1 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
                              {imageAttachments.map((img) => (
                                <div key={img.id} className="relative group overflow-hidden rounded-xl border border-border/80 bg-black/5">
                                  {img.dataUrl ? (
                                    <a
                                      href={img.dataUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="block cursor-zoom-in"
                                      title="Kliknij, aby otworzyć w pełnym rozmiarze"
                                    >
                                      <img
                                        src={img.dataUrl}
                                        alt={img.name}
                                        className="max-h-72 sm:max-h-80 w-full object-contain rounded-xl transition-transform group-hover:scale-[1.01]"
                                        loading="lazy"
                                      />
                                    </a>
                                  ) : null}
                                  <div className="absolute bottom-0 inset-x-0 bg-black/60 backdrop-blur-xs px-2.5 py-1 text-[11px] text-white/90 truncate flex items-center justify-between">
                                    <span className="truncate mr-2">{img.name}</span>
                                    <span className="text-[10px] text-white/70 shrink-0">{formatFileSize(img.size)}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Non-image attachments */}
                          {otherAttachments.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {otherAttachments.map((file) => (
                                <div
                                  key={file.id}
                                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-surface border border-border/70 text-xs text-main shadow-2xs"
                                >
                                  <div className="shrink-0">
                                    {getFileIcon(file.name, file.mimeType)}
                                  </div>
                                  <span className="font-medium truncate max-w-[180px] sm:max-w-[240px]" title={file.name}>
                                    {file.name}
                                  </span>
                                  <span className="text-[10px] text-muted shrink-0">
                                    {formatFileSize(file.size)}
                                  </span>
                                  {file.dataUrl && (
                                    <a
                                      href={file.dataUrl}
                                      download={file.name}
                                      className="text-muted hover:text-primary transition-colors p-1"
                                      title={`Pobierz ${file.name}`}
                                    >
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Text content */}
                      {msg.content && (
                        <div>
                          <MarkdownRenderer content={msg.content} />
                        </div>
                      )}
                    </div>
                    <div className="w-8 h-8 rounded-xl bg-surface border border-border flex items-center justify-center text-muted shrink-0 mt-0.5">
                      <User className="w-4 h-4" />
                    </div>
                  </div>
                );
              }

              if (msg.role === 'system') {
                return (
                  <div key={msg.id} className="w-full max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto my-2 p-3 rounded-xl bg-surface border border-border/70 text-xs text-muted">
                    <MarkdownRenderer content={msg.content} />
                  </div>
                );
              }

              // Assistant message
              return (
                <div key={msg.id} className="flex items-start gap-3 w-full max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mr-auto justify-start">
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
                            onOpenSubagents={onOpenSubagents}
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
              <div className="flex items-start gap-3 w-full max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mr-auto justify-start">
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
                          onOpenSubagents={onOpenSubagents}
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
    </div>
  );
};
