import { useCallback, useEffect, useRef, useState } from 'react';
import { WorkspaceFileResponse, WorkspaceTreeNode } from '@/types';
import { api } from '@/services/api';

function updateNodeChildren(
  nodes: WorkspaceTreeNode[],
  targetPath: string,
  newChildren: WorkspaceTreeNode[]
): WorkspaceTreeNode[] {
  return nodes.map((node) => {
    if (node.path === targetPath) {
      return { ...node, children: newChildren };
    }
    if (node.children && node.children.length > 0) {
      return {
        ...node,
        children: updateNodeChildren(node.children, targetPath, newChildren),
      };
    }
    return node;
  });
}

interface UseWorkspaceTreeOptions {
  workspacePath?: string;
  isOpen?: boolean;
  activeTab?: string;
  isGenerating?: boolean;
}

export function useWorkspaceTree(optionsOrPath?: string | UseWorkspaceTreeOptions) {
  const options: UseWorkspaceTreeOptions =
    typeof optionsOrPath === 'string'
      ? { workspacePath: optionsOrPath }
      : optionsOrPath || {};

  const { workspacePath, isOpen = true, activeTab, isGenerating = false } = options;

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

  const fetchTree = useCallback(async (targetRoot?: unknown) => {
    const validTarget = typeof targetRoot === 'string' && targetRoot.trim() ? targetRoot.trim() : null;
    const activeRoot = validTarget || rootPath || workspacePath || '/home/adam';
    setIsLoadingTree(true);
    try {
      const res = await api.getWorkspaceTree(activeRoot, 8);
      setTree(res.tree || []);
      const newRoot = res.root || activeRoot;
      setRootPath(newRoot);

      if (selectedFilePath) {
        try {
          const fileRes = await api.getWorkspaceFile(selectedFilePath, newRoot);
          setSelectedFileContent(fileRes);
        } catch {
          // zachowaj obecny podgląd, jeśli odświeżenie pliku nie powiodło się
        }
      }
    } catch (err) {
      console.warn('Nie udało się pobrać drzewa projektu:', err);
    } finally {
      setIsLoadingTree(false);
    }
  }, [rootPath, workspacePath, selectedFilePath]);

  const refreshTree = useCallback(async () => {
    await fetchTree();
  }, [fetchTree]);

  // Initial fetch and on workspacePath change
  useEffect(() => {
    fetchTree(workspacePath);
  }, [workspacePath, fetchTree]);

  // Auto-refresh when tab switches to 'files' or inspector is opened on 'files'
  const isFilesTabActive = isOpen && (!activeTab || activeTab === 'files');
  useEffect(() => {
    if (isFilesTabActive) {
      fetchTree(workspacePath);
    }
  }, [isFilesTabActive, workspacePath, fetchTree]);

  // Auto-refresh when generation finishes (e.g. after tool execution finishes creating/deleting files)
  const prevGeneratingRef = useRef(isGenerating);
  useEffect(() => {
    if (prevGeneratingRef.current && !isGenerating && isFilesTabActive) {
      fetchTree(workspacePath);
    }
    prevGeneratingRef.current = isGenerating;
  }, [isGenerating, isFilesTabActive, workspacePath, fetchTree]);

  // Auto-refresh when browser window regains focus
  useEffect(() => {
    const handleFocus = () => {
      if (isFilesTabActive) {
        fetchTree(workspacePath);
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [isFilesTabActive, workspacePath, fetchTree]);

  // Periodic background refresh every 10s when user is in the Files tab
  useEffect(() => {
    if (!isFilesTabActive) return;
    const interval = setInterval(() => {
      fetchTree(workspacePath);
    }, 10000);
    return () => clearInterval(interval);
  }, [isFilesTabActive, workspacePath, fetchTree]);

  const toggleFolder = useCallback(async (folderPath: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });

    const findNode = (nodes: WorkspaceTreeNode[], target: string): WorkspaceTreeNode | null => {
      for (const node of nodes) {
        if (node.path === target) return node;
        if (node.children && node.children.length > 0) {
          const found = findNode(node.children, target);
          if (found) return found;
        }
      }
      return null;
    };

    const targetNode = findNode(tree, folderPath);
    if (targetNode && targetNode.type === 'directory' && (!targetNode.children || targetNode.children.length === 0)) {
      try {
        const res = await api.getWorkspaceChildren(folderPath, rootPath || workspacePath);
        if (res.children && res.children.length > 0) {
          setTree((prevTree) => updateNodeChildren(prevTree, folderPath, res.children));
        }
      } catch (err) {
        console.warn(`Nie udało się pobrać podkatalogów dla ${folderPath}:`, err);
      }
    }
  }, [tree, rootPath, workspacePath]);

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
    refreshTree,
    fetchTree,
  };
}
