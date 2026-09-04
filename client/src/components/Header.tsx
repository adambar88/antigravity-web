import React, { useState } from 'react';
import {
  Check,
  FolderGit2,
  Menu,
  Moon,
  PanelRight,
  Pencil,
  Sun,
} from 'lucide-react';
import { SSEConnectionStatus } from '@/services/sse';
import { Theme } from '@/hooks/useTheme';
import { ChangeWorkspaceModal } from './ChangeWorkspaceModal';

interface HeaderProps {
  sessionTitle: string;
  workspacePath?: string;
  connectionStatus: SSEConnectionStatus;
  theme: Theme;
  onToggleTheme: () => void;
  onToggleSidebar: () => void;
  onToggleInspector: () => void;
  onUpdateTitle?: (newTitle: string) => void;
  onUpdateWorkspace?: (newWorkspacePath: string) => void;
  isInspectorOpen?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  sessionTitle,
  workspacePath = '/home/adam',
  connectionStatus,
  theme,
  onToggleTheme,
  onToggleSidebar,
  onToggleInspector,
  onUpdateTitle,
  onUpdateWorkspace,
  isInspectorOpen = false,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(sessionTitle);
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);

  // Sync title when session changes
  React.useEffect(() => {
    setTempTitle(sessionTitle);
  }, [sessionTitle]);

  const handleTitleSubmit = () => {
    if (tempTitle.trim() && onUpdateTitle) {
      onUpdateTitle(tempTitle.trim());
    }
    setIsEditingTitle(false);
  };

  const getWorkspaceName = (path: string) => {
    const parts = path.split('/').filter(Boolean);
    return parts[parts.length - 1] || 'Projekt';
  };

  const renderConnectionBadge = () => {
    switch (connectionStatus) {
      case 'streaming':
        return (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-primary/10 text-primary border border-primary/20 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
            <span>Trwa generowanie...</span>
          </div>
        );
      case 'connected':
        return (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Połączono z Antigravity</span>
          </div>
        );
      case 'connecting':
        return (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-600 border border-amber-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            <span>Łączenie...</span>
          </div>
        );
      case 'disconnected':
      default:
        return (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-neutral-500/10 text-neutral-500 border border-neutral-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
            <span>Gotowy</span>
          </div>
        );
    }
  };

  return (
    <header className="h-14 px-3 sm:px-4 border-b border-border bg-surface flex items-center justify-between shrink-0 select-none z-10">
      {/* Left side: Mobile menu toggle + Workspace name + Title */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <button
          type="button"
          onClick={onToggleSidebar}
          title="Przełącz listę zadań"
          className="p-1.5 rounded-lg text-muted hover:text-main hover:bg-surface-hover md:hidden transition-colors cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Workspace directory indicator */}
        <button
          type="button"
          onClick={() => setIsWorkspaceModalOpen(true)}
          title={`Obszar roboczy: ${workspacePath} (kliknij, aby zmienić)`}
          className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-card border border-border text-xs text-muted hover:text-main hover:border-primary/40 hover:bg-surface-hover transition-colors cursor-pointer shrink-0"
        >
          <FolderGit2 className="w-3.5 h-3.5 text-primary" />
          <span className="font-semibold text-main truncate max-w-[140px]">
            {getWorkspaceName(workspacePath)}
          </span>
          <span className="text-[10px] text-muted">▾</span>
        </button>

        <div className="h-4 w-px bg-border hidden sm:block shrink-0" />

        {/* Session title with inline edit */}
        <div className="min-w-0 max-w-sm sm:max-w-md flex items-center gap-1.5">
          {isEditingTitle ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={tempTitle}
                onChange={(e) => setTempTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleTitleSubmit();
                  if (e.key === 'Escape') setIsEditingTitle(false);
                }}
                autoFocus
                className="px-2 py-0.5 text-xs font-semibold rounded-md border border-primary bg-card text-main focus:outline-hidden"
              />
              <button
                type="button"
                onClick={handleTitleSubmit}
                className="p-1 text-emerald-500 hover:text-emerald-600 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsEditingTitle(true)}
              className="group flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-main truncate hover:text-primary transition-colors cursor-pointer text-left"
            >
              <span className="truncate">{sessionTitle || 'Nowe zadanie'}</span>
              <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
            </button>
          )}
        </div>
      </div>

      {/* Right side: Status indicator, theme switcher, inspector toggle */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="hidden sm:block">{renderConnectionBadge()}</div>

        {/* Theme toggle: Warm light <-> Dark canvas */}
        <button
          type="button"
          onClick={onToggleTheme}
          title={theme === 'warm-light' ? 'Przełącz na ciemny motyw' : 'Przełącz na ciepły jasny motyw'}
          className="p-2 rounded-xl border border-border bg-card text-muted hover:text-main hover:bg-surface-hover transition-colors cursor-pointer"
        >
          {theme === 'warm-light' ? (
            <Sun className="w-4 h-4 text-amber-500" />
          ) : (
            <Moon className="w-4 h-4 text-purple-400" />
          )}
        </button>

        {/* Inspector panel toggle */}
        <button
          type="button"
          onClick={onToggleInspector}
          title="Przełącz panel boczny ze zmianami"
          className={`hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-colors cursor-pointer ${
            isInspectorOpen
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border bg-card text-muted hover:text-main hover:bg-surface-hover'
          }`}
        >
          <PanelRight className="w-4 h-4" />
          <span>Szczegóły</span>
        </button>
      </div>

      {isWorkspaceModalOpen && onUpdateWorkspace && (
        <ChangeWorkspaceModal
          isOpen={isWorkspaceModalOpen}
          onClose={() => setIsWorkspaceModalOpen(false)}
          currentWorkspacePath={workspacePath}
          onSave={onUpdateWorkspace}
        />
      )}
    </header>
  );
};
