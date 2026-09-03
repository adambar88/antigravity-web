import React, { useMemo } from 'react';
import { marked } from 'marked';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = React.memo(({ content, className = '' }) => {
  const htmlContent = useMemo(() => {
    if (!content) return '';
    try {
      return marked.parse(content, { gfm: true, breaks: true }) as string;
    } catch {
      return content;
    }
  }, [content]);

  return (
    <div
      className={`markdown-content text-main text-sm leading-relaxed ${className}`}
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  );
});

MarkdownRenderer.displayName = 'MarkdownRenderer';
