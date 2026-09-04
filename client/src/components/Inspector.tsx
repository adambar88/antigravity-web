import React, { useState } from 'react';
import {
  FileCode,
  FolderTree,
  Layers,
  Sparkles,
  X,
} from 'lucide-react';
import { Artifact, FileDiff, InspectorTab } from '@/types';
import { DiffViewer } from './DiffViewer';
import { FileTreeViewer } from './FileTreeViewer';
import { ArtifactViewer } from './ArtifactViewer';
import { useWorkspaceTree } from '@/hooks/useWorkspaceTree';

interface InspectorProps {
  isOpen: boolean;
  onClose: () => void;
  diffs: FileDiff[];
  artifacts: Artifact[];
  activeTab?: InspectorTab;
  onTabChange?: (tab: InspectorTab) => void;
  highlightFilePath?: string | null;
  workspacePath?: string;
}

export const Inspector: React.FC<InspectorProps> = ({
  isOpen,
  onClose,
  diffs,
  artifacts,
  activeTab = 'diffs',
  onTabChange,
  highlightFilePath,
  workspacePath,
}) => {
  const [currentTab, setCurrentTab] = useState<InspectorTab>(activeTab);
  const [selectedDiffPath, setSelectedDiffPath] = useState<string | null>(null);

  // Sync prop changes
  React.useEffect(() => {
    if (activeTab) setCurrentTab(activeTab);
  }, [activeTab]);

  React.useEffect(() => {
    if (highlightFilePath) {
      setCurrentTab('diffs');
      setSelectedDiffPath(highlightFilePath);
    }
  }, [highlightFilePath]);

  const workspaceTree = useWorkspaceTree(workspacePath);

  const handleTabSelect = (tab: InspectorTab) => {
    setCurrentTab(tab);
    onTabChange?.(tab);
  };

  if (!isOpen) return null;

  const totalAdditions = diffs.reduce((acc, d) => acc + d.additions, 0);
  const totalDeletions = diffs.reduce((acc, d) => acc + d.deletions, 0);

  return (
    <aside className="w-full md:w-[350px] lg:w-[480px] xl:w-[560px] shrink-0 h-full flex flex-col bg-surface border-l border-border shadow-xl md:shadow-none z-20 overflow-hidden">
      {/* Tab Navigation Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-card">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => handleTabSelect('diffs')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              currentTab === 'diffs'
                ? 'bg-primary/10 text-primary'
                : 'text-muted hover:text-main hover:bg-surface-hover'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>Zmiany</span>
            {diffs.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-primary/20 text-primary font-mono">
                {diffs.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleTabSelect('files')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              currentTab === 'files'
                ? 'bg-primary/10 text-primary'
                : 'text-muted hover:text-main hover:bg-surface-hover'
            }`}
          >
            <FolderTree className="w-3.5 h-3.5" />
            <span>Pliki</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabSelect('artifacts')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              currentTab === 'artifacts'
                ? 'bg-primary/10 text-primary'
                : 'text-muted hover:text-main hover:bg-surface-hover'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Plany</span>
            {artifacts.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-primary/20 text-primary font-mono">
                {artifacts.length}
              </span>
            )}
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          title="Zamknij panel boczny"
          className="p-1.5 rounded-lg text-subtle hover:text-main hover:bg-surface-hover transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main Tab Body */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {currentTab === 'diffs' && (
          <div className="h-full flex flex-col p-3 space-y-3">
            {diffs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center text-subtle">
                <Sparkles className="w-8 h-8 mb-2 opacity-40 text-primary" />
                <h4 className="text-sm font-semibold text-main mb-1">Brak zmian w projekcie</h4>
                <p className="text-xs max-w-xs">
                  W tym zadaniu asystent nie modyfikował jeszcze żadnych plików. Poproś o wprowadzenie modyfikacji w kodzie.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between px-2 py-1 bg-surface-hover/50 rounded-xl border border-border text-xs">
                  <span className="text-muted font-medium">Łącznie zmodyfikowano: {diffs.length} plików</span>
                  <div className="flex items-center gap-1.5 font-mono">
                    <span className="text-emerald-600 font-semibold">+{totalAdditions}</span>
                    <span className="text-rose-600 font-semibold">-{totalDeletions}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  {diffs.map((diff) => (
                    <div
                      key={diff.id}
                      className={selectedDiffPath === diff.file_path ? 'ring-2 ring-primary rounded-2xl' : ''}
                    >
                      <DiffViewer diff={diff} />
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {currentTab === 'files' && (
          <FileTreeViewer
            tree={workspaceTree.tree}
            expandedFolders={workspaceTree.expandedFolders}
            selectedFilePath={workspaceTree.selectedFilePath}
            selectedFileContent={workspaceTree.selectedFileContent}
            isLoadingTree={workspaceTree.isLoadingTree}
            isLoadingFile={workspaceTree.isLoadingFile}
            onToggleFolder={workspaceTree.toggleFolder}
            onOpenFile={workspaceTree.openFile}
            onRefresh={workspaceTree.refreshTree}
            rootPath={workspaceTree.rootPath}
          />
        )}

        {currentTab === 'artifacts' && <ArtifactViewer artifacts={artifacts} />}
      </div>
    </aside>
  );
};
