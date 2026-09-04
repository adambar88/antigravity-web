import React, { useState, useEffect, useCallback } from 'react';
import {
  FileCode,
  FolderTree,
  Layers,
  Maximize2,
  Minimize2,
  RefreshCw,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { Artifact, FileDiff, InspectorTab, SubagentSession } from '@/types';
import { api } from '@/services/api';
import { DiffViewer } from './DiffViewer';
import { FileTreeViewer } from './FileTreeViewer';
import { ArtifactViewer } from './ArtifactViewer';
import { SubagentViewer } from './SubagentViewer';
import { useWorkspaceTree } from '@/hooks/useWorkspaceTree';
import { useResizable } from '@/hooks/useResizable';
import { ResizeHandle } from './ResizeHandle';

interface InspectorProps {
  isOpen: boolean;
  onClose: () => void;
  diffs: FileDiff[];
  artifacts: Artifact[];
  activeTab?: InspectorTab;
  onTabChange?: (tab: InspectorTab) => void;
  highlightFilePath?: string | null;
  workspacePath?: string;
  onDiffsCountChange?: (count: number) => void;
  sessionId?: string | null;
  subagents?: SubagentSession[];
  selectedSubagentId?: string | null;
  onRefreshSubagents?: () => void;
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
  onDiffsCountChange,
  sessionId,
  subagents = [],
  selectedSubagentId,
  onRefreshSubagents,
}) => {
  const [currentTab, setCurrentTab] = useState<InspectorTab>(activeTab);
  const [selectedDiffPath, setSelectedDiffPath] = useState<string | null>(null);
  const [workspaceDiffs, setWorkspaceDiffs] = useState<FileDiff[]>([]);
  const [isLoadingDiffs, setIsLoadingDiffs] = useState(false);
  const [diffSource, setDiffSource] = useState<'session' | 'workspace'>('session');
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  );

  const fetchWorkspaceDiffs = useCallback(async () => {
    setIsLoadingDiffs(true);
    try {
      const res = await api.getWorkspaceDiffs(workspacePath);
      setWorkspaceDiffs(res.diffs || []);
      if (res.diffs && res.diffs.length > 0 && diffs.length === 0) {
        setDiffSource('workspace');
      }
    } catch (err) {
      console.warn('Nie udało się pobrać diffów roboczych Git:', err);
    } finally {
      setIsLoadingDiffs(false);
    }
  }, [workspacePath, diffs.length]);

  // Automatically fetch workspace diffs when Inspector is opened on diffs tab
  useEffect(() => {
    if (isOpen && currentTab === 'diffs') {
      fetchWorkspaceDiffs();
    }
  }, [isOpen, currentTab, workspacePath, fetchWorkspaceDiffs]);

  // Keep diffSource in sync
  useEffect(() => {
    if (diffs.length > 0) {
      setDiffSource('session');
    } else if (workspaceDiffs.length > 0) {
      setDiffSource('workspace');
    }
  }, [diffs.length, workspaceDiffs.length]);

  // Determine active displayed diffs
  const activeDiffs =
    diffs.length > 0 && diffSource === 'session'
      ? diffs
      : workspaceDiffs.length > 0
      ? workspaceDiffs
      : diffs;

  useEffect(() => {
    onDiffsCountChange?.(activeDiffs.length);
  }, [activeDiffs.length, onDiffsCountChange]);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Desktop horizontal resize (width)
  const {
    size: desktopWidth,
    isDragging: isDraggingDesktop,
    resetSize: resetDesktopWidth,
    handlePointerDown: handleDesktopDown,
    handlePointerMove: handleDesktopMove,
    handlePointerUp: handleDesktopUp,
  } = useResizable({
    initialSize: 480,
    minSize: 300,
    maxSize: () => Math.min(window.innerWidth * 0.75, window.innerWidth - 320),
    direction: 'horizontal',
    reverse: true,
    storageKey: 'ag_inspector_width',
  });

  // Mobile vertical resize (bottom sheet height)
  const {
    size: mobileHeight,
    setSize: setMobileHeight,
    isDragging: isDraggingMobile,
    resetSize: resetMobileHeight,
    handlePointerDown: handleMobileDown,
    handlePointerMove: handleMobileMove,
    handlePointerUp: handleMobileUp,
  } = useResizable({
    initialSize: typeof window !== 'undefined' ? Math.min(Math.round(window.innerHeight * 0.65), 520) : 420,
    minSize: 180,
    maxSize: () => (typeof window !== 'undefined' ? window.innerHeight - 130 : 600),
    direction: 'vertical',
    reverse: true,
    storageKey: 'ag_inspector_height_mobile',
  });

  const isMaximizedMobile =
    typeof window !== 'undefined' && mobileHeight >= window.innerHeight - 140;

  const toggleMaximizeMobile = () => {
    if (isMaximizedMobile) {
      resetMobileHeight();
    } else if (typeof window !== 'undefined') {
      setMobileHeight(window.innerHeight - 130);
    }
  };

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

  const totalAdditions = activeDiffs.reduce((acc, d) => acc + d.additions, 0);
  const totalDeletions = activeDiffs.reduce((acc, d) => acc + d.deletions, 0);

  return (
    <aside
      style={{
        width: isDesktop ? `${desktopWidth}px` : '100%',
        height: isDesktop ? '100%' : `${mobileHeight}px`,
      }}
      className="fixed md:relative inset-x-0 bottom-14 md:bottom-auto md:h-full shrink-0 flex flex-col bg-surface border-t md:border-t-0 md:border-l border-border rounded-t-2xl md:rounded-none shadow-2xl md:shadow-none z-40 md:z-20 overflow-hidden"
    >
      {/* Desktop Resize Handle on Left Edge */}
      <div className="hidden md:block absolute left-0 top-0 bottom-0 -translate-x-1/2 z-50">
        <ResizeHandle
          direction="horizontal"
          isDragging={isDraggingDesktop}
          onPointerDown={handleDesktopDown}
          onPointerMove={handleDesktopMove}
          onPointerUp={handleDesktopUp}
          onDoubleClick={resetDesktopWidth}
          title="Zmień szerokość panelu inspekcji (podwójne kliknięcie resetuje)"
        />
      </div>

      {/* Mobile Top Drag Handle (Bottom Sheet Pill) */}
      <div className="md:hidden w-full flex flex-col items-center pt-2 pb-1 bg-card border-b border-border/40 shrink-0">
        <ResizeHandle
          direction="vertical"
          showPill={true}
          isDragging={isDraggingMobile}
          onPointerDown={handleMobileDown}
          onPointerMove={handleMobileMove}
          onPointerUp={handleMobileUp}
          onDoubleClick={toggleMaximizeMobile}
          title="Przeciągnij, aby zmienić wysokość (podwójne stuknięcie: maksymalizuj)"
          className="w-full h-4"
        />
      </div>
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
            {activeDiffs.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-primary/20 text-primary font-mono">
                {activeDiffs.length}
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

          <button
            type="button"
            onClick={() => handleTabSelect('subagents')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              currentTab === 'subagents'
                ? 'bg-primary/10 text-primary'
                : 'text-muted hover:text-main hover:bg-surface-hover'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Podsesje</span>
            {subagents.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-primary/20 text-primary font-mono">
                {subagents.length}
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={toggleMaximizeMobile}
            title={isMaximizedMobile ? 'Przywróć domyślną wysokość' : 'Maksymalizuj'}
            className="p-1.5 rounded-lg text-subtle hover:text-main hover:bg-surface-hover md:hidden transition-colors cursor-pointer"
          >
            {isMaximizedMobile ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Zamknij panel boczny"
            className="p-1.5 rounded-lg text-subtle hover:text-main hover:bg-surface-hover transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Tab Body */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {currentTab === 'diffs' && (
          <div className="h-full flex flex-col p-3 space-y-3">
            {activeDiffs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center text-subtle">
                <Sparkles className="w-8 h-8 mb-2 opacity-40 text-primary" />
                <h4 className="text-sm font-semibold text-main mb-1">Brak zmian w projekcie</h4>
                <p className="text-xs max-w-xs mb-3">
                  W tym zadaniu asystent nie modyfikował jeszcze żadnych plików, a drzewo robocze Git jest czyste.
                </p>
                <button
                  type="button"
                  onClick={fetchWorkspaceDiffs}
                  disabled={isLoadingDiffs}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-surface-hover hover:bg-border text-main border border-border transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingDiffs ? 'animate-spin text-primary' : ''}`} />
                  <span>Odśwież stan Git</span>
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between px-2.5 py-1.5 bg-surface-hover/50 rounded-xl border border-border text-xs">
                  <div className="flex items-center gap-2">
                    {diffs.length > 0 && workspaceDiffs.length > 0 ? (
                      <div className="inline-flex rounded-lg border border-border bg-card p-0.5 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setDiffSource('session')}
                          className={`px-2 py-0.5 rounded-md font-medium transition-colors cursor-pointer ${
                            diffSource === 'session' ? 'bg-primary text-white font-semibold' : 'text-muted hover:text-main'
                          }`}
                        >
                          Sesja ({diffs.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setDiffSource('workspace')}
                          className={`px-2 py-0.5 rounded-md font-medium transition-colors cursor-pointer ${
                            diffSource === 'workspace' ? 'bg-primary text-white font-semibold' : 'text-muted hover:text-main'
                          }`}
                        >
                          Git ({workspaceDiffs.length})
                        </button>
                      </div>
                    ) : (
                      <span className="text-muted font-medium">
                        {diffs.length > 0 && diffSource === 'session'
                          ? `Zmiany w sesji: ${diffs.length} ${diffs.length === 1 ? 'plik' : 'plików'}`
                          : `Zmiany robocze Git: ${activeDiffs.length} ${activeDiffs.length === 1 ? 'plik' : 'plików'}`}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={fetchWorkspaceDiffs}
                      disabled={isLoadingDiffs}
                      title="Odśwież stan zmian Git"
                      className="p-1 rounded-md text-subtle hover:text-main hover:bg-surface transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoadingDiffs ? 'animate-spin text-primary' : ''}`} />
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5 font-mono text-[11px]">
                    <span className="text-emerald-600 font-semibold">+{totalAdditions}</span>
                    <span className="text-rose-600 font-semibold">-{totalDeletions}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  {activeDiffs.map((diff) => (
                    <div
                      key={diff.id || diff.file_path}
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
            onRefresh={() => workspaceTree.refreshTree()}
            rootPath={workspaceTree.rootPath}
          />
        )}

        {currentTab === 'artifacts' && <ArtifactViewer artifacts={artifacts} />}

        {currentTab === 'subagents' && (
          <SubagentViewer
            sessionId={sessionId || ''}
            subagents={subagents}
            selectedSubagentId={selectedSubagentId}
            onRefresh={onRefreshSubagents}
          />
        )}
      </div>
    </aside>
  );
};
