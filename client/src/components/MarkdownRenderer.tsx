import React, { useMemo, Suspense, lazy } from 'react';
import { marked } from 'marked';
import { isMermaidCode } from '@/utils/mermaidHelper';

const MermaidDiagram = lazy(() =>
  import('./MermaidDiagram').then((mod) => ({ default: mod.MermaidDiagram }))
);

const MermaidSkeleton: React.FC = () => (
  <div className="my-3 p-4 rounded-xl border border-border bg-surface/50 flex items-center justify-center gap-2 text-xs text-muted animate-pulse">
    <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    <span>Ładowanie diagramu...</span>
  </div>
);

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

type MarkdownSegment =
  | { type: 'html'; html: string }
  | { type: 'mermaid'; code: string };

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = React.memo(
  ({ content, className = '' }) => {
    const segments = useMemo<MarkdownSegment[]>(() => {
      if (!content || !content.trim()) return [];

      try {
        const tokens = marked.lexer(content, { gfm: true, breaks: true });
        const result: MarkdownSegment[] = [];
        let htmlTokens: ReturnType<typeof marked.lexer>[number][] = [];

        for (const token of tokens) {
          if (
            token.type === 'code' &&
            isMermaidCode(token.text, (token as any).lang)
          ) {
            // Flush accumulated standard markdown tokens
            if (htmlTokens.length > 0) {
              const html = marked.parser(htmlTokens);
              result.push({ type: 'html', html });
              htmlTokens = [];
            }
            result.push({ type: 'mermaid', code: token.text });
          } else {
            htmlTokens.push(token);
          }
        }

        if (htmlTokens.length > 0) {
          const html = marked.parser(htmlTokens);
          result.push({ type: 'html', html });
        }

        return result;
      } catch {
        // Fallback to simple marked.parse if tokenizing fails
        try {
          const html = marked.parse(content, { gfm: true, breaks: true }) as string;
          return [{ type: 'html', html }];
        } catch {
          return [{ type: 'html', html: content }];
        }
      }
    }, [content]);

    if (!content) return null;

    return (
      <div className={`markdown-content text-main text-sm leading-relaxed space-y-2 ${className}`}>
        {segments.map((segment, index) => {
          if (segment.type === 'mermaid') {
            return (
              <Suspense
                key={`mermaid-${index}-${segment.code.slice(0, 20)}`}
                fallback={<MermaidSkeleton />}
              >
                <MermaidDiagram chart={segment.code} />
              </Suspense>
            );
          }

          return (
            <div
              key={`segment-${index}`}
              className="markdown-segment"
              dangerouslySetInnerHTML={{ __html: segment.html }}
            />
          );
        })}
      </div>
    );
  }
);

MarkdownRenderer.displayName = 'MarkdownRenderer';
