import React, { useEffect, useState } from 'react';
import {
  Folder,
  FolderGit2,
  FolderOpen,
  Home,
  X,
  Check,
} from 'lucide-react';
import { api } from '@/services/api';
import { FolderTreePicker } from './FolderTreePicker';

interface ChangeWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentWorkspacePath: string;
  onSave: (newPath: string) => void;
  title?: string;
  description?: string;
  saveButtonText?: string;
  zIndexClass?: string;
}

const COMMON_DIRECTORIES = [
  { label: 'Katalog domowy (~/)', path: '/home/adam', icon: Home },
  { label: 'my-domain', path: '/home/adam/projects/my-domain', icon: FolderGit2 },
  { label: 'minesweeper-repo', path: '/home/adam/projects/minesweeper-repo', icon: Folder },
  { label: 'scripts', path: '/home/adam/scripts', icon: Folder },
  { label: 'projects', path: '/home/adam/projects', icon: FolderOpen },
];

export const ChangeWorkspaceModal: React.FC<ChangeWorkspaceModalProps> = ({
  isOpen,
  onClose,
  currentWorkspacePath,
  onSave,
  title = 'Zmień katalog roboczy',
  description = 'Wybierz lokalizację z drzewa folderów lub wpisz ścieżkę',
  saveButtonText = 'Zapisz zmiany',
  zIndexClass = 'z-50',
}) => {
  const [pathValue, setPathValue] = useState(currentWorkspacePath);
  const [availableDirs, setAvailableDirs] = useState<{ name: string; path: string }[]>([]);

  useEffect(() => {
    if (isOpen) {
      setPathValue(currentWorkspacePath);
      api.getWorkspaceDirectories('/home/adam').then((res) => {
        if (res?.directories) {
          setAvailableDirs(res.directories);
        }
      }).catch(() => {});
    }
  }, [isOpen, currentWorkspacePath]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pathValue.trim()) {
      onSave(pathValue.trim());
    }
    onClose();
  };

  return (
    <div className={`fixed inset-0 ${zIndexClass} flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in`}>
      <div
        className="w-full max-w-2xl bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-card">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <FolderOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-main">{title}</h2>
              <p className="text-[11px] text-muted">{description}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted hover:text-main hover:bg-surface-hover transition-colors cursor-pointer"
            aria-label="Zamknij okno"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden min-h-0">
          <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
            {/* Path text input */}
            <div>
              <label className="block text-xs font-semibold text-main mb-1.5">
                Ścieżka katalogu (Workspace Path)
              </label>
              <div className="relative flex items-center">
                <FolderOpen className="w-4 h-4 text-primary absolute left-3 pointer-events-none" />
                <input
                  type="text"
                  value={pathValue}
                  onChange={(e) => setPathValue(e.target.value)}
                  placeholder="/home/adam/projects/..."
                  className="w-full pl-9 pr-3 py-2 text-xs font-mono rounded-xl bg-card border border-border text-main focus:outline-hidden focus:border-primary transition-colors"
                  autoFocus
                />
              </div>

              {/* Quick shortcut pills */}
              <div className="mt-2.5 space-y-1.5">
                <span className="text-[11px] font-medium text-muted">Szybki wybór:</span>
                <div className="flex flex-wrap gap-1.5">
                  {COMMON_DIRECTORIES.map((dir) => {
                    const Icon = dir.icon;
                    const isSelected = pathValue === dir.path;
                    return (
                      <button
                        key={dir.path}
                        type="button"
                        onClick={() => setPathValue(dir.path)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-primary/15 border-primary/40 text-primary font-semibold shadow-xs'
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
                    const isSelected = pathValue === dir.path;
                    return (
                      <button
                        key={dir.path}
                        type="button"
                        onClick={() => setPathValue(dir.path)}
                        className={`inline-flex items-center gap-1 px-2 py-0.8 rounded-lg text-[11px] font-medium border transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-primary/15 border-primary/40 text-primary font-semibold shadow-xs'
                            : 'bg-card border-border text-muted hover:text-main hover:bg-surface-hover'
                        }`}
                      >
                        <Folder className="w-2.5 h-2.5 text-subtle" />
                        <span>{dir.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Interactive Folder Tree */}
            <div>
              <label className="block text-xs font-semibold text-main mb-1.5">
                Wybór z drzewa katalogów
              </label>
              <FolderTreePicker
                selectedPath={pathValue}
                onSelectPath={(newPath) => setPathValue(newPath)}
                maxHeight="max-h-[260px] sm:max-h-[300px]"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-border bg-card/60">
            <div className="text-[11px] text-muted truncate max-w-[280px] sm:max-w-md hidden sm:block">
              Wybrano: <span className="font-mono text-main font-medium">{pathValue || '(brak)'}</span>
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
                disabled={!pathValue.trim()}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-primary text-white hover:bg-primary-hover disabled:opacity-40 disabled:pointer-events-none shadow-sm transition-colors cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{saveButtonText}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
