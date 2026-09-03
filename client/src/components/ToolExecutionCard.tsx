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
import { getToolDisplayInfo, getToolStatusText } from '@/utils/toolDisplay';
import { formatDuration } from '@/utils/formatters';

interface ToolExecutionCardProps {
  tool: ToolExecution;
  onViewDiff?: (filePath: string) => void;
}

export const ToolExecutionCard: React.FC<ToolExecutionCardProps> = React.memo(({ tool, onViewDiff }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

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

  const hasOutput = Boolean(tool.tool_result || (tool.diffs && tool.diffs.length > 0));

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
        className="w-full flex items-center justify-between p-3 text-left hover:bg-surface-hover/60 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="p-1.5 rounded-lg bg-surface border border-border shrink-0">
            {tool.status === 'running' ? (
              <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
            ) : (
              renderIcon()
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-main truncate">
                {info.title}
              </span>
              {tool.duration_ms !== null && tool.duration_ms !== undefined && (
                <span className="text-[10px] text-subtle font-mono">
                  {formatDuration(tool.duration_ms)}
                </span>
              )}
            </div>
            {info.subtitle && (
              <p className="text-[11px] text-muted truncate font-mono">
                {info.subtitle}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-3">
          <span
            className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${statusInfo.color}`}
          >
            {statusInfo.label}
          </span>

          {hasOutput && (
            <div className="text-subtle">
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
        <div className="border-t border-border bg-code px-3.5 py-2.5 text-xs text-main">
          <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-border/40">
            <span className="text-[11px] font-medium text-muted">
              Wynik operacji
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-main px-2 py-1 rounded-md hover:bg-surface-hover transition-colors"
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

          {tool.diffs && tool.diffs.length > 0 && (
            <div className="mb-2.5 flex flex-wrap gap-2">
              {tool.diffs.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewDiff?.(d.file_path);
                  }}
                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-surface border border-border text-[11px] text-primary hover:border-primary transition-colors"
                >
                  <FileCode className="w-3 h-3" />
                  <span>{d.file_path}</span>
                  <span className="text-emerald-600 font-mono font-medium">+{d.additions}</span>
                  <span className="text-rose-600 font-mono font-medium">-{d.deletions}</span>
                  <ExternalLink className="w-2.5 h-2.5 ml-0.5 opacity-60" />
                </button>
              ))}
            </div>
          )}

          <pre className="font-mono text-[11px] leading-relaxed max-h-56 overflow-x-auto overflow-y-auto whitespace-pre-wrap text-muted">
            {tool.tool_result || '(Brak dodatkowego wyniku tekstowego)'}
          </pre>
        </div>
      )}
    </div>
  );
});

ToolExecutionCard.displayName = 'ToolExecutionCard';
