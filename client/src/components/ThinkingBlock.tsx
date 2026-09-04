import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Sparkles } from 'lucide-react';
import { formatDuration } from '@/utils/formatters';

interface ThinkingBlockProps {
  thought: string;
  durationMs?: number | null;
  isActive?: boolean;
}

export const ThinkingBlock: React.FC<ThinkingBlockProps> = React.memo(({
  thought,
  durationMs,
  isActive = false,
}) => {
  const [isOpen, setIsOpen] = useState(isActive);

  // If newly active, open it automatically
  React.useEffect(() => {
    if (isActive) {
      setIsOpen(true);
    }
  }, [isActive]);

  if (!thought && !isActive) return null;

  return (
    <div className="my-2 rounded-xl border border-border bg-surface/50 overflow-hidden transition-all duration-200">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3.5 py-2 text-left text-xs font-medium text-muted hover:text-main hover:bg-surface-hover/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {isActive ? (
            <Sparkles className="w-3.5 h-3.5 text-primary animate-spin" />
          ) : (
            <span className="text-sm">💭</span>
          )}
          <span className="font-semibold text-main">
            Tok myślenia
          </span>
          <span className="text-subtle font-mono text-[11px]">
            ({formatDuration(durationMs)})
          </span>
          {isActive && (
            <span className="inline-flex items-center gap-1 text-[11px] text-primary font-normal animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              analizowanie...
            </span>
          )}
        </div>
        <div className="flex items-center text-subtle">
          {isOpen ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </div>
      </button>

      {isOpen && (
        <div className="px-3.5 py-2.5 text-xs text-muted border-t border-border/40 font-mono whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto bg-card-muted/30">
          {thought ? (
            thought
          ) : isActive ? (
            <span className="italic text-subtle flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
              Wnioskowanie modelu i przygotowywanie narzędzi...
            </span>
          ) : (
            <span className="italic text-subtle">
              Brak dodatkowego toku myślenia dla tej odpowiedzi.
            </span>
          )}
        </div>
      )}
    </div>
  );
});

ThinkingBlock.displayName = 'ThinkingBlock';
