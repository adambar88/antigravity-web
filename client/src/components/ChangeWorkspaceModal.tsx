import React, { useEffect, useState } from 'react';
import {
  Folder,
  FolderGit2,
  FolderOpen,
  Home,
  X,
} from 'lucide-react';
import { api } from '@/services/api';

interface ChangeWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentWorkspacePath: string;
  onSave: (newPath: string) => void;
}

const COMMON_DIRECTORIES = [
  { label: 'Katalog domowy (~/)', path: '/home/adam', icon: Home },
  { label: 'my-domain', path: '/home/adam/projects/my-domain', icon: FolderGit2 },
  { label: 'minesweeper-repo', path: '/home/adam/projects/minesweeper-repo', icon: Folder },
  { label: 'scripts', path: '/home/adam/scripts', icon: Folder },
];

export const ChangeWorkspaceModal: React.FC<ChangeWorkspaceModalProps> = ({
  isOpen,
  onClose,
  currentWorkspacePath,
  onSave,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div
        className="w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-card">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <FolderOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-main">Zmień katalog roboczy</h2>
              <p className="text-[11px] text-muted">Zmień ścieżkę projektu dla bieżącej sesji</p>
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

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
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
                placeholder="/home/adam"
                className="w-full pl-9 pr-3 py-2 text-xs font-mono rounded-xl bg-card border border-border text-main focus:outline-hidden focus:border-primary transition-colors"
                autoFocus
              />
            </div>

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
                  const isSelected = pathValue === dir.path;
                  return (
                    <button
                      key={dir.path}
                      type="button"
                      onClick={() => setPathValue(dir.path)}
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
            </div>
          </div>

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
              Zapisz zmiany
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
