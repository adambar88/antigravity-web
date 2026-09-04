import React, { useMemo, useState, useRef } from 'react';
import { Check, Columns, Copy, FileCode, Rows } from 'lucide-react';
import { FileDiff } from '@/types';
import { computeFileDiff } from '@/utils/diffHelper';
import { ResizeHandle } from './ResizeHandle';

interface DiffViewerProps {
  diff: FileDiff;
}

export const DiffViewer: React.FC<DiffViewerProps> = React.memo(({ diff }) => {
  const [viewMode, setViewMode] = useState<'inline' | 'split'>('inline');
  const [copied, setCopied] = useState(false);
  const splitContainerRef = useRef<HTMLDivElement | null>(null);

  const [splitPercent, setSplitPercent] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ag_diff_split_ratio');
      if (saved) {
        const val = parseFloat(saved);
        if (!isNaN(val) && val >= 20 && val <= 80) return val;
      }
    }
    return 50;
  });
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);

  const handleSplitPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
    setIsDraggingSplit(true);
  };

  const handleSplitPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingSplit || !splitContainerRef.current) return;
    const rect = splitContainerRef.current.getBoundingClientRect();
    if (rect.width <= 0) return;
    const offset = e.clientX - rect.left;
    const pct = Math.max(20, Math.min(80, Math.round((offset / rect.width) * 100)));
    setSplitPercent(pct);
  };

  const handleSplitPointerUp = (e: React.PointerEvent) => {
    if (isDraggingSplit) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      setIsDraggingSplit(false);
      if (typeof window !== 'undefined') {
        localStorage.setItem('ag_diff_split_ratio', splitPercent.toString());
      }
    }
  };

  const resetSplit = () => {
    setSplitPercent(50);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('ag_diff_split_ratio');
    }
  };

  const computed = useMemo(() => {
    return computeFileDiff(diff.before_content || '', diff.after_content || '');
  }, [diff.before_content, diff.after_content]);

  const handleCopy = () => {
    navigator.clipboard.writeText(diff.after_content || diff.before_content || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const additions = diff.additions || computed.additions;
  const deletions = diff.deletions || computed.deletions;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-surface border-b border-border">
        <div className="flex items-center gap-2.5 min-w-0">
          <FileCode className="w-4 h-4 text-primary shrink-0" />
          <span className="font-mono text-xs font-semibold text-main truncate">
            {diff.file_path}
          </span>
          <div className="flex items-center gap-1.5 shrink-0 text-xs font-mono font-medium">
            <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
              +{additions}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 border border-rose-500/20">
              -{deletions}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* View mode toggle */}
          <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('inline')}
              title="Widok ciągły (inline)"
              className={`p-1.5 rounded-md text-xs font-medium transition-colors ${
                viewMode === 'inline'
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-muted hover:text-main'
              }`}
            >
              <Rows className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('split')}
              title="Widok obok siebie (side-by-side)"
              className={`p-1.5 rounded-md text-xs font-medium transition-colors ${
                viewMode === 'split'
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-muted hover:text-main'
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border bg-card text-xs font-medium text-muted hover:text-main hover:bg-surface-hover transition-colors"
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
      </div>

      {/* Diff content view */}
      <div className="overflow-x-auto text-xs font-mono max-h-[500px] overflow-y-auto">
        {viewMode === 'inline' ? (
          <table className="w-full border-collapse">
            <tbody>
              {computed.unifiedLines.map((line, idx) => {
                let rowBg = 'hover:bg-surface-hover/40';
                let symbol = ' ';
                let textColor = 'text-main';

                if (line.type === 'added') {
                  rowBg = 'bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300';
                  symbol = '+';
                  textColor = 'text-emerald-800 dark:text-emerald-300 font-semibold';
                } else if (line.type === 'removed') {
                  rowBg = 'bg-rose-500/10 hover:bg-rose-500/15 text-rose-800 dark:text-rose-300';
                  symbol = '-';
                  textColor = 'text-rose-800 dark:text-rose-300 font-semibold';
                }

                return (
                  <tr key={idx} className={`${rowBg} transition-colors border-b border-border/20`}>
                    <td className="w-10 px-2 py-0.5 text-right text-[11px] text-subtle select-none border-r border-border/40">
                      {line.oldLineNumber || ''}
                    </td>
                    <td className="w-10 px-2 py-0.5 text-right text-[11px] text-subtle select-none border-r border-border/40">
                      {line.newLineNumber || ''}
                    </td>
                    <td className="w-5 px-1 py-0.5 text-center text-subtle select-none font-bold">
                      {symbol}
                    </td>
                    <td className={`px-2 py-0.5 whitespace-pre-wrap leading-tight break-all ${textColor}`}>
                      {line.content || ' '}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div ref={splitContainerRef} className="flex divide-x divide-border relative">
            {/* Left: Old */}
            <div style={{ width: `${splitPercent}%` }} className="overflow-x-auto shrink-0">
              <div className="px-3 py-1 bg-surface/50 text-[10px] font-semibold text-muted border-b border-border flex items-center justify-between">
                <span>Przed zmianą</span>
                <span className="text-[10px] text-subtle font-mono">{splitPercent}%</span>
              </div>
              <table className="w-full border-collapse">
                <tbody>
                  {computed.splitRows.map((row, idx) => {
                    const isRemoved = row.left?.type === 'removed';
                    return (
                      <tr
                        key={idx}
                        className={`border-b border-border/20 ${
                          isRemoved
                            ? 'bg-rose-500/10 text-rose-800 dark:text-rose-300'
                            : 'text-muted'
                        }`}
                      >
                        <td className="w-8 px-1.5 py-0.5 text-right text-[10px] text-subtle select-none border-r border-border/40">
                          {row.left?.lineNumber || ''}
                        </td>
                        <td className="px-2 py-0.5 whitespace-pre-wrap leading-tight break-all">
                          {row.left?.content || ' '}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Split Resizer Handle */}
            <div className="relative flex items-center justify-center z-20">
              <ResizeHandle
                direction="horizontal"
                isDragging={isDraggingSplit}
                onPointerDown={handleSplitPointerDown}
                onPointerMove={handleSplitPointerMove}
                onPointerUp={handleSplitPointerUp}
                onDoubleClick={resetSplit}
                title="Przeciągnij, aby zmienić proporcje kolumn (podwójne kliknięcie: 50/50)"
                className="w-2.5 h-full cursor-col-resize -mx-1.5"
              />
            </div>

            {/* Right: New */}
            <div style={{ width: `${100 - splitPercent}%` }} className="overflow-x-auto shrink-0">
              <div className="px-3 py-1 bg-surface/50 text-[10px] font-semibold text-muted border-b border-border flex items-center justify-between">
                <span>Po zmianie</span>
                <span className="text-[10px] text-subtle font-mono">{100 - splitPercent}%</span>
              </div>
              <table className="w-full border-collapse">
                <tbody>
                  {computed.splitRows.map((row, idx) => {
                    const isAdded = row.right?.type === 'added';
                    return (
                      <tr
                        key={idx}
                        className={`border-b border-border/20 ${
                          isAdded
                            ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
                            : 'text-main'
                        }`}
                      >
                        <td className="w-8 px-1.5 py-0.5 text-right text-[10px] text-subtle select-none border-r border-border/40">
                          {row.right?.lineNumber || ''}
                        </td>
                        <td className="px-2 py-0.5 whitespace-pre-wrap leading-tight break-all">
                          {row.right?.content || ' '}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

DiffViewer.displayName = 'DiffViewer';
