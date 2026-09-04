import React, { useEffect, useState } from 'react';
import {
  Check,
  Folder,
  FolderGit2,
  FolderOpen,
  FolderTree,
  ChevronDown,
  ChevronUp,
  Home,
  Sparkles,
  X,
} from 'lucide-react';
import { ReasoningEffort } from '@/types';
import { api } from '@/services/api';
import { FolderTreePicker } from './FolderTreePicker';

interface NewSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (params: {
    title: string;
    workspace_path: string;
    model: string;
    effort: ReasoningEffort;
  }) => void;
  defaultWorkspacePath?: string;
}

const COMMON_DIRECTORIES = [
  { label: 'Katalog domowy (~/)', path: '/home/adam', icon: Home },
  { label: 'my-domain', path: '/home/adam/projects/my-domain', icon: FolderGit2 },
  { label: 'minesweeper-repo', path: '/home/adam/projects/minesweeper-repo', icon: Folder },
  { label: 'scripts', path: '/home/adam/scripts', icon: Folder },
];

const AVAILABLE_MODELS = [
  { id: 'gemini-3.8-flash-medium', name: 'Gemini 3.8 Flash', tag: 'Domyślny (Medium)' },
  { id: 'gemini-3.8-flash-high', name: 'Gemini 3.8 Flash (High)', tag: 'Głębokie myślenie' },
  { id: 'gemini-3.7-flash-high', name: 'Gemini 3.7 Flash', tag: 'Szybki' },
  { id: 'gemini-3.1-pro-high', name: 'Gemini 3.1 Pro', tag: 'Zaawansowany' },
  { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', tag: 'Thinking' },
  { id: 'claude-opus-4-6-thinking', name: 'Claude Opus 4.6', tag: 'Reasoning' },
  { id: 'gpt-oss-120b-medium', name: 'GPT-OSS 120B', tag: 'Open Source' },
];

export const NewSessionModal: React.FC<NewSessionModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  defaultWorkspacePath = '/home/adam',
}) => {
  const [title, setTitle] = useState('');
  const [workspacePath, setWorkspacePath] = useState(defaultWorkspacePath);
  const [selectedModel, setSelectedModel] = useState('gemini-3.8-flash-medium');
  const [effort, setEffort] = useState<ReasoningEffort>('medium');
  const [availableDirs, setAvailableDirs] = useState<{ name: string; path: string }[]>([]);
  const [showFolderTree, setShowFolderTree] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setWorkspacePath(defaultWorkspacePath || '/home/adam');
      api.getWorkspaceDirectories('/home/adam').then((res) => {
        if (res?.directories) {
          setAvailableDirs(res.directories);
        }
      }).catch(() => {});
    }
  }, [isOpen, defaultWorkspacePath]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      title: title.trim() || 'Nowe zadanie',
      workspace_path: workspacePath.trim() || '/home/adam',
      model: selectedModel,
      effort,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div
        className="w-full max-w-lg bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-card">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-main">Nowe zadanie kodowania</h2>
              <p className="text-[11px] text-muted">Skonfiguruj obszar roboczy i model Antigravity</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted hover:text-main hover:bg-surface-hover transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Title Input */}
          <div>
            <label className="block text-xs font-semibold text-main mb-1.5">
              Nazwa zadania
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="np. Analiza repozytorium, Poprawki w UI..."
              className="w-full px-3 py-2 text-xs rounded-xl bg-card border border-border text-main placeholder:text-subtle focus:outline-hidden focus:border-primary transition-colors"
              autoFocus
            />
          </div>

          {/* Workspace Path Input */}
          <div>
            <label className="block text-xs font-semibold text-main mb-1.5">
              Katalog roboczy (Workspace Path)
            </label>
            <div className="relative flex items-center">
              <FolderOpen className="w-4 h-4 text-primary absolute left-3 pointer-events-none" />
              <input
                type="text"
                value={workspacePath}
                onChange={(e) => setWorkspacePath(e.target.value)}
                placeholder="/home/adam"
                className="w-full pl-9 pr-3 py-2 text-xs font-mono rounded-xl bg-card border border-border text-main focus:outline-hidden focus:border-primary transition-colors"
              />
            </div>

            {/* Quick folder suggestions */}
            <div className="mt-2 space-y-1.5">
              <span className="text-[11px] font-medium text-muted">Szybki wybór:</span>
              <div className="flex flex-wrap gap-1.5">
                {COMMON_DIRECTORIES.map((dir) => {
                  const Icon = dir.icon;
                  const isSelected = workspacePath === dir.path;
                  return (
                    <button
                      key={dir.path}
                      type="button"
                      onClick={() => setWorkspacePath(dir.path)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-primary/15 border-primary/40 text-primary font-semibold'
                          : 'bg-card border-border text-muted hover:text-main hover:bg-surface-hover'
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
                      onClick={() => setWorkspacePath(dir.path)}
                      className={`inline-flex items-center gap-1 px-2 py-0.8 rounded-lg text-[11px] font-medium border transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-primary/15 border-primary/40 text-primary font-semibold'
                          : 'bg-card border-border text-muted hover:text-main hover:bg-surface-hover'
                      }`}
                    >
                      <Folder className="w-2.5 h-2.5 text-subtle" />
                      <span>{dir.name}</span>
                    </button>
                  );
                })}
              </div>

              {/* Interactive Folder Tree */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-semibold text-main flex items-center gap-1.5">
                    <FolderTree className="w-3.5 h-3.5 text-primary" />
                    Wybierz z drzewa folderów
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowFolderTree(!showFolderTree)}
                    className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-medium cursor-pointer"
                  >
                    <span>{showFolderTree ? 'Zwiń drzewo' : 'Rozwiń drzewo'}</span>
                    {showFolderTree ? (
                      <ChevronUp className="w-3 h-3" />
                    ) : (
                      <ChevronDown className="w-3 h-3" />
                    )}
                  </button>
                </div>
                {showFolderTree && (
                  <div className="animate-in fade-in duration-150">
                    <FolderTreePicker
                      selectedPath={workspacePath}
                      onSelectPath={(p) => setWorkspacePath(p)}
                      maxHeight="max-h-[220px]"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Model Selection */}
          <div>
            <label className="block text-xs font-semibold text-main mb-1.5">
              Model AI
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {AVAILABLE_MODELS.map((m) => {
                const isSelected = selectedModel === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedModel(m.id)}
                    className={`flex items-start justify-between p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-primary/10 border-primary/40 text-primary font-semibold'
                        : 'bg-card border-border text-muted hover:text-main hover:bg-surface-hover'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-medium text-main">{m.name}</div>
                      <div className="text-[10px] text-muted">{m.tag}</div>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Reasoning Effort */}
          <div>
            <label className="block text-xs font-semibold text-main mb-1.5">
              Poziom myślenia (Reasoning Effort)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['low', 'medium', 'high'] as ReasoningEffort[]).map((lvl) => {
                const isSelected = effort === lvl;
                const labels: Record<ReasoningEffort, string> = {
                  low: 'Szybki (Low)',
                  medium: 'Średni (Medium)',
                  high: 'Głęboki (High)',
                };
                return (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setEffort(lvl)}
                    className={`py-1.5 px-2 rounded-xl border text-center text-xs transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-primary/15 border-primary/40 text-primary font-semibold'
                        : 'bg-card border-border text-muted hover:text-main hover:bg-surface-hover'
                    }`}
                  >
                    {labels[lvl]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium rounded-xl border border-border bg-card text-muted hover:text-main hover:bg-surface-hover transition-colors cursor-pointer"
            >
              Anuluj
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-primary text-white hover:bg-primary-hover shadow-sm transition-colors cursor-pointer"
            >
              Utwórz zadanie
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
