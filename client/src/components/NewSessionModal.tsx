import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderGit2,
  FolderOpen,
  FolderTree,
  Home,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import { ReasoningEffort } from '@/types';
import { api } from '@/services/api';
import { ChangeWorkspaceModal } from './ChangeWorkspaceModal';

export interface NewSessionSubmitParams {
  title: string;
  workspace_path: string;
  model: string;
  effort: ReasoningEffort;
  initialPrompt?: string;
}

interface NewSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (params: NewSessionSubmitParams) => void;
  defaultWorkspacePath?: string;
}

const COMMON_DIRECTORIES = [
  { label: 'my-domain', path: '/home/adam/projects/my-domain', icon: FolderGit2 },
  { label: 'Katalog domowy (~/)', path: '/home/adam', icon: Home },
  { label: 'minesweeper-repo', path: '/home/adam/projects/minesweeper-repo', icon: Folder },
  { label: 'scripts', path: '/home/adam/scripts', icon: Folder },
];

interface ModelDefinition {
  id: string;
  name: string;
  badge: string;
}

const AVAILABLE_MODELS: ModelDefinition[] = [
  { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', badge: 'Najszybszy' },
  { id: 'gemini-3.1-pro', name: 'Gemini 3.1 Pro', badge: 'Pro / Kod' },
  { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', badge: 'Thinking' },
  { id: 'claude-opus-4-6-thinking', name: 'Claude Opus 4.6', badge: 'Reasoning' },
  { id: 'gpt-oss-120b-medium', name: 'GPT-OSS 120B', badge: 'Open Source' },
  { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash', badge: 'Flash 3.7' },
];

export const NewSessionModal: React.FC<NewSessionModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  defaultWorkspacePath = '/home/adam/projects/my-domain',
}) => {
  const [prompt, setPrompt] = useState('');
  const [workspacePath, setWorkspacePath] = useState(defaultWorkspacePath);
  const [selectedModel, setSelectedModel] = useState('gemini-3.8-flash');
  const [availableDirs, setAvailableDirs] = useState<{ name: string; path: string }[]>([]);

  // Popover menus state
  const [openMenu, setOpenMenu] = useState<'workspace' | 'model' | null>(null);
  const [isTreeModalOpen, setIsTreeModalOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const currentModelDef = AVAILABLE_MODELS.find((m) => m.id === selectedModel) || AVAILABLE_MODELS[0];

  useEffect(() => {
    if (isOpen) {
      setPrompt('');
      setOpenMenu(null);
      setIsTreeModalOpen(false);
      setWorkspacePath(defaultWorkspacePath || '/home/adam/projects/my-domain');

      api.getWorkspaceDirectories('/home/adam').then((res) => {
        if (res?.directories) {
          setAvailableDirs(res.directories);
        }
      }).catch(() => {});

      // Autofocus textarea on open
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
    }
  }, [isOpen, defaultWorkspacePath]);

  // Handle outside click to close popover menus
  useEffect(() => {
    if (!openMenu) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-popover-root]')) {
        setOpenMenu(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMenu]);

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (openMenu) {
          setOpenMenu(null);
        } else {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, openMenu, onClose]);

  if (!isOpen) return null;

  const getWorkspaceDisplayName = (path: string) => {
    if (!path || path === '/home/adam') return '~/';
    if (path === '/') return '/';
    const parts = path.split('/').filter(Boolean);
    return parts[parts.length - 1] || path;
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const effort: ReasoningEffort = 'medium';

    let modelIdToSubmit = selectedModel;
    if (selectedModel.startsWith('gemini-3.8-flash')) {
      modelIdToSubmit = `gemini-3.8-flash-${effort}`;
    } else if (selectedModel.startsWith('gemini-3.7-flash')) {
      modelIdToSubmit = `gemini-3.7-flash-${effort}`;
    } else if (selectedModel.startsWith('gemini-3.1-pro')) {
      modelIdToSubmit = 'gemini-3.1-pro-high';
    }

    const trimmedPrompt = prompt.trim();
    const cleanOneLinePrompt = trimmedPrompt.replace(/\s+/g, ' ');

    let finalTitle = '';
    if (cleanOneLinePrompt) {
      finalTitle = cleanOneLinePrompt.slice(0, 48) + (cleanOneLinePrompt.length > 48 ? '…' : '');
    } else {
      finalTitle = `Zadanie: ${getWorkspaceDisplayName(workspacePath)}`;
    }

    onSubmit({
      title: finalTitle,
      workspace_path: workspacePath.trim() || '/home/adam/projects/my-domain',
      model: modelIdToSubmit,
      effort,
      initialPrompt: trimmedPrompt || undefined,
    });
    onClose();
  };

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-100">
      <div
        ref={containerRef}
        className="w-full max-w-xl bg-surface border border-border rounded-2xl shadow-2xl flex flex-col overflow-visible"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/60 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <h2 className="text-xs font-semibold text-main">Nowe zadanie</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-muted hover:text-main hover:bg-surface-hover transition-colors cursor-pointer"
            title="Zamknij (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Main Prompt Textarea */}
        <div className="p-4">
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleTextareaKeyDown}
            placeholder="Co chcesz dzisiaj zrobić? Opisz zadanie, wklej kod lub wpisz /plan..."
            rows={4}
            className="w-full p-3.5 text-xs sm:text-sm rounded-xl bg-card border border-border text-main placeholder:text-subtle focus:outline-hidden focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all resize-y min-h-[110px] max-h-[260px] leading-relaxed"
          />
        </div>

        {/* Compact Context & Action Bar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-card/60 rounded-b-2xl gap-2" data-popover-root>
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Workspace Pill & Popover */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenMenu(openMenu === 'workspace' ? null : 'workspace')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                  openMenu === 'workspace'
                    ? 'bg-primary/15 border-primary/40 text-primary'
                    : 'bg-card border-border text-muted hover:text-main hover:bg-surface-hover'
                }`}
                title={workspacePath}
              >
                <FolderOpen className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="font-mono max-w-[130px] truncate">{getWorkspaceDisplayName(workspacePath)}</span>
                <ChevronDown className="w-3 h-3 text-subtle" />
              </button>

              {openMenu === 'workspace' && (
                <div className="absolute left-0 top-full mt-1.5 w-[300px] sm:w-[340px] bg-card border border-border rounded-xl shadow-xl z-50 p-3 max-h-[calc(100vh-180px)] overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
                  <div className="text-[11px] font-semibold text-main mb-2">Wybierz katalog roboczy</div>
                  
                  {/* Path input */}
                  <div className="relative mb-2.5">
                    <input
                      type="text"
                      value={workspacePath}
                      onChange={(e) => setWorkspacePath(e.target.value)}
                      placeholder="/home/adam/projects/my-domain"
                      className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg bg-surface border border-border text-main focus:outline-hidden focus:border-primary"
                    />
                  </div>

                  {/* Common directories */}
                  <div className="text-[10px] font-medium text-muted uppercase tracking-wider mb-1.5">
                    Częste katalogi
                  </div>
                  <div className="flex flex-wrap gap-1 mb-2.5">
                    {COMMON_DIRECTORIES.map((dir) => {
                      const Icon = dir.icon;
                      const isSelected = workspacePath === dir.path;
                      return (
                        <button
                          key={dir.path}
                          type="button"
                          onClick={() => {
                            setWorkspacePath(dir.path);
                            setOpenMenu(null);
                          }}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-primary/15 border-primary/40 text-primary font-semibold'
                              : 'bg-surface border-border text-muted hover:text-main hover:bg-surface-hover'
                          }`}
                        >
                          <Icon className="w-3 h-3 text-subtle" />
                          <span>{dir.label}</span>
                        </button>
                      );
                    })}

                    {availableDirs.map((dir) => {
                      if (COMMON_DIRECTORIES.some((c) => c.path === dir.path)) return null;
                      const isSelected = workspacePath === dir.path;
                      return (
                        <button
                          key={dir.path}
                          type="button"
                          onClick={() => {
                            setWorkspacePath(dir.path);
                            setOpenMenu(null);
                          }}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-primary/15 border-primary/40 text-primary font-semibold'
                              : 'bg-surface border-border text-muted hover:text-main hover:bg-surface-hover'
                          }`}
                        >
                          <Folder className="w-3 h-3 text-subtle" />
                          <span>{dir.name}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Dedicated Full Tree Modal Launcher */}
                  <div className="pt-2 border-t border-border">
                    <button
                      type="button"
                      onClick={() => {
                        setOpenMenu(null);
                        setIsTreeModalOpen(true);
                      }}
                      className="flex items-center justify-between w-full px-2.5 py-2 rounded-xl bg-surface border border-border hover:border-primary/40 hover:bg-surface-hover text-xs font-medium text-main transition-colors cursor-pointer group"
                    >
                      <span className="flex items-center gap-2 text-primary font-medium">
                        <FolderTree className="w-4 h-4" />
                        <span>Przeglądaj strukturę folderów...</span>
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-muted group-hover:text-main group-hover:translate-x-0.5 transition-all" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Model Pill & Popover */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenMenu(openMenu === 'model' ? null : 'model')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                  openMenu === 'model'
                    ? 'bg-primary/15 border-primary/40 text-primary'
                    : 'bg-card border-border text-muted hover:text-main hover:bg-surface-hover'
                }`}
              >
                <Zap className="w-3.5 h-3.5 text-primary shrink-0" />
                <span>{currentModelDef.name}</span>
                <ChevronDown className="w-3 h-3 text-subtle" />
              </button>

              {openMenu === 'model' && (
                <div className="absolute left-0 top-full mt-1.5 w-[250px] sm:w-[280px] bg-card border border-border rounded-xl shadow-xl z-50 p-2 space-y-1 max-h-[260px] overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-2 py-1 text-[11px] font-semibold text-main">Wybierz model AI</div>
                  {AVAILABLE_MODELS.map((m) => {
                    const isSelected = selectedModel === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setSelectedModel(m.id);
                          setOpenMenu(null);
                        }}
                        className={`flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-primary/15 text-primary font-semibold'
                            : 'hover:bg-surface-hover text-muted hover:text-main'
                        }`}
                      >
                        <div className="text-xs font-medium">{m.name}</div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-muted">{m.badge}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right side: Enter hint & Start button */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] text-muted hidden sm:inline-block">
              <kbd className="px-1.5 py-0.5 rounded-sm bg-surface border border-border font-mono text-[10px] text-main">↵ Enter</kbd>
            </span>
            <button
              type="button"
              onClick={() => handleSubmit()}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-primary text-white hover:bg-primary-hover shadow-xs transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Rozpocznij</span>
            </button>
          </div>
        </div>
      </div>

      {/* Workspace Directory Tree Modal (Layered on top of NewSessionModal) */}
      {isTreeModalOpen && (
        <ChangeWorkspaceModal
          isOpen={isTreeModalOpen}
          onClose={() => setIsTreeModalOpen(false)}
          currentWorkspacePath={workspacePath}
          onSave={(newPath) => {
            setWorkspacePath(newPath);
            setIsTreeModalOpen(false);
          }}
          title="Wybierz katalog roboczy"
          description="Przeglądaj strukturę folderów na serwerze i wybierz lokalizację zadania"
          saveButtonText="Wybierz ten katalog"
          zIndexClass="z-[60]"
        />
      )}
    </div>
  );
};
