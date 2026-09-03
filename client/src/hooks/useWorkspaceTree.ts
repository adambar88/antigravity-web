import { useCallback, useEffect, useState } from 'react';
import { WorkspaceFileResponse, WorkspaceTreeNode } from '@/types';
import { api } from '@/services/api';

export function useWorkspaceTree() {
  const [tree, setTree] = useState<WorkspaceTreeNode[]>([]);
  const [rootPath, setRootPath] = useState<string>('');
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [selectedFileContent, setSelectedFileContent] = useState<WorkspaceFileResponse | null>(null);
  const [isLoadingTree, setIsLoadingTree] = useState(false);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['client', 'src', 'server']));

  const fetchTree = useCallback(async () => {
    setIsLoadingTree(true);
    try {
      const res = await api.getWorkspaceTree();
      setTree(res.tree || []);
      setRootPath(res.root || '');
    } catch (err) {
      console.warn('Nie udało się pobrać drzewa projektu:', err);
      // Fallback mock tree for UI testing
      setTree([
        {
          name: 'client',
          path: 'client',
          type: 'directory',
          children: [
            {
              name: 'src',
              path: 'client/src',
              type: 'directory',
              children: [
                { name: 'App.tsx', path: 'client/src/App.tsx', type: 'file' },
                { name: 'main.tsx', path: 'client/src/main.tsx', type: 'file' },
                { name: 'index.css', path: 'client/src/index.css', type: 'file' },
              ],
            },
            { name: 'package.json', path: 'client/package.json', type: 'file' },
            { name: 'vite.config.ts', path: 'client/vite.config.ts', type: 'file' },
          ],
        },
        {
          name: 'shared',
          path: 'shared',
          type: 'directory',
          children: [
            {
              name: 'types',
              path: 'shared/types',
              type: 'directory',
              children: [{ name: 'contract.ts', path: 'shared/types/contract.ts', type: 'file' }],
            },
          ],
        },
      ]);
    } finally {
      setIsLoadingTree(false);
    }
  }, []);

  useEffect(() => {
    fetchTree();
  }, [fetchTree]);

  const toggleFolder = useCallback((folderPath: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });
  }, []);

  const openFile = useCallback(async (filePath: string) => {
    setSelectedFilePath(filePath);
    setIsLoadingFile(true);
    try {
      const res = await api.getWorkspaceFile(filePath);
      setSelectedFileContent(res);
    } catch (err) {
      console.warn('Nie udało się pobrać pliku:', err);
      setSelectedFileContent({
        path: filePath,
        content: `// Podgląd pliku: ${filePath}\n// Nie udało się załadować zawartości z serwera.`,
        size: 0,
        modified: Date.now(),
      });
    } finally {
      setIsLoadingFile(false);
    }
  }, []);

  return {
    tree,
    rootPath,
    selectedFilePath,
    selectedFileContent,
    isLoadingTree,
    isLoadingFile,
    expandedFolders,
    toggleFolder,
    openFile,
    refreshTree: fetchTree,
  };
}
