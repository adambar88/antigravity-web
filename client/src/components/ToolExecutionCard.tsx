import React, { useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  FileCode,
  FilePlus,
  FileText,
  FolderSearch,
  Globe,
  Loader2,
  Search,
  Terminal,
  Wrench,
} from 'lucide-react';
import { ToolExecution } from '@/types';
import { getToolDisplayInfo, getToolStatusText, formatFriendlyPath } from '@/utils/toolDisplay';
import { formatDuration } from '@/utils/formatters';

interface ToolExecutionCardProps {
  tool: ToolExecution;
  onViewDiff?: (filePath: string) => void;
}

export const ToolExecutionCard: React.FC<ToolExecutionCardProps> = React.memo(({ tool, onViewDiff }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showRawArgs, setShowRawArgs] = useState(false);

  const info = getToolDisplayInfo(tool.tool_name, tool.tool_args);
  const statusInfo = getToolStatusText(tool.status);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const textToCopy = tool.tool_result || JSON.stringify(tool.tool_args, null, 2);
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderIcon = () => {
    switch (info.icon) {
      case 'FileText':
        return <FileText className="w-4 h-4 text-sky-500 shrink-0" />;
      case 'FilePlus':
        return <FilePlus className="w-4 h-4 text-emerald-500 shrink-0" />;
      case 'FileCode':
        return <FileCode className="w-4 h-4 text-amber-500 shrink-0" />;
      case 'Terminal':
        return <Terminal className="w-4 h-4 text-purple-500 shrink-0" />;
      case 'Search':
        return <Search className="w-4 h-4 text-indigo-500 shrink-0" />;
      case 'FolderSearch':
        return <FolderSearch className="w-4 h-4 text-blue-500 shrink-0" />;
      case 'Globe':
        return <Globe className="w-4 h-4 text-teal-500 shrink-0" />;
      default:
        return <Wrench className="w-4 h-4 text-neutral-400 shrink-0" />;
    }
  };

  const hasOutput = Boolean(
    tool.tool_result ||
    (tool.diffs && tool.diffs.length > 0) ||
    (tool.tool_args && Object.keys(tool.tool_args).length > 0)
  );

  // Extract structured arguments for the expanded details view
  const args = tool.tool_args || {};
  const filePath = (args.AbsolutePath || args.TargetFile || args.path || args.file_path) as string;
  const cmd = (args.CommandLine || args.command || args.cmd) as string;
  const cwd = args.Cwd as string;
  const query = (args.Query || args.query || args.Pattern || args.pattern) as string;
  const searchPath = (args.SearchPath || args.SearchDirectory || args.DirectoryPath) as string;
  const url = (args.Url || args.url) as string;
  const startLine = args.StartLine !== undefined ? String(args.StartLine) : undefined;
  const endLine = args.EndLine !== undefined ? String(args.EndLine) : undefined;
  const actionDesc = (args.Description || args.Instruction || args.toolAction || args.toolSummary) as string;

  const hasDetails = Boolean(filePath || cmd || query || searchPath || url || actionDesc || startLine !== undefined);

  return (
    <div className="my-2 rounded-xl border border-border bg-card/60 overflow-hidden shadow-xs transition-all duration-150">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
        className="w-full flex items-start sm:items-center justify-between p-2.5 sm:p-3 text-left hover:bg-surface-hover/60 transition-colors cursor-pointer gap-2"
      >
        <div className="flex items-start sm:items-center gap-2.5 min-w-0 flex-1">
          <div className="p-1.5 rounded-lg bg-surface border border-border shrink-0 mt-0.5 sm:mt-0">
            {tool.status === 'running' ? (
              <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
            ) : (
              renderIcon()
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="text-xs font-semibold text-main break-words line-clamp-2 leading-snug">
                {info.title}
              </span>
              {tool.duration_ms !== null && tool.duration_ms !== undefined && (
                <span className="text-[10px] text-subtle font-mono shrink-0">
                  {formatDuration(tool.duration_ms)}
                </span>
              )}
            </div>
            {info.subtitle && (
              <p className="text-[11px] text-muted font-mono break-all line-clamp-2 leading-tight mt-0.5">
                {info.subtitle}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-1.5 sm:ml-3 self-start sm:self-center">
          {/* Full badge on desktop */}
          <span
            className={`hidden sm:inline-flex text-[10px] font-medium px-2 py-0.5 rounded-full border ${statusInfo.color}`}
          >
            {statusInfo.label}
          </span>

          {/* Compact indicator on mobile to save space for task titles */}
          <div
            className={`sm:hidden flex items-center justify-center w-5 h-5 rounded-full border ${statusInfo.color}`}
            title={statusInfo.label}
          >
            {tool.status === 'running' ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : tool.status === 'completed' ? (
              <Check className="w-3 h-3 stroke-[2.5]" />
            ) : tool.status === 'failed' ? (
              <span className="text-[10px] font-bold">✕</span>
            ) : (
              <span className="text-[10px] font-bold">•</span>
            )}
          </div>

          {hasOutput && (
            <div className="text-subtle p-0.5">
              {isOpen ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </div>
          )}
        </div>
      </div>

      {isOpen && (
        <div className="border-t border-border bg-code px-3.5 py-3 text-xs text-main space-y-3">
          {/* Rich operation details and parameters */}
          {hasDetails && (
            <div className="p-2.5 rounded-lg bg-surface/80 border border-border/60 space-y-2 text-[11px]">
              <div className="text-[10px] font-semibold text-muted uppercase tracking-wider">
                Szczegóły wywołania
              </div>

              {filePath && (
                <div className="flex flex-col sm:flex-row sm:items-start gap-1">
                  <span className="text-muted shrink-0 font-medium sm:w-20">Ścieżka:</span>
                  <code className="text-primary break-all font-mono select-all bg-card px-1.5 py-0.5 rounded border border-border/60">
                    {filePath}
                  </code>
                </div>
              )}

              {(startLine !== undefined || endLine !== undefined) && (
                <div className="flex items-center gap-1">
                  <span className="text-muted shrink-0 font-medium sm:w-20">Linie:</span>
                  <span className="font-mono text-main font-medium">
                    {startLine ?? 1} – {endLine ?? 'koniec'}
                  </span>
                </div>
              )}

              {cmd && (
                <div className="flex flex-col sm:flex-row sm:items-start gap-1">
                  <span className="text-muted shrink-0 font-medium sm:w-20">Polecenie:</span>
                  <code className="text-amber-500 break-all font-mono select-all bg-card px-1.5 py-0.5 rounded border border-border/60">
                    {cmd}
                  </code>
                </div>
              )}

              {cwd && (
                <div className="flex flex-col sm:flex-row sm:items-start gap-1">
                  <span className="text-muted shrink-0 font-medium sm:w-20">Katalog:</span>
                  <code className="text-muted break-all font-mono bg-card px-1.5 py-0.5 rounded border border-border/60">
                    {formatFriendlyPath(cwd)}
                  </code>
                </div>
              )}

              {query && (
                <div className="flex flex-col sm:flex-row sm:items-start gap-1">
                  <span className="text-muted shrink-0 font-medium sm:w-20">Wyszukiwanie:</span>
                  <span className="font-mono text-indigo-400 font-medium break-all">
                    "{query}"
                  </span>
                </div>
              )}

              {searchPath && (
                <div className="flex flex-col sm:flex-row sm:items-start gap-1">
                  <span className="text-muted shrink-0 font-medium sm:w-20">W folderze:</span>
                  <code className="text-muted break-all font-mono bg-card px-1.5 py-0.5 rounded border border-border/60">
                    {formatFriendlyPath(searchPath)}
                  </code>
                </div>
              )}

              {url && (
                <div className="flex flex-col sm:flex-row sm:items-start gap-1">
                  <span className="text-muted shrink-0 font-medium sm:w-20">Adres URL:</span>
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline break-all"
                  >
                    {url}
                  </a>
                </div>
              )}

              {actionDesc && (
                <div className="flex flex-col sm:flex-row sm:items-start gap-1">
                  <span className="text-muted shrink-0 font-medium sm:w-20">Opis:</span>
                  <span className="text-main leading-relaxed">{actionDesc}</span>
                </div>
              )}
            </div>
          )}

          {/* Diffs section if files were modified */}
          {tool.diffs && tool.diffs.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[10px] font-semibold text-muted uppercase tracking-wider">
                Zmiany w plikach ({tool.diffs.length})
              </div>
              <div className="flex flex-wrap gap-2">
                {tool.diffs.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewDiff?.(d.file_path);
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface border border-border text-[11px] text-primary hover:border-primary transition-colors cursor-pointer"
                  >
                    <FileCode className="w-3.5 h-3.5" />
                    <span className="font-mono">{formatFriendlyPath(d.file_path)}</span>
                    <span className="text-emerald-600 font-mono font-medium">+{d.additions}</span>
                    <span className="text-rose-600 font-mono font-medium">-{d.deletions}</span>
                    <ExternalLink className="w-2.5 h-2.5 ml-0.5 opacity-60" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Output / Result section */}
          <div>
            <div className="flex items-center justify-between mb-1.5 pb-1.5 border-b border-border/40">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium text-muted">
                  Wynik operacji
                </span>
                {tool.duration_ms !== null && tool.duration_ms !== undefined && (
                  <span className="text-[10px] text-subtle font-mono">
                    ({formatDuration(tool.duration_ms)})
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-main px-2 py-1 rounded-md hover:bg-surface-hover transition-colors cursor-pointer"
              >
                {copied ? (
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

            <pre className="font-mono text-[11px] leading-relaxed max-h-64 overflow-x-auto overflow-y-auto whitespace-pre-wrap text-muted bg-surface/50 p-2.5 rounded-lg border border-border/40">
              {tool.tool_result || '(Brak dodatkowego wyniku tekstowego)'}
            </pre>
          </div>

          {/* Collapsible raw JSON arguments */}
          {args && Object.keys(args).length > 0 && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowRawArgs(!showRawArgs)}
                className="text-[10px] text-subtle hover:text-muted flex items-center gap-1 transition-colors cursor-pointer"
              >
                {showRawArgs ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                <span>{showRawArgs ? 'Ukryj surowe parametry JSON' : 'Pokaż surowe parametry JSON'}</span>
              </button>

              {showRawArgs && (
                <pre className="mt-1.5 font-mono text-[10px] text-subtle bg-surface/30 p-2 rounded-lg border border-border/30 overflow-x-auto whitespace-pre">
                  {JSON.stringify(args, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

ToolExecutionCard.displayName = 'ToolExecutionCard';

