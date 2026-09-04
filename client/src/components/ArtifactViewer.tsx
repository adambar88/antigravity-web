import React, { useEffect, useState } from 'react';
import {
  Check,
  Copy,
  FileSpreadsheet,
  FileText,
  GitBranch,
  Layers,
  ListTodo,
  Sparkles,
} from 'lucide-react';
import { Artifact } from '@/types';
import { MarkdownRenderer } from './MarkdownRenderer';
import { formatRelativeTime } from '@/utils/formatters';

interface ArtifactViewerProps {
  artifacts: Artifact[];
}

export const ArtifactViewer: React.FC<ArtifactViewerProps> = ({ artifacts }) => {
  const [selectedId, setSelectedId] = useState<string | null>(
    artifacts.length > 0 ? artifacts[0].id : null
  );
  const [copied, setCopied] = useState(false);

  // Auto-select first or update when artifacts arrive
  useEffect(() => {
    if ((!selectedId || !artifacts.find((a) => a.id === selectedId)) && artifacts.length > 0) {
      setSelectedId(artifacts[0].id);
    }
  }, [artifacts, selectedId]);

  const activeArtifact = artifacts.find((a) => a.id === selectedId) || artifacts[0] || null;

  const handleCopy = () => {
    if (!activeArtifact) return;
    navigator.clipboard.writeText(activeArtifact.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getArtifactIcon = (type: string) => {
    switch (type) {
      case 'plan':
        return <ListTodo className="w-4 h-4 text-primary" />;
      case 'diagram':
        return <GitBranch className="w-4 h-4 text-purple-500" />;
      case 'table':
        return <FileSpreadsheet className="w-4 h-4 text-emerald-500" />;
      case 'diff':
        return <FileText className="w-4 h-4 text-sky-500" />;
      default:
        return <FileText className="w-4 h-4 text-amber-500" />;
    }
  };

  if (artifacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center text-subtle">
        <Sparkles className="w-8 h-8 mb-2 opacity-40 text-primary" />
        <h4 className="text-sm font-semibold text-main mb-1">Brak planów i dokumentów</h4>
        <p className="text-xs max-w-xs">
          W tym zadaniu nie wygenerowano jeszcze żadnych artefaktów. Poproś o plan działania poleceniem <code className="px-1 py-0.5 rounded bg-surface border border-border font-mono">/plan</code>.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col md:flex-row">
      {/* Sidebar of artifacts */}
      <div className="w-full md:w-60 p-2 border-b md:border-b-0 md:border-r border-border bg-surface/30 overflow-y-auto shrink-0 max-h-48 md:max-h-full space-y-1">
        <div className="px-2 py-1 text-[10px] font-semibold text-muted uppercase tracking-wider">
          Wygenerowane dokumenty ({artifacts.length})
        </div>
        {artifacts.map((art) => {
          const isSelected = activeArtifact?.id === art.id;
          return (
            <button
              key={art.id}
              type="button"
              onClick={() => setSelectedId(art.id)}
              className={`w-full flex items-start gap-2.5 p-2 rounded-xl text-left transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-primary/15 text-primary border border-primary/30'
                  : 'hover:bg-surface-hover text-main'
              }`}
            >
              <div className="mt-0.5 shrink-0">{getArtifactIcon(art.type)}</div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold truncate">{art.title}</div>
                <div className="text-[10px] text-muted flex items-center gap-1.5 mt-0.5">
                  <span className="capitalize">{art.type}</span>
                  <span>•</span>
                  <span>{formatRelativeTime(art.created_at)}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Artifact detail view */}
      <div className="flex-1 min-h-0 flex flex-col bg-card overflow-hidden">
        {activeArtifact ? (
          <>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface/50">
              <div className="flex items-center gap-2 min-w-0">
                <Layers className="w-4 h-4 text-primary shrink-0" />
                <div className="min-w-0">
                  <h3 className="text-xs font-semibold text-main truncate">
                    {activeArtifact.title}
                  </h3>
                  <p className="text-[10px] text-muted font-mono truncate">
                    {activeArtifact.identifier}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border bg-card text-xs font-medium text-muted hover:text-main hover:bg-surface-hover transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-emerald-500">Skopiowano</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Kopiuj treść</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex-1 p-5 overflow-y-auto">
              <MarkdownRenderer content={activeArtifact.content} />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};
