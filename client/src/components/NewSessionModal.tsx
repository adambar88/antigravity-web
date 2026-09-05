import React, { useEffect, useRef, useState } from 'react';
import {
  Brain,
  Check,
  ChevronDown,
  Folder,
  FolderGit2,
  FolderOpen,
  FolderTree,
  Home,
  Sparkles,
  Tag,
  X,
  Zap,
} from 'lucide-react';
import { ReasoningEffort } from '@/types';
import { api } from '@/services/api';
import { FolderTreePicker } from './FolderTreePicker';

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
  desc: string;
  supportsEffort: boolean;
}

const AVAILABLE_MODELS: ModelDefinition[] = [
  { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', badge: 'Najszybszy', desc: 'Wszechstronny, błyskawiczna responsywność', supportsEffort: true },
  { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash', badge: 'Responsywny', desc: 'Standardowy model Flash z myśleniem', supportsEffort: true },
  { id: 'gemini-3.1-pro', name: 'Gemini 3.1 Pro', badge: 'Pro / Kod', desc: 'Głębokie wnioskowanie i architektura', supportsEffort: true },
  { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', badge: 'Thinking', desc: 'Thinking model od Anthropic', supportsEffort: false },
  { id: 'claude-opus-4-6-thinking', name: 'Claude Opus 4.6', badge: 'Reasoning', desc: 'Zaawansowane myślenie Claude Opus', supportsEffort: false },
  { id: 'gpt-oss-120b-medium', name: 'GPT-OSS 120B', badge: 'Open Source', desc: 'Model open-source 120B', supportsEffort: false },
];

const EFFORT_OPTIONS: { id: ReasoningEffort; label: string; desc: string }[] = [
  { id: 'low', label: 'Szybki (Low)', desc: 'Ekspresowe odpowiedzi i minimalna latencja' },
  { id: 'medium', label: 'Średni (Medium)', desc: 'Zbalansowana analiza i kodowanie' },
  { id: 'high', label: 'Głęboki (High)', desc: 'Maksymalna analiza pre-mortem i debugowanie' },
];

export const NewSessionModal: React.FC<NewSessionModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  defaultWorkspacePath = '/home/adam/projects/my-domain',
}) => {
  const [prompt, setPrompt] = useState('');
  const [title, setTitle] = useState('');
  const [showCustomTitle, setShowCustomTitle] = useState(false);
  const [workspacePath, setWorkspacePath] = useState(defaultWorkspacePath);
  const [selectedModel, setSelectedModel] = useState('gemini-3.8-flash');
  const [effort, setEffort] = useState<ReasoningEffort>('medium');
  const [availableDirs, setAvailableDirs] = useState<{ name: string; path: string }[]>([]);

  // Popover menus state
  const [openMenu, setOpenMenu] = useState<'workspace' | 'model' | 'effort' | null>(null);
  const [showFolderTree, setShowFolderTree] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const currentModelDef = AVAILABLE_MODELS.find((m) => m.id === selectedModel) || AVAILABLE_MODELS[0];

  useEffect(() => {
    if (isOpen) {
      setPrompt('');
      setTitle('');
      setShowCustomTitle(false);
      setOpenMenu(null);
      setShowFolderTree(false);
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

    let modelIdToSubmit = selectedModel;
    if (selectedModel.startsWith('gemini-3.8-flash')) {
      modelIdToSubmit = `gemini-3.8-flash-${effort}`;
    } else if (selectedModel.startsWith('gemini-3.7-flash')) {
      modelIdToSubmit = `gemini-3.7-flash-${effort}`;
    } else if (selectedModel.startsWith('gemini-3.1-pro')) {
      modelIdToSubmit = effort === 'medium' ? 'gemini-3.1-pro-high' : `gemini-3.1-pro-${effort}`;
    }

    const trimmedPrompt = prompt.trim();
    const cleanOneLinePrompt = trimmedPrompt.replace(/\s+/g, ' ');

    // Automatic title generation if not explicitly provided
    let finalTitle = title.trim();
    if (!finalTitle) {
      if (cleanOneLinePrompt) {
        finalTitle = cleanOneLinePrompt.slice(0, 48) + (cleanOneLinePrompt.length > 48 ? '…' : '');
      } else {
        finalTitle = `Zadanie: ${getWorkspaceDisplayName(workspacePath)}`;
      }
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div
        ref={containerRef}
        className="w-full max-w-xl bg-surface border border-border rounded-2xl shadow-2xl flex flex-col overflow-visible"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-card rounded-t-2xl">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-main leading-tight">Nowe zadanie</h2>
              <p className="text-[11px] text-muted">Szybki start z agentem Antigravity</p>
            </div>
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

        {/* Body */}
        <div className="p-4 sm:p-5 space-y-3">
          {/* Main Prompt Input Field */}
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleTextareaKeyDown}
              placeholder="Co chcesz dzisiaj zrobić? Opisz zadanie lub polecenie dla agenta..."
              rows={4}
              className="w-full p-3.5 text-xs sm:text-sm rounded-xl bg-card border border-border text-main placeholder:text-subtle focus:outline-hidden focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all resize-y min-h-[105px] max-h-[220px] leading-relaxed"
            />
          </div>

          {/* Context Control Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            {/* Left pills: Workspace, Model, Effort */}
            <div className="flex flex-wrap items-center gap-1.5" data-popover-root>
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
                  <span className="font-mono max-w-[140px] truncate">{getWorkspaceDisplayName(workspacePath)}</span>
                  <ChevronDown className="w-3 h-3 text-subtle" />
                </button>

                {openMenu === 'workspace' && (
                  <div className="absolute left-0 top-full mt-1.5 w-[310px] sm:w-[350px] bg-card border border-border rounded-xl shadow-xl z-50 p-3 animate-in fade-in zoom-in-95 duration-100">
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

                    {/* Tree Picker Toggle */}
                    <div className="pt-2 border-t border-border">
                      <button
                        type="button"
                        onClick={() => setShowFolderTree(!showFolderTree)}
                        className="flex items-center justify-between w-full text-[11px] font-medium text-primary hover:underline cursor-pointer"
                      >
                        <span className="flex items-center gap-1">
                          <FolderTree className="w-3.5 h-3.5" />
                          Przeglądaj drzewo folderów
                        </span>
                        <span className="text-[10px] text-muted">{showFolderTree ? 'Zwiń' : 'Rozwiń'}</span>
                      </button>
                      {showFolderTree && (
                        <div className="mt-2">
                          <FolderTreePicker
                            selectedPath={workspacePath}
                            onSelectPath={(p) => setWorkspacePath(p)}
                            maxHeight="max-h-[160px]"
                          />
                        </div>
                      )}
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
                  <div className="absolute left-0 top-full mt-1.5 w-[260px] sm:w-[290px] bg-card border border-border rounded-xl shadow-xl z-50 p-2 space-y-1 animate-in fade-in zoom-in-95 duration-100">
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
                          className={`flex items-center justify-between w-full px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-primary/15 text-primary font-semibold'
                              : 'hover:bg-surface-hover text-muted hover:text-main'
                          }`}
                        >
                          <div>
                            <div className="text-xs font-medium leading-tight">{m.name}</div>
                            <div className="text-[10px] text-muted">{m.badge}</div>
                          </div>
                          {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0 ml-2" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Effort Pill & Popover (Only if supported) */}
              {currentModelDef.supportsEffort && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setOpenMenu(openMenu === 'effort' ? null : 'effort')}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                      openMenu === 'effort'
                        ? 'bg-primary/15 border-primary/40 text-primary'
                        : 'bg-card border-border text-muted hover:text-main hover:bg-surface-hover'
                    }`}
                  >
                    <Brain className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>{effort === 'low' ? 'Szybki' : effort === 'medium' ? 'Średni' : 'Głęboki'}</span>
                    <ChevronDown className="w-3 h-3 text-subtle" />
                  </button>

                  {openMenu === 'effort' && (
                    <div className="absolute left-0 top-full mt-1.5 w-[220px] bg-card border border-border rounded-xl shadow-xl z-50 p-2 space-y-1 animate-in fade-in zoom-in-95 duration-100">
                      <div className="px-2 py-1 text-[11px] font-semibold text-main">Poziom myślenia</div>
                      {EFFORT_OPTIONS.map((opt) => {
                        const isSelected = effort === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              setEffort(opt.id);
                              setOpenMenu(null);
                            }}
                            className={`flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-primary/15 text-primary font-semibold'
                                : 'hover:bg-surface-hover text-muted hover:text-main'
                            }`}
                          >
                            <span className="text-xs">{opt.label}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0 ml-2" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right side: Optional title toggle */}
            <div>
              <button
                type="button"
                onClick={() => setShowCustomTitle(!showCustomTitle)}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                  showCustomTitle || title.trim()
                    ? 'text-primary bg-primary/10'
                    : 'text-muted hover:text-main hover:bg-surface-hover'
                }`}
                title="Nadaj własną nazwę zadania"
              >
                <Tag className="w-3 h-3" />
                <span>{showCustomTitle ? 'Ukryj nazwę' : title.trim() ? title : 'Własna nazwa'}</span>
              </button>
            </div>
          </div>

          {/* Expandable Custom Title Input */}
          {showCustomTitle && (
            <div className="pt-1 animate-in fade-in duration-100">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Własna nazwa zadania (opcjonalna)..."
                className="w-full px-3 py-1.5 text-xs rounded-lg bg-card border border-border text-main placeholder:text-subtle focus:outline-hidden focus:border-primary"
              />
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-border bg-card/60 rounded-b-2xl">
          <div className="text-[11px] text-muted hidden sm:block">
            <kbd className="px-1.5 py-0.5 rounded-sm bg-surface border border-border font-mono text-[10px] text-main">↵ Enter</kbd> aby uruchomić · <kbd className="px-1.5 py-0.5 rounded-sm bg-surface border border-border font-mono text-[10px] text-main">Shift+Enter</kbd> nowa linia
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-medium rounded-xl border border-border bg-card text-muted hover:text-main hover:bg-surface-hover transition-colors cursor-pointer"
            >
              Anuluj
            </button>
            <button
              type="button"
              onClick={() => handleSubmit()}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-xl bg-primary text-white hover:bg-primary-hover shadow-sm transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{prompt.trim() ? 'Rozpocznij zadanie' : 'Utwórz zadanie'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
