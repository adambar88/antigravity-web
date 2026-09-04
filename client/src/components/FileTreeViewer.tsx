import React from 'react';
import {
  ChevronDown,
  ChevronRight,
  File,
  FileCode,
  Folder,
  FolderOpen,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { WorkspaceFileResponse, WorkspaceTreeNode } from '@/types';

interface FileTreeViewerProps {
  tree: WorkspaceTreeNode[];
  expandedFolders: Set<string>;
  selectedFilePath: string | null;
  selectedFileContent: WorkspaceFileResponse | null;
  isLoadingTree: boolean;
  isLoadingFile: boolean;
  onToggleFolder: (path: string) => void;
  onOpenFile: (path: string) => void;
  onRefresh: () => void;
  rootPath?: string;
}

export const FileTreeViewer: React.FC<FileTreeViewerProps> = ({
  tree,
  expandedFolders,
  selectedFilePath,
  selectedFileContent,
  isLoadingTree,
  isLoadingFile,
  onToggleFolder,
  onOpenFile,
  onRefresh,
  rootPath,
}) => {
  const renderNode = (node: WorkspaceTreeNode, depth = 0) => {
    const isExpanded = expandedFolders.has(node.path);
    const isSelected = selectedFilePath === node.path;

    if (node.type === 'directory') {
      return (
        <div key={node.path} className="select-none">
          <button
            type="button"
            onClick={() => onToggleFolder(node.path)}
            style={{ paddingLeft: `${depth * 14 + 8}px` }}
            className="w-full flex items-center gap-1.5 py-1 text-left text-xs font-medium text-main hover:bg-surface-hover rounded-lg transition-colors cursor-pointer"
          >
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-subtle shrink-0" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-subtle shrink-0" />
            )}
            {isExpanded ? (
              <FolderOpen className="w-4 h-4 text-amber-500 shrink-0" />
            ) : (
              <Folder className="w-4 h-4 text-amber-500 shrink-0" />
            )}
            <span className="truncate">{node.name}</span>
          </button>

          {isExpanded && node.children && (
            <div>{node.children.map((child) => renderNode(child, depth + 1))}</div>
          )}
        </div>
      );
    }

    return (
      <button
        key={node.path}
        type="button"
        onClick={() => onOpenFile(node.path)}
        style={{ paddingLeft: `${depth * 14 + 20}px` }}
        className={`w-full flex items-center gap-2 py-1 text-left text-xs rounded-lg transition-colors cursor-pointer ${
          isSelected
            ? 'bg-primary/15 text-primary font-medium'
            : 'text-muted hover:text-main hover:bg-surface-hover'
        }`}
      >
        <FileCode className="w-3.5 h-3.5 shrink-0 text-subtle" />
        <span className="truncate font-mono text-[11px]">{node.name}</span>
      </button>
    );
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-surface/50">
        <div className="flex items-center gap-2 min-w-0">
          <Folder className="w-4 h-4 text-primary shrink-0" />
          <div className="min-w-0">
            <span
              className="text-xs font-semibold text-main block truncate"
              title={rootPath || 'Pliki projektu'}
            >
              {rootPath ? rootPath.replace(/^\/home\/adam\/?/, '~/') || '~/' : 'Pliki projektu'}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoadingTree}
          title="Odśwież strukturę"
          className="p-1 rounded-md text-subtle hover:text-main hover:bg-surface-hover transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoadingTree ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex-1 min-h-0 flex flex-col md:flex-row">
        {/* Tree Sidebar inside Inspector */}
        <div className="w-full md:w-56 p-2 overflow-y-auto border-b md:border-b-0 md:border-r border-border shrink-0 max-h-48 md:max-h-full">
          {isLoadingTree ? (
            <div className="flex items-center justify-center p-6 text-xs text-muted">
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Ładowanie plików...
            </div>
          ) : tree.length === 0 ? (
            <div className="p-4 text-center text-xs text-subtle">
              Brak plików w projekcie
            </div>
          ) : (
            tree.map((node) => renderNode(node))
          )}
        </div>

        {/* File Preview */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-card">
          {selectedFilePath ? (
            <div className="h-full flex flex-col">
              <div className="px-4 py-2 border-b border-border bg-surface/30 flex items-center justify-between">
                <span className="font-mono text-xs text-muted truncate">
                  {selectedFilePath}
                </span>
                {selectedFileContent && (
                  <span className="text-[10px] text-subtle font-mono">
                    {selectedFileContent.size} B
                  </span>
                )}
              </div>
              <div className="flex-1 p-3 overflow-auto">
                {isLoadingFile ? (
                  <div className="flex items-center justify-center h-32 text-xs text-muted">
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Wczytywanie zawartości pliku...
                  </div>
                ) : (
                  <pre className="font-mono text-xs leading-relaxed text-main whitespace-pre-wrap">
                    {selectedFileContent?.content || '(Pusty plik)'}
                  </pre>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center text-subtle">
              <File className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-xs">Wybierz plik z drzewa, aby podejrzeć jego treść</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
