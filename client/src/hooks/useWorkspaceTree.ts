import { useCallback, useEffect, useState } from 'react';
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

  useEffect(() => {
    fetchTree(workspacePath);
  }, [workspacePath, fetchTree]);

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
