import React, { useEffect, useRef, useState } from 'react';
import {
  FolderOpen,
  MessageSquarePlus,
  Sparkles,
  X,
} from 'lucide-react';
import { ReasoningEffort } from '@/types';
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

export const NewSessionModal: React.FC<NewSessionModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  defaultWorkspacePath = '/home/adam/projects/my-domain',
}) => {
  const [workspacePath, setWorkspacePath] = useState(defaultWorkspacePath);
  const [prompt, setPrompt] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setWorkspacePath(defaultWorkspacePath || '/home/adam/projects/my-domain');
      setPrompt('');
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [isOpen, defaultWorkspacePath]);

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const getWorkspaceDisplayName = (path: string) => {
    if (!path || path === '/home/adam') return '~/';
    if (path === '/') return '/';
    const parts = path.split('/').filter(Boolean);
    return parts[parts.length - 1] || path;
  };

  const resolveTitle = (promptText: string, path: string): string => {
    const trimmed = promptText.trim();
    if (!trimmed) {
      return `Zadanie: ${getWorkspaceDisplayName(path)}`;
    }

    const cleanOneLine = trimmed.replace(/\s+/g, ' ');
    if (cleanOneLine.length > 48) {
      return cleanOneLine.slice(0, 48).trim() + '…';
    }
    return cleanOneLine;
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const trimmedPath = workspacePath.trim();
    if (!trimmedPath) return;

    const finalTitle = resolveTitle(prompt, trimmedPath);

    onSubmit({
      title: finalTitle,
      workspace_path: trimmedPath,
      model: 'gemini-3.8-flash-medium',
      effort: 'medium',
      initialPrompt: prompt.trim() || undefined,
    });
    onClose();
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-100">
      <div
        className="w-full max-w-2xl bg-surface border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[92vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-card">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <FolderOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-main">Nowe zadanie</h2>
              <p className="text-[11px] text-muted">Wybierz katalog i wpisz pierwsze polecenie</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted hover:text-main hover:bg-surface-hover transition-colors cursor-pointer"
            title="Zamknij (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden min-h-0">
          <div className="p-4 sm:p-5 space-y-3.5 overflow-y-auto flex-1">
            {/* Direct manual path input */}
            <div>
              <label className="block text-xs font-semibold text-main mb-1.5">
                Ścieżka katalogu (wpisz ręcznie)
              </label>
              <div className="relative flex items-center">
                <FolderOpen className="w-4 h-4 text-primary absolute left-3 pointer-events-none" />
                <input
                  ref={inputRef}
                  type="text"
                  value={workspacePath}
                  onChange={(e) => setWorkspacePath(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                  placeholder="/home/adam/projects/..."
                  className="w-full pl-9 pr-3 py-2 text-xs font-mono rounded-xl bg-card border border-border text-main focus:outline-hidden focus:border-primary transition-colors"
                />
              </div>
            </div>

            {/* Direct Interactive Folder Tree */}
            <div>
              <label className="block text-xs font-semibold text-main mb-1.5">
                Wybór z drzewa katalogów
              </label>
              <FolderTreePicker
                selectedPath={workspacePath}
                onSelectPath={(newPath) => setWorkspacePath(newPath)}
                maxHeight="max-h-[190px] sm:max-h-[210px]"
              />
            </div>

            {/* Initial Prompt Input Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-main flex items-center gap-1.5">
                  <MessageSquarePlus className="w-3.5 h-3.5 text-primary" />
                  <span>Pierwsze polecenie (prompt)</span>
                </label>
                <span className="text-[11px] text-muted">
                  tytuł zadania wygeneruje się z treści promptu
                </span>
              </div>
              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleTextareaKeyDown}
                placeholder="Opisz pierwsze zadanie dla agenta (np. Zaimplementuj logowanie, zoptymalizuj bazę danych, napraw błąd X...)"
                rows={3}
                className="w-full p-3 text-xs sm:text-sm rounded-xl bg-card border border-border text-main placeholder:text-subtle focus:outline-hidden focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all resize-y min-h-[75px] max-h-[140px] leading-relaxed"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-border bg-card/60">
            <div className="text-[11px] text-muted truncate max-w-[280px] sm:max-w-md hidden sm:block">
              {prompt.trim() ? (
                <span>
                  Tytuł: <span className="font-medium text-main">„{resolveTitle(prompt, workspacePath)}”</span>
                </span>
              ) : (
                <span>
                  Wybrano: <span className="font-mono text-main font-medium">{workspacePath || '(brak)'}</span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-[10px] text-muted hidden sm:inline mr-1">
                <kbd className="px-1.5 py-0.5 rounded-sm bg-surface border border-border font-mono text-[10px] text-main">Ctrl+Enter</kbd>
              </span>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium rounded-xl border border-border bg-card text-muted hover:text-main hover:bg-surface-hover transition-colors cursor-pointer"
              >
                Anuluj
              </button>
              <button
                type="submit"
                disabled={!workspacePath.trim()}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-primary text-white hover:bg-primary-hover disabled:opacity-40 disabled:pointer-events-none shadow-sm transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{prompt.trim() ? 'Utwórz i uruchom' : 'Utwórz zadanie'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
