import React, { useMemo } from 'react';
import { marked } from 'marked';
import { MermaidDiagram, isMermaidCode } from './MermaidDiagram';

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
              <MermaidDiagram
                key={`mermaid-${index}-${segment.code.slice(0, 20)}`}
                chart={segment.code}
              />
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
