import React, { useMemo, Suspense, lazy, useState } from 'react';
import { marked } from 'marked';
import { Check, Copy } from 'lucide-react';
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

interface CodeBlockSnippetProps {
  code: string;
  lang?: string;
}

const CodeBlockSnippet: React.FC<CodeBlockSnippetProps> = React.memo(({ code, lang }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const displayLang = (lang || 'kod').trim().toLowerCase();

  return (
    <div className="relative my-3 rounded-xl border border-border bg-code overflow-hidden shadow-2xs group">
      {/* Code Header Bar */}
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-surface border-b border-border/70 select-none text-[11px]">
        <span className="font-mono font-semibold uppercase tracking-wider text-muted">
          {displayLang}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium text-muted hover:text-main hover:bg-card border border-border/50 transition-colors cursor-pointer"
          title="Kopiuj zawartość kodu"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-500" />
              <span className="text-emerald-500 font-medium">Skopiowano</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Kopiuj</span>
            </>
          )}
        </button>
      </div>

      {/* Code Body */}
      <pre className="p-3.5 overflow-x-auto text-[12.5px] leading-relaxed font-mono text-main m-0 border-0 bg-transparent">
        <code>{code}</code>
      </pre>
    </div>
  );
});

CodeBlockSnippet.displayName = 'CodeBlockSnippet';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

type MarkdownSegment =
  | { type: 'html'; html: string }
  | { type: 'mermaid'; code: string }
  | { type: 'code'; code: string; lang?: string };

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
          } else if (token.type === 'code') {
            // Flush accumulated standard markdown tokens
            if (htmlTokens.length > 0) {
              const html = marked.parser(htmlTokens);
              result.push({ type: 'html', html });
              htmlTokens = [];
            }
            result.push({
              type: 'code',
              code: token.text,
              lang: (token as any).lang || '',
            });
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

          if (segment.type === 'code') {
            return (
              <CodeBlockSnippet
                key={`code-${index}-${segment.code.slice(0, 20)}`}
                code={segment.code}
                lang={segment.lang}
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
