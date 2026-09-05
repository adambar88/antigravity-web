/**
 * Lightweight helper functions for Mermaid detection and chart sanitization.
 * Separated from MermaidDiagram.tsx to allow lazy-loading of the 3MB+ Mermaid bundle.
 */

export function isMermaidCode(text: string, lang?: string): boolean {
  if (lang && lang.toLowerCase() === 'mermaid') return true;
  const trimmed = text.trim();
  return /^(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram|stateDiagram-v2|erDiagram|gantt|pie|gitGraph|mindmap|timeline|quadrantChart|C4Context|C4Container|C4Component|C4Dynamic|C4Deployment|sankey-beta|block-beta|xychart-beta)\b/m.test(
    trimmed
  );
}

export function sanitizeMermaidChart(code: string): string {
  if (!code) return '';
  return code.replace(/(\[[^\]\n]+\]|\([^\)\n]+\)|\{[^\}\n]+\})/g, (match) => {
    return match.replace(/&(?!(?:amp|lt|gt|quot|#\d+|#x[0-9a-fA-F]+);)/g, '#38;');
  });
}
