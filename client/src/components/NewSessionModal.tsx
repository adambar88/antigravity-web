import React, { useEffect, useRef, useState } from 'react';
import {
  FolderOpen,
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
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setWorkspacePath(defaultWorkspacePath || '/home/adam/projects/my-domain');
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

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const trimmedPath = workspacePath.trim();
    if (!trimmedPath) return;

    onSubmit({
      title: `Zadanie: ${getWorkspaceDisplayName(trimmedPath)}`,
      workspace_path: trimmedPath,
      model: 'gemini-3.8-flash-medium',
      effort: 'medium',
    });
    onClose();
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-100">
      <div
        className="w-full max-w-2xl bg-surface border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh] animate-in zoom-in-95 duration-150"
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
              <p className="text-[11px] text-muted">Wybierz katalog roboczy projektu</p>
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
          <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
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
                maxHeight="max-h-[260px] sm:max-h-[320px]"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-border bg-card/60">
            <div className="text-[11px] text-muted truncate max-w-[280px] sm:max-w-md hidden sm:block">
              Wybrano: <span className="font-mono text-main font-medium">{workspacePath || '(brak)'}</span>
            </div>
            <div className="flex items-center gap-2 ml-auto">
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
                <span>Utwórz zadanie</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
