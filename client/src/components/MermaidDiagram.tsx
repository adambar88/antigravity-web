import React, { useEffect, useRef, useState, useCallback, useId } from 'react';
import {
  AlertCircle,
  Check,
  ChevronsUpDown,
  Code2,
  Copy,
  Download,
  Eye,
  Maximize2,
  Minimize2,
  RotateCcw,
  Workflow,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

let mermaidPromise: Promise<any> | null = null;

async function getMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((m) => m.default || m);
  }
  return mermaidPromise;
}

interface MermaidDiagramProps {
  chart: string;
  className?: string;
  title?: string;
}

import { sanitizeMermaidChart, isMermaidCode } from '@/utils/mermaidHelper';
export { sanitizeMermaidChart, isMermaidCode };

function detectDiagramType(code: string): string {
  const trimmed = code.trim();
  if (/^flowchart\b/m.test(trimmed)) return 'Flowchart';
  if (/^graph\b/m.test(trimmed)) return 'Graf (Graph)';
  if (/^sequenceDiagram\b/m.test(trimmed)) return 'Diagram sekwencji';
  if (/^classDiagram\b/m.test(trimmed)) return 'Diagram klas';
  if (/^stateDiagram\b/m.test(trimmed)) return 'Diagram stanów';
  if (/^erDiagram\b/m.test(trimmed)) return 'Diagram ERD (Relacji)';
  if (/^gantt\b/m.test(trimmed)) return 'Wykres Gantta';
  if (/^pie\b/m.test(trimmed)) return 'Wykres kołowy';
  if (/^gitGraph\b/m.test(trimmed)) return 'Git Graph';
  if (/^mindmap\b/m.test(trimmed)) return 'Mapa myśli (Mindmap)';
  if (/^timeline\b/m.test(trimmed)) return 'Oś czasu (Timeline)';
  return 'Diagram Mermaid';
}

export const MermaidDiagram: React.FC<MermaidDiagramProps> = ({
  chart,
  className = '',
  title,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rawUniqueId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const renderId = useRef(`mmd-${rawUniqueId}-${Math.random().toString(36).slice(2, 7)}`);

  const [svgContent, setSvgContent] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'diagram' | 'code'>('diagram');
  const [zoom, setZoom] = useState<number>(1);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isAutoHeight, setIsAutoHeight] = useState<boolean>(false);

  const diagramType = title || detectDiagramType(chart);

  // Initialize mermaid configuration according to the active theme
  const configureMermaid = useCallback(async () => {
    const mermaid = await getMermaid();
    const isDark = document.documentElement.getAttribute('data-theme') !== 'warm-light';

    if (typeof document !== 'undefined' && 'fonts' in document) {
      try {
        await document.fonts.ready;
      } catch {
        // Font readiness check failure is non-fatal
      }
    }

    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'loose',
      suppressErrorRendering: true,
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      fontSize: 14,
      theme: 'base',
      flowchart: {
        htmlLabels: true,
        useMaxWidth: false,
        curve: 'basis',
        padding: 15,
        nodeSpacing: 45,
        rankSpacing: 45,
      },
      themeVariables: isDark
        ? {
            darkMode: true,
            background: '#111827',
            mainBkg: '#1f2937',
            nodeBorder: '#374151',
            clusterBkg: '#111827',
            clusterBorder: '#374151',
            titleColor: '#f9fafb',
            textColor: '#f3f4f6',
            lineColor: '#9ca3af',
            primaryColor: '#1f2937',
            primaryTextColor: '#f9fafb',
            primaryBorderColor: '#d97757',
            secondaryColor: '#111827',
            tertiaryColor: '#1f2937',
          }
        : {
            darkMode: false,
            background: '#ffffff',
            mainBkg: '#ffffff',
            nodeBorder: '#cbd5e1',
            clusterBkg: '#f8fafc',
            clusterBorder: '#e2e8f0',
            titleColor: '#0f172a',
            textColor: '#1e293b',
            lineColor: '#64748b',
            primaryColor: '#f8fafc',
            primaryTextColor: '#0f172a',
            primaryBorderColor: '#c15f34',
            secondaryColor: '#f1f5f9',
            tertiaryColor: '#ffffff',
          },
    });
  }, []);

  const renderDiagram = useCallback(async () => {
    if (!chart || !chart.trim()) {
      setSvgContent('');
      setError(null);
      setIsRendering(false);
      return;
    }

    setIsRendering(true);

    try {
      await configureMermaid();
      const mermaid = await getMermaid();

      const sanitizedChart = sanitizeMermaidChart(chart);

      // Validate syntax first
      await mermaid.parse(sanitizedChart);

      // Generate a new unique ID for each render pass to prevent DOM collisions
      const elementId = `mmd-${Math.random().toString(36).slice(2, 9)}`;
      const { svg } = await mermaid.render(elementId, sanitizedChart);

      setSvgContent(svg);
      setError(null);
    } catch (err: any) {
      // Clean up any stray error elements created by mermaid
      const strayErr = document.getElementById(`d${renderId.current}`);
      if (strayErr) strayErr.remove();

      setError(err?.message || 'Nie udało się wyrenderować diagramu');
      setSvgContent('');
    } finally {
      setIsRendering(false);
    }
  }, [chart, configureMermaid]);

  // Initial render & reaction to chart changes
  useEffect(() => {
    renderDiagram();
  }, [renderDiagram]);

  // Re-render when theme changes
  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (
          mutation.type === 'attributes' &&
          (mutation.attributeName === 'data-theme' || mutation.attributeName === 'class')
        ) {
          renderDiagram();
        }
      }
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'class'],
    });

    return () => observer.disconnect();
  }, [renderDiagram]);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(chart);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleDownloadSvg = () => {
    if (!svgContent) return;
    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${diagramType.toLowerCase().replace(/[^a-z0-9]/g, '-')}-diagram.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleZoomIn = () => setZoom((z) => Math.min(Number((z + 0.2).toFixed(1)), 2.5));
  const handleZoomOut = () => setZoom((z) => Math.max(Number((z - 0.2).toFixed(1)), 0.4));
  const handleResetZoom = () => setZoom(1);

  return (
    <div
      className={`relative my-4 rounded-2xl border border-border bg-card shadow-sm overflow-hidden transition-all ${
        isFullscreen ? 'fixed inset-2 sm:inset-6 z-50 flex flex-col shadow-2xl' : ''
      } ${className}`}
    >
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-2.5 border-b border-border bg-surface/80 backdrop-blur-sm select-none">
        {/* Left: Icon, Title & Type */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 rounded-lg bg-primary/10 text-primary shrink-0">
            <Workflow className="w-4 h-4" />
          </div>
          <span className="text-xs font-semibold text-main truncate tracking-wide">
            {diagramType}
          </span>
          <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface border border-border/80 text-muted uppercase tracking-wider">
            Mermaid
          </span>
        </div>

        {/* Right: Controls (Zoom, Copy, Download, Toggle, Fullscreen) */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {viewMode === 'diagram' && !error && svgContent && (
            <div className="flex items-center bg-surface border border-border rounded-lg p-0.5 mr-1">
              <button
                type="button"
                onClick={handleZoomOut}
                disabled={zoom <= 0.4}
                className="p-1 rounded hover:bg-card text-muted hover:text-main disabled:opacity-30 transition-colors"
                title="Pomniejsz (-20%)"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleResetZoom}
                className="px-1.5 py-0.5 text-[10px] font-mono text-muted hover:text-main rounded hover:bg-card transition-colors"
                title="Zresetuj powiększenie (100%)"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                onClick={handleZoomIn}
                disabled={zoom >= 2.5}
                className="p-1 rounded hover:bg-card text-muted hover:text-main disabled:opacity-30 transition-colors"
                title="Powiększ (+20%)"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              {zoom !== 1 && (
                <button
                  type="button"
                  onClick={handleResetZoom}
                  className="p-1 rounded hover:bg-card text-primary transition-colors"
                  title="Resetuj zoom"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          {/* Download SVG */}
          {svgContent && viewMode === 'diagram' && (
            <button
              type="button"
              onClick={handleDownloadSvg}
              className="p-1.5 rounded-lg border border-border bg-surface hover:bg-surface-hover text-muted hover:text-main transition-colors"
              title="Pobierz diagram jako SVG"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Copy Code */}
          <button
            type="button"
            onClick={handleCopyCode}
            className="flex items-center gap-1 px-2 py-1 rounded-lg border border-border bg-surface hover:bg-surface-hover text-[11px] font-medium text-muted hover:text-main transition-colors"
            title="Skopiuj kod Mermaid do schowka"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-emerald-500 hidden sm:inline">Skopiowano</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Kopiuj</span>
              </>
            )}
          </button>

          {/* Toggle View: Diagram vs Code */}
          <div className="flex items-center bg-surface border border-border rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('diagram')}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-all ${
                viewMode === 'diagram'
                  ? 'bg-card text-primary shadow-xs font-semibold'
                  : 'text-muted hover:text-main'
              }`}
              title="Widok graficzny diagramu"
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Diagram</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('code')}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-all ${
                viewMode === 'code'
                  ? 'bg-card text-primary shadow-xs font-semibold'
                  : 'text-muted hover:text-main'
              }`}
              title="Widok kodu źródłowego"
            >
              <Code2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Kod</span>
            </button>
          </div>

          {/* Toggle Full Height */}
          <button
            type="button"
            onClick={() => setIsAutoHeight(!isAutoHeight)}
            className={`p-1.5 rounded-lg border text-muted hover:text-main transition-colors ${
              isAutoHeight
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-surface hover:bg-surface-hover'
            }`}
            title={isAutoHeight ? 'Ogranicz wysokość diagramu' : 'Rozwiń pełną wysokość diagramu (bez ucinania)'}
          >
            <ChevronsUpDown className="w-3.5 h-3.5" />
          </button>

          {/* Fullscreen Expansion */}
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-lg border border-border bg-surface hover:bg-surface-hover text-muted hover:text-main transition-colors"
            title={isFullscreen ? 'Zmniejsz okno diagramu' : 'Powiększ na pełny ekran'}
          >
            {isFullscreen ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div
        ref={containerRef}
        className={`mermaid-diagram-container relative overflow-auto p-4 sm:p-6 transition-all ${
          isFullscreen ? 'flex-1 max-h-none' : isAutoHeight ? 'max-h-none' : 'max-h-[850px] min-h-[140px]'
        }`}
      >
        {/* Loading State */}
        {isRendering && !svgContent && !error && (
          <div className="flex flex-col items-center justify-center py-10 text-muted space-y-2">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-xs">Renderowanie diagramu...</span>
          </div>
        )}

        {/* Visual Diagram View */}
        {viewMode === 'diagram' && (
          <>
            {error ? (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 text-xs space-y-3">
                <div className="flex items-center gap-2 text-rose-500 font-semibold">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Nie udało się wyrenderować diagramu</span>
                </div>
                <div className="text-muted text-[11px] font-mono whitespace-pre-wrap break-all bg-card/60 p-2.5 rounded-lg border border-border/50">
                  {error}
                </div>
                <div className="text-[11px] text-muted">
                  Kod źródłowy diagramu:
                </div>
                <pre className="p-3 rounded-lg bg-surface border border-border font-mono text-[11px] text-main overflow-x-auto">
                  <code>{chart}</code>
                </pre>
              </div>
            ) : svgContent ? (
              <div
                className="flex items-center justify-center min-w-full transition-transform duration-150 origin-top"
                style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
                dangerouslySetInnerHTML={{ __html: svgContent }}
              />
            ) : null}
          </>
        )}

        {/* Source Code View */}
        {viewMode === 'code' && (
          <div className="space-y-2">
            <div className="text-[11px] text-muted flex items-center justify-between">
              <span>Definicja Mermaid:</span>
              <span className="font-mono text-[10px]">{chart.split('\n').length} linii</span>
            </div>
            <pre className="p-4 rounded-xl bg-surface border border-border font-mono text-xs text-main overflow-x-auto leading-relaxed">
              <code>{chart}</code>
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

MermaidDiagram.displayName = 'MermaidDiagram';
