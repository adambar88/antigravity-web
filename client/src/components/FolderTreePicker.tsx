import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FolderGit2,
  Home,
  HardDrive,
  RefreshCw,
  Search,
  X,
  Loader2,
  ArrowUp,
  FolderTree,
  Check,
} from 'lucide-react';
import { WorkspaceDirectoryItem } from '@/types';
import { api } from '@/services/api';

export interface FolderTreePickerProps {
  selectedPath: string;
  onSelectPath: (path: string) => void;
  className?: string;
  maxHeight?: string;
}

interface RootOption {
  label: string;
  shortLabel: string;
  path: string;
  icon: typeof Home;
}

const ROOT_OPTIONS: RootOption[] = [
  { label: 'Katalog domowy (~/)', shortLabel: 'Dom (~/)', path: '/home/adam', icon: Home },
  { label: 'Projekty (/projects)', shortLabel: 'Projekty', path: '/home/adam/projects', icon: FolderOpen },
  { label: 'Katalog główny (/)', shortLabel: 'Główny (/)', path: '/', icon: HardDrive },
];

/**
 * Calculates ancestor paths between root and target to preload tree nodes.
 */
function getAncestorChain(root: string, target: string): string[] {
  const normRoot = root.replace(/\/+$/, '') || '/';
  const normTarget = target.replace(/\/+$/, '') || '/';

  if (!normTarget.startsWith(normRoot)) {
    return [normRoot];
  }

  const remainder = normTarget.slice(normRoot === '/' ? 1 : normRoot.length);
  const segments = remainder.split('/').filter(Boolean);

  const chain: string[] = [normRoot];
  let current = normRoot;

  for (const seg of segments) {
    current = current === '/' ? `/${seg}` : `${current}/${seg}`;
    chain.push(current);
  }

  return chain;
}

export const FolderTreePicker: React.FC<FolderTreePickerProps> = ({
  selectedPath,
  onSelectPath,
  className = '',
  maxHeight = 'max-h-[320px]',
}) => {
  // Determine appropriate initial root
  const initialRoot = useMemo(() => {
    if (selectedPath.startsWith('/home/adam/projects')) return '/home/adam';
    if (selectedPath.startsWith('/home/adam')) return '/home/adam';
    return '/';
  }, [selectedPath]);

  const [activeRoot, setActiveRoot] = useState(initialRoot);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [dirCache, setDirCache] = useState<Record<string, WorkspaceDirectoryItem[]>>({});
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set());
  const [searchFilter, setSearchFilter] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const treeContainerRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLDivElement>(null);

  const [loadErrors, setLoadErrors] = useState<Record<string, string>>({});

  // Load directories for a specific path
  const fetchDirectories = useCallback(async (dirPath: string): Promise<WorkspaceDirectoryItem[]> => {
    setLoadingPaths((prev) => new Set(prev).add(dirPath));
    setLoadErrors((prev) => {
      const next = { ...prev };
      delete next[dirPath];
      return next;
    });
    try {
      const res = await api.getWorkspaceDirectories(dirPath);
      const items = res?.directories || [];
      setDirCache((prev) => ({ ...prev, [dirPath]: items }));
      return items;
    } catch (err: any) {
      const msg = err?.message || 'Błąd wczytywania katalogu';
      setLoadErrors((prev) => ({ ...prev, [dirPath]: msg }));
      setDirCache((prev) => ({ ...prev, [dirPath]: [] }));
      return [];
    } finally {
      setLoadingPaths((prev) => {
        const next = new Set(prev);
        next.delete(dirPath);
        return next;
      });
    }
  }, []);

  // Preload hierarchy from activeRoot down to selectedPath
  const preloadHierarchy = useCallback(async (root: string, target: string) => {
    const chain = getAncestorChain(root, target);
    const newExpanded = new Set<string>();

    for (const p of chain) {
      newExpanded.add(p);
      await fetchDirectories(p);
    }

    setExpandedPaths((prev) => {
      const combined = new Set(prev);
      newExpanded.forEach((p) => combined.add(p));
      return combined;
    });
  }, [fetchDirectories]);

  // Initial load when activeRoot or target changes
  useEffect(() => {
    preloadHierarchy(activeRoot, selectedPath);
  }, [activeRoot, selectedPath, preloadHierarchy]);

  // Auto-scroll selected node into view after rendering
  useEffect(() => {
    if (selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [selectedPath, expandedPaths]);

  // Toggle node expansion
  const toggleExpand = async (itemPath: string, e?: React.MouseEvent) => {
    e?.stopPropagation();

    const isExpanded = expandedPaths.has(itemPath);
    if (isExpanded) {
      setExpandedPaths((prev) => {
        const next = new Set(prev);
        next.delete(itemPath);
        return next;
      });
    } else {
      setExpandedPaths((prev) => new Set(prev).add(itemPath));
      if (!dirCache[itemPath]) {
        await fetchDirectories(itemPath);
      }
    }
  };

  // Select a directory node
  const handleSelect = (itemPath: string) => {
    onSelectPath(itemPath);
  };

  // Double click selects and toggles expand
  const handleDoubleClick = (itemPath: string, hasChildren?: boolean) => {
    handleSelect(itemPath);
    if (hasChildren !== false) {
      toggleExpand(itemPath);
    }
  };

  // Refresh current tree view
  const handleRefresh = async () => {
    setIsRefreshing(true);
    const pathsToRefresh = Array.from(expandedPaths);
    if (!pathsToRefresh.includes(activeRoot)) {
      pathsToRefresh.push(activeRoot);
    }

    for (const p of pathsToRefresh) {
      await fetchDirectories(p);
    }
    setIsRefreshing(false);
  };

  // Collapse all expanded directories
  const handleCollapseAll = () => {
    setExpandedPaths(new Set([activeRoot]));
  };

  // Navigate one level up
  const handleGoUp = () => {
    if (activeRoot === '/') return;
    const parent = activeRoot.substring(0, activeRoot.lastIndexOf('/')) || '/';
    setActiveRoot(parent);
    handleSelect(parent);
  };

  // Filter items matching search
  const matchesSearch = useCallback(
    (item: WorkspaceDirectoryItem): boolean => {
      if (!searchFilter.trim()) return true;
      const q = searchFilter.toLowerCase().trim();
      if (item.name.toLowerCase().includes(q)) return true;

      // Check if any cached children match
      const children = dirCache[item.path];
      if (children && children.some((c) => matchesSearch(c))) {
        return true;
      }
      return false;
    },
    [searchFilter, dirCache]
  );

  // Compute breadcrumbs for current selection
  const breadcrumbs = useMemo(() => {
    const parts = selectedPath.split('/').filter(Boolean);
    const crumbs: { name: string; path: string }[] = [{ name: '/', path: '/' }];
    let curr = '';
    for (const part of parts) {
      curr += `/${part}`;
      crumbs.push({ name: part, path: curr });
    }
    return crumbs;
  }, [selectedPath]);

  // Recursive tree renderer
  const renderTreeNodes = (dirPath: string, level: number) => {
    const items = dirCache[dirPath];
    const isLoading = loadingPaths.has(dirPath);

    if (isLoading && !items) {
      return (
        <div
          style={{ paddingLeft: `${level * 16 + 24}px` }}
          className="flex items-center gap-2 py-1 text-xs text-muted"
        >
          <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
          <span>Wczytywanie folderów...</span>
        </div>
      );
    }

    if (loadErrors[dirPath]) {
      return (
        <div
          style={{ paddingLeft: `${level * 16 + 24}px` }}
          className="flex items-center gap-2 py-1.5 text-xs text-rose-500"
        >
          <span>{loadErrors[dirPath]}</span>
          <button
            type="button"
            onClick={() => fetchDirectories(dirPath)}
            className="px-2 py-0.5 text-[10px] rounded bg-rose-500/10 hover:bg-rose-500/20 underline cursor-pointer"
          >
            Spróbuj ponownie
          </button>
        </div>
      );
    }

    if (!items || items.length === 0) {
      return (
        <div
          style={{ paddingLeft: `${level * 16 + 24}px` }}
          className="py-1 text-[11px] text-muted/60 italic"
        >
          (Brak podfolderów)
        </div>
      );
    }

    const filteredItems = items.filter(matchesSearch);

    if (filteredItems.length === 0 && searchFilter.trim()) {
      return null;
    }

    return (
      <div className="space-y-0.5">
        {filteredItems.map((item) => {
          const isSelected = selectedPath === item.path;
          const isExpanded = expandedPaths.has(item.path);
          const isItemLoading = loadingPaths.has(item.path);
          const hasChildren = item.hasChildren !== false;

          return (
            <div key={item.path} className="select-none">
              <div
                ref={isSelected ? selectedItemRef : undefined}
                onClick={() => handleSelect(item.path)}
                onDoubleClick={() => handleDoubleClick(item.path, hasChildren)}
                style={{ paddingLeft: `${level * 16 + 8}px` }}
                className={`group flex items-center gap-1.5 py-1.5 pr-2 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-primary/15 text-primary font-semibold border border-primary/30 shadow-xs'
                    : 'text-main hover:bg-surface-hover hover:text-main'
                }`}
                title={item.path}
              >
                {/* Expand / Collapse Chevron */}
                <button
                  type="button"
                  onClick={(e) => hasChildren && toggleExpand(item.path, e)}
                  className={`w-4 h-4 flex items-center justify-center rounded hover:bg-card/80 transition-colors shrink-0 ${
                    !hasChildren ? 'invisible pointer-events-none' : 'text-muted group-hover:text-main'
                  }`}
                  aria-label={isExpanded ? 'Zwiń' : 'Rozwiń'}
                >
                  {isItemLoading ? (
                    <Loader2 className="w-3 h-3 animate-spin text-primary" />
                  ) : isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5" />
                  )}
                </button>

                {/* Folder Icon */}
                <div className="shrink-0">
                  {item.isGit ? (
                    <FolderGit2 className="w-4 h-4 text-purple-500" />
                  ) : isExpanded || isSelected ? (
                    <FolderOpen className="w-4 h-4 text-primary" />
                  ) : (
                    <Folder className="w-4 h-4 text-subtle group-hover:text-muted" />
                  )}
                </div>

                {/* Folder Name */}
                <span className="truncate flex-1 font-mono text-[12px]">{item.name}</span>

                {/* Git Badge */}
                {item.isGit && (
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-medium bg-purple-500/15 text-purple-500 border border-purple-500/20 shrink-0">
                    git
                  </span>
                )}

                {/* Selected Indicator */}
                {isSelected && (
                  <span className="flex items-center gap-1 px-1.5 py-0.2 rounded-md text-[10px] font-semibold bg-primary text-white shrink-0 shadow-2xs">
                    <Check className="w-2.5 h-2.5" />
                    <span>wybrany</span>
                  </span>
                )}
              </div>

              {/* Sub-tree recursion */}
              {isExpanded && hasChildren && (
                <div className="mt-0.5">
                  {renderTreeNodes(item.path, level + 1)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className={`flex flex-col rounded-xl border border-border bg-card/60 overflow-hidden ${className}`}>
      {/* Tree Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-border bg-card">
        {/* Title & Root selector */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-main">
            <FolderTree className="w-4 h-4 text-primary" />
            <span>Drzewo folderów</span>
          </div>

          <div className="hidden sm:flex items-center gap-1 pl-2 border-l border-border">
            {ROOT_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const isActive = activeRoot === opt.path;
              return (
                <button
                  key={opt.path}
                  type="button"
                  onClick={() => {
                    setActiveRoot(opt.path);
                    handleSelect(opt.path);
                  }}
                  className={`inline-flex items-center gap-1 px-2 py-0.8 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-primary/15 text-primary border border-primary/40 font-semibold'
                      : 'text-muted hover:text-main hover:bg-surface border border-transparent'
                  }`}
                  title={opt.path}
                >
                  <Icon className="w-3 h-3" />
                  <span>{opt.shortLabel}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Search & Actions */}
        <div className="flex items-center gap-1.5 ml-auto">
          {/* Quick Filter */}
          <div className="relative flex items-center">
            <Search className="w-3 h-3 text-muted absolute left-2 pointer-events-none" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Filtruj foldery..."
              className="w-28 sm:w-36 pl-7 pr-6 py-1 text-[11px] rounded-lg bg-surface border border-border text-main placeholder:text-muted/60 focus:outline-hidden focus:border-primary transition-colors"
            />
            {searchFilter && (
              <button
                type="button"
                onClick={() => setSearchFilter('')}
                className="absolute right-1.5 p-0.5 text-muted hover:text-main cursor-pointer"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            )}
          </div>

          {/* Go Up button */}
          <button
            type="button"
            onClick={handleGoUp}
            disabled={activeRoot === '/'}
            className="p-1 rounded-lg text-muted hover:text-main hover:bg-surface border border-border/60 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
            title="Przejdź w górę (katalog nadrzędny)"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>

          {/* Collapse all */}
          <button
            type="button"
            onClick={handleCollapseAll}
            className="p-1 rounded-lg text-muted hover:text-main hover:bg-surface border border-border/60 transition-colors cursor-pointer"
            title="Zwiń wszystkie foldery"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          {/* Refresh */}
          <button
            type="button"
            onClick={handleRefresh}
            className="p-1 rounded-lg text-muted hover:text-main hover:bg-surface border border-border/60 transition-colors cursor-pointer"
            title="Odśwież drzewo"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-primary' : ''}`} />
          </button>
        </div>
      </div>

      {/* Breadcrumb path bar */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border/70 bg-surface/50 text-[11px] overflow-x-auto select-none no-scrollbar">
        <span className="text-muted shrink-0">Ścieżka:</span>
        <div className="flex items-center gap-1 font-mono shrink-0">
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={crumb.path}>
              {idx > 0 && <span className="text-muted/50">/</span>}
              <button
                type="button"
                onClick={() => {
                  handleSelect(crumb.path);
                  if (!expandedPaths.has(crumb.path)) {
                    toggleExpand(crumb.path);
                  }
                }}
                className={`hover:text-primary hover:underline transition-colors cursor-pointer ${
                  crumb.path === selectedPath ? 'text-primary font-semibold' : 'text-muted'
                }`}
              >
                {crumb.name}
              </button>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Tree Content Container */}
      <div
        ref={treeContainerRef}
        className={`p-2 overflow-y-auto overflow-x-hidden ${maxHeight} focus:outline-hidden`}
        tabIndex={0}
      >
        {/* Root Node Header */}
        <div className="mb-1">
          <div
            onClick={() => handleSelect(activeRoot)}
            className={`flex items-center gap-2 py-1.5 px-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
              selectedPath === activeRoot
                ? 'bg-primary/15 text-primary border border-primary/30'
                : 'text-main hover:bg-surface-hover'
            }`}
          >
            <Home className="w-4 h-4 text-primary shrink-0" />
            <span className="font-mono">{activeRoot}</span>
            <span className="text-[10px] font-normal text-muted ml-auto">Katalog bazowy</span>
          </div>
        </div>

        {/* Directory Children Nodes */}
        {renderTreeNodes(activeRoot, 1)}
      </div>
    </div>
  );
};
