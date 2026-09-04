import { useCallback, useEffect, useState } from 'react';
import { WorkspaceFileResponse, WorkspaceTreeNode } from '@/types';
import { api } from '@/services/api';

export function useWorkspaceTree(workspacePath?: string) {
  const [tree, setTree] = useState<WorkspaceTreeNode[]>([]);
  const [rootPath, setRootPath] = useState<string>(workspacePath || '/home/adam');
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [selectedFileContent, setSelectedFileContent] = useState<WorkspaceFileResponse | null>(null);
  const [isLoadingTree, setIsLoadingTree] = useState(false);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (workspacePath) {
      setRootPath(workspacePath);
    }
  }, [workspacePath]);

  const fetchTree = useCallback(async (targetRoot?: string) => {
    const activeRoot = targetRoot || rootPath || workspacePath || '/home/adam';
    setIsLoadingTree(true);
    try {
      const res = await api.getWorkspaceTree(activeRoot, 3);
      setTree(res.tree || []);
      setRootPath(res.root || activeRoot);
    } catch (err) {
      console.warn('Nie udało się pobrać drzewa projektu:', err);
    } finally {
      setIsLoadingTree(false);
    }
  }, [rootPath, workspacePath]);

  useEffect(() => {
    fetchTree(workspacePath);
  }, [workspacePath, fetchTree]);

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
      const res = await api.getWorkspaceFile(filePath, rootPath || workspacePath);
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
  }, [rootPath, workspacePath]);

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
