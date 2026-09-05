import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
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
  { label: 'minesweeper-repo', path: '/home/adam/projects/minesweeper-repo', icon: FolderOpen },
  { label: 'scripts', path: '/home/adam/scripts', icon: FolderOpen },
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

  // Menu state & tree file manager modal
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [isTreeModalOpen, setIsTreeModalOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const currentModelDef = AVAILABLE_MODELS.find((m) => m.id === selectedModel) || AVAILABLE_MODELS[0];

  useEffect(() => {
    if (isOpen) {
      setPrompt('');
      setIsModelMenuOpen(false);
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

  // Handle outside click for model dropdown
  useEffect(() => {
    if (!isModelMenuOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-model-dropdown]')) {
        setIsModelMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isModelMenuOpen]);

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isModelMenuOpen) {
          setIsModelMenuOpen(false);
        } else if (!isTreeModalOpen) {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isModelMenuOpen, isTreeModalOpen, onClose]);

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

  const handlePathKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
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

        {/* Modal Body */}
        <div className="p-4 space-y-3.5">
          {/* Main Prompt Textarea */}
          <div>
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleTextareaKeyDown}
              placeholder="Co chcesz dzisiaj zrobić? Opisz zadanie, wklej kod lub wpisz /plan..."
              rows={4}
              className="w-full p-3.5 text-xs sm:text-sm rounded-xl bg-card border border-border text-main placeholder:text-subtle focus:outline-hidden focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all resize-y min-h-[110px] max-h-[240px] leading-relaxed"
            />
          </div>

          {/* Workspace Row: Manual Path Input + 'Wybierz folder' file manager button */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-medium text-muted flex items-center gap-1.5">
                <FolderOpen className="w-3.5 h-3.5 text-primary" />
                <span>Katalog roboczy projektu:</span>
              </label>
              <span className="text-[10px] text-subtle hidden sm:inline">
                wpisz ręcznie lub wybierz z drzewa
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={workspacePath}
                  onChange={(e) => setWorkspacePath(e.target.value)}
                  onKeyDown={handlePathKeyDown}
                  placeholder="/home/adam/projects/my-domain"
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-card border border-border text-main placeholder:text-muted/50 focus:outline-hidden focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                />
              </div>

              <button
                type="button"
                onClick={() => setIsTreeModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border border-border bg-card hover:bg-surface-hover hover:border-primary/50 text-main transition-colors shrink-0 cursor-pointer shadow-2xs group"
                title="Otwórz menedżer plików i wybierz katalog"
              >
                <FolderTree className="w-3.5 h-3.5 text-primary group-hover:scale-110 transition-transform" />
                <span>Wybierz folder</span>
              </button>
            </div>

            {/* Quick folder shortcuts */}
            <div className="flex flex-wrap items-center gap-1 pt-0.5">
              <span className="text-[10px] text-muted mr-1">Częste:</span>
              {COMMON_DIRECTORIES.map((dir) => {
                const isSelected = workspacePath === dir.path;
                return (
                  <button
                    key={dir.path}
                    type="button"
                    onClick={() => setWorkspacePath(dir.path)}
                    className={`px-2 py-0.5 text-[10.5px] rounded-md font-mono border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-primary/15 border-primary/40 text-primary font-semibold'
                        : 'bg-card border-border/70 text-muted hover:text-main hover:bg-surface-hover'
                    }`}
                  >
                    {dir.label}
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
                    onClick={() => setWorkspacePath(dir.path)}
                    className={`px-2 py-0.5 text-[10.5px] rounded-md font-mono border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-primary/15 border-primary/40 text-primary font-semibold'
                        : 'bg-card border-border/70 text-muted hover:text-main hover:bg-surface-hover'
                    }`}
                  >
                    {dir.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bottom Bar: Model Selector + Submit */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-card/60 rounded-b-2xl gap-2">
          {/* Model Pill & Dropdown */}
          <div className="relative" data-model-dropdown>
            <button
              type="button"
              onClick={() => setIsModelMenuOpen(!isModelMenuOpen)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                isModelMenuOpen
                  ? 'bg-primary/15 border-primary/40 text-primary'
                  : 'bg-card border-border text-muted hover:text-main hover:bg-surface-hover'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>{currentModelDef.name}</span>
              <ChevronDown className="w-3 h-3 text-subtle" />
            </button>

            {isModelMenuOpen && (
              <div className="absolute left-0 bottom-full mb-1.5 sm:bottom-auto sm:top-full sm:mt-1.5 w-[250px] sm:w-[280px] bg-card border border-border rounded-xl shadow-xl z-50 p-2 space-y-1 max-h-[260px] overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
                <div className="px-2 py-1 text-[11px] font-semibold text-main">Wybierz model AI</div>
                {AVAILABLE_MODELS.map((m) => {
                  const isSelected = selectedModel === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setSelectedModel(m.id);
                        setIsModelMenuOpen(false);
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

          {/* Right side: Enter hint & Start button */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] text-muted hidden sm:inline-block">
              <kbd className="px-1.5 py-0.5 rounded-sm bg-surface border border-border font-mono text-[10px] text-main">↵ Enter</kbd>
            </span>
            <button
              type="button"
              onClick={() => handleSubmit()}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-xl bg-primary text-white hover:bg-primary-hover shadow-xs transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Rozpocznij</span>
            </button>
          </div>
        </div>
      </div>

      {/* File Manager & Directory Tree Modal (Layered on top of NewSessionModal) */}
      {isTreeModalOpen && (
        <ChangeWorkspaceModal
          isOpen={isTreeModalOpen}
          onClose={() => setIsTreeModalOpen(false)}
          currentWorkspacePath={workspacePath}
          onSave={(newPath) => {
            setWorkspacePath(newPath);
            setIsTreeModalOpen(false);
          }}
          title="Menedżer plików - Wybierz folder"
          description="Przeglądaj drzewo katalogów na serwerze i wskaż lokalizację zadania"
          saveButtonText="Wybierz ten folder"
          zIndexClass="z-[60]"
        />
      )}
    </div>
  );
};
