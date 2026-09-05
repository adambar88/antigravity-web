import React, { useState, useMemo, useEffect } from 'react';
import {
  ChevronDown,
  ChevronRight,
  File,
  FileCode,
  Folder,
  FolderOpen,
  Loader2,
  RefreshCw,
  Search,
  X,
  Copy,
  Check,
  Download,
  ExternalLink,
  Eye,
  Code,
  Image as ImageIcon,
  Music,
  Film,
  FileText,
  Binary,
  WrapText,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { FileCategory, WorkspaceFileResponse, WorkspaceTreeNode } from '@/types';
import { api } from '@/services/api';
import { MarkdownRenderer } from './MarkdownRenderer';
import { useResizable } from '@/hooks/useResizable';
import { ResizeHandle } from './ResizeHandle';

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

function formatFileSize(bytes?: number): string {
  if (bytes === undefined || bytes === null) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function detectCategory(filePath: string, serverCategory?: FileCategory): FileCategory {
  if (serverCategory) return serverCategory;
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp', 'avif'].includes(ext)) return 'image';
  if (['md', 'markdown', 'mdx'].includes(ext)) return 'markdown';
  if (ext === 'pdf') return 'pdf';
  if (['mp3', 'wav', 'ogg', 'aac', 'm4a', 'flac'].includes(ext)) return 'audio';
  if (['mp4', 'webm', 'ogv', 'mov', 'mkv'].includes(ext)) return 'video';
  if (ext === 'json') return 'json';
  if (['ts', 'tsx', 'js', 'jsx', 'py', 'sh', 'bash', 'html', 'css', 'scss', 'yml', 'yaml', 'toml', 'go', 'rs', 'java', 'c', 'cpp', 'sql'].includes(ext)) return 'code';
  return 'text';
}

function getFileIcon(filename: string, category?: FileCategory) {
  const cat = detectCategory(filename, category);
  switch (cat) {
    case 'image':
      return <ImageIcon className="w-3.5 h-3.5 shrink-0 text-emerald-500" />;
    case 'markdown':
      return <FileText className="w-3.5 h-3.5 shrink-0 text-sky-500" />;
    case 'audio':
      return <Music className="w-3.5 h-3.5 shrink-0 text-amber-500" />;
    case 'video':
      return <Film className="w-3.5 h-3.5 shrink-0 text-purple-500" />;
    case 'pdf':
      return <FileText className="w-3.5 h-3.5 shrink-0 text-rose-500" />;
    case 'json':
      return <FileCode className="w-3.5 h-3.5 shrink-0 text-amber-400" />;
    case 'code':
      return <FileCode className="w-3.5 h-3.5 shrink-0 text-blue-500" />;
    case 'binary':
      return <Binary className="w-3.5 h-3.5 shrink-0 text-zinc-400" />;
    default:
      return <File className="w-3.5 h-3.5 shrink-0 text-subtle" />;
  }
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
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  );

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Desktop tree width
  const {
    size: treeWidth,
    isDragging: isDraggingTree,
    resetSize: resetTreeWidth,
    handlePointerDown: handleTreeDown,
    handlePointerMove: handleTreeMove,
    handlePointerUp: handleTreeUp,
  } = useResizable({
    initialSize: 260,
    minSize: 160,
    maxSize: () => (typeof window !== 'undefined' ? Math.min(500, window.innerWidth * 0.45) : 500),
    direction: 'horizontal',
    reverse: false,
    storageKey: 'ag_filetree_width',
  });

  // Mobile tree height
  const {
    size: treeHeightMobile,
    isDragging: isDraggingTreeMobile,
    resetSize: resetTreeHeightMobile,
    handlePointerDown: handleTreeMobileDown,
    handlePointerMove: handleTreeMobileMove,
    handlePointerUp: handleTreeMobileUp,
  } = useResizable({
    initialSize: 220,
    minSize: 100,
    maxSize: 450,
    direction: 'vertical',
    reverse: false,
    storageKey: 'ag_filetree_height_mobile',
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [markdownMode, setMarkdownMode] = useState<'preview' | 'raw'>('preview');
  const [wrapLines, setWrapLines] = useState(true);
  const [copied, setCopied] = useState(false);
  const [imageZoom, setImageZoom] = useState<number>(1);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    setImageZoom(1);
    setImageDimensions(null);
    setCopied(false);
  }, [selectedFilePath]);

  const handleCopy = async () => {
    if (!selectedFileContent) return;
    try {
      await navigator.clipboard.writeText(selectedFileContent.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard error
    }
  };

  const filteredTree = useMemo(() => {
    if (!searchQuery.trim()) return tree;
    const q = searchQuery.toLowerCase();

    const filterNode = (node: WorkspaceTreeNode): WorkspaceTreeNode | null => {
      const matchesName = node.name.toLowerCase().includes(q) || node.path.toLowerCase().includes(q);
      if (node.type === 'directory') {
        const matchingChildren = (node.children || [])
          .map(filterNode)
          .filter((n): n is WorkspaceTreeNode => n !== null);

        if (matchesName || matchingChildren.length > 0) {
          return {
            ...node,
            children: matchingChildren,
          };
        }
        return null;
      }
      return matchesName ? node : null;
    };

    return tree.map(filterNode).filter((n): n is WorkspaceTreeNode => n !== null);
  }, [tree, searchQuery]);

  const renderNode = (node: WorkspaceTreeNode, depth = 0) => {
    const isExpanded = searchQuery.trim() ? true : expandedFolders.has(node.path);
    const isSelected = selectedFilePath === node.path;

    if (node.type === 'directory') {
      return (
        <div key={node.path} className="select-none">
          <button
            type="button"
            onClick={() => onToggleFolder(node.path)}
            style={{ paddingLeft: `${depth * 14 + 8}px` }}
            className="w-full flex items-center gap-1.5 py-1 text-left text-xs font-medium text-main hover:bg-surface-hover rounded-lg transition-colors cursor-pointer group"
          >
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-subtle shrink-0 group-hover:text-main" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-subtle shrink-0 group-hover:text-main" />
            )}
            {isExpanded ? (
              <FolderOpen className="w-4 h-4 text-amber-500 shrink-0" />
            ) : (
              <Folder className="w-4 h-4 text-amber-500 shrink-0" />
            )}
            <span className="truncate">{node.name}</span>
          </button>

          {isExpanded && node.children && node.children.length > 0 && (
            <div className="border-l border-border/40 ml-3.5">
              {node.children.map((child) => renderNode(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    return (
      <button
        key={node.path}
        type="button"
        onClick={() => onOpenFile(node.path)}
        style={{ paddingLeft: `${depth * 14 + 18}px` }}
        className={`w-full flex items-center gap-2 py-1 text-left text-xs rounded-lg transition-colors cursor-pointer ${
          isSelected
            ? 'bg-primary/15 text-primary font-medium shadow-xs'
            : 'text-muted hover:text-main hover:bg-surface-hover'
        }`}
      >
        {getFileIcon(node.name)}
        <span className="truncate font-mono text-[11px]">{node.name}</span>
      </button>
    );
  };


  const category = selectedFilePath
    ? detectCategory(selectedFilePath, selectedFileContent?.category)
    : 'text';

  const rawUrl = selectedFilePath
    ? api.getWorkspaceRawUrl(selectedFilePath, rootPath)
    : '';

  const downloadUrl = selectedFilePath
    ? api.getWorkspaceRawUrl(selectedFilePath, rootPath, true)
    : '';

  // Render format-specific file preview
  const renderPreviewContent = () => {
    if (isLoadingFile) {
      return (
        <div className="flex flex-col items-center justify-center h-48 text-xs text-muted">
          <Loader2 className="w-5 h-5 animate-spin mb-2 text-primary" />
          <span>Wczytywanie zawartości pliku...</span>
        </div>
      );
    }

    if (!selectedFileContent) {
      return (
        <div className="p-4 text-xs text-subtle font-mono">
          Brak danych pliku.
        </div>
      );
    }

    // 1. Image Preview
    if (category === 'image') {
      const src = selectedFileContent.dataUrl || rawUrl;
      return (
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-surface/30 text-xs text-subtle">
            <div className="flex items-center gap-2">
              <span>Zoom: {Math.round(imageZoom * 100)}%</span>
              {imageDimensions && (
                <span>
                  • {imageDimensions.width} × {imageDimensions.height} px
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setImageZoom((z) => Math.max(0.25, z - 0.25))}
                title="Pomniejsz"
                className="p-1 hover:bg-surface-hover rounded text-muted hover:text-main cursor-pointer"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setImageZoom(1)}
                title="Rozmiar 100%"
                className="px-1.5 py-0.5 hover:bg-surface-hover rounded text-[11px] text-muted hover:text-main cursor-pointer"
              >
                1:1
              </button>
              <button
                type="button"
                onClick={() => setImageZoom((z) => Math.min(4, z + 0.25))}
                title="Powiększ"
                className="p-1 hover:bg-surface-hover rounded text-muted hover:text-main cursor-pointer"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px] bg-surface/20">
            <img
              src={src}
              alt={selectedFilePath || 'Podgląd obrazu'}
              style={{
                transform: `scale(${imageZoom})`,
                transformOrigin: 'center center',
                transition: 'transform 0.15s ease-out',
              }}
              onLoad={(e) => {
                const img = e.currentTarget;
                setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
              }}
              className="max-w-full max-h-[70vh] object-contain rounded-md shadow-md border border-border/50 select-none"
            />
          </div>
        </div>
      );
    }

    // 2. Audio Preview
    if (category === 'audio') {
      const src = selectedFileContent.dataUrl || rawUrl;
      return (
        <div className="h-full flex flex-col items-center justify-center p-6 text-center">
          <div className="p-4 rounded-full bg-amber-500/10 text-amber-500 mb-4 shadow-xs">
            <Music className="w-10 h-10" />
          </div>
          <h4 className="font-mono text-sm font-semibold text-main mb-1">
            {selectedFilePath?.split('/').pop()}
          </h4>
          <p className="text-xs text-subtle mb-6">{formatFileSize(selectedFileContent.size)}</p>
          <audio controls src={src} className="w-full max-w-md shadow-xs rounded-lg">
            Twoja przeglądarka nie obsługuje odtwarzacza audio.
          </audio>
        </div>
      );
    }

    // 3. Video Preview
    if (category === 'video') {
      const src = selectedFileContent.dataUrl || rawUrl;
      return (
        <div className="h-full flex flex-col items-center justify-center p-4">
          <video
            controls
            src={src}
            className="max-w-full max-h-[70vh] rounded-lg shadow-lg border border-border bg-black"
          >
            Twoja przeglądarka nie obsługuje odtwarzacza wideo.
          </video>
        </div>
      );
    }

    // 4. PDF Preview
    if (category === 'pdf') {
      const src = selectedFileContent.dataUrl || rawUrl;
      return (
        <div className="h-full flex flex-col">
          <iframe
            src={src}
            title="Podgląd dokumentu PDF"
            className="w-full flex-1 border-none rounded-b bg-white min-h-[450px]"
          />
        </div>
      );
    }

    // 5. Markdown Preview
    if (category === 'markdown' && markdownMode === 'preview') {
      return (
        <div className="flex-1 overflow-auto p-4 md:p-6 max-w-4xl mx-auto w-full">
          <MarkdownRenderer content={selectedFileContent.content} />
        </div>
      );
    }

    // 6. Binary Preview (Hex Dump)
    if (category === 'binary') {
      const rawHex = selectedFileContent.content || '';
      return (
        <div className="h-full flex flex-col p-4 overflow-auto">
          <div className="p-3 mb-4 rounded-lg bg-surface border border-border flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-main block">Plik binarny</span>
              <span className="text-[11px] text-subtle">
                Format niedostępny jako tekst ({formatFileSize(selectedFileContent.size)}).
              </span>
            </div>
            <a
              href={downloadUrl}
              download
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary-hover transition-colors shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              Pobierz cały plik
            </a>
          </div>

          <div className="text-[11px] font-mono text-muted mb-2">
            Podgląd pierwszych bajtów (Hex Dump):
          </div>
          <div className="p-3 rounded-lg bg-black/40 border border-border font-mono text-xs text-subtle overflow-x-auto leading-relaxed">
            {rawHex || 'Brak danych'}
          </div>
        </div>
      );
    }

    // 7. Code, Text, JSON, and Raw Markdown (with line numbers)
    const lines = selectedFileContent.content ? selectedFileContent.content.split('\n') : [''];
    return (
      <div className="flex-1 overflow-auto flex text-xs font-mono">
        {/* Line numbers gutter */}
        <div className="select-none py-3 px-2 text-right text-subtle/50 bg-surface/30 border-r border-border min-w-[40px] shrink-0 leading-relaxed">
          {lines.map((_, idx) => (
            <div key={idx}>{idx + 1}</div>
          ))}
        </div>

        {/* Code Content */}
        <div className="flex-1 p-3 overflow-x-auto">
          <pre
            className={`font-mono text-xs leading-relaxed text-main ${
              wrapLines ? 'whitespace-pre-wrap break-words' : 'whitespace-pre'
            }`}
          >
            {selectedFileContent.content || '(Pusty plik)'}
          </pre>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Workspace Top Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-surface/50">
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
          onClick={() => onRefresh()}
          disabled={isLoadingTree}
          title="Odśwież strukturę"
          className="p-1 rounded-md text-subtle hover:text-main hover:bg-surface-hover transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoadingTree ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex-1 min-h-0 flex flex-col md:flex-row">
        {/* Tree Sidebar */}
        <div
          style={{
            width: isDesktop ? `${treeWidth}px` : '100%',
            height: isDesktop ? '100%' : `${treeHeightMobile}px`,
          }}
          className="flex flex-col border-b md:border-b-0 md:border-r border-border shrink-0 bg-surface/20 relative"
        >
          {/* Desktop Right Resize Handle */}
          <div className="hidden md:block absolute right-0 top-0 bottom-0 translate-x-1/2 z-40">
            <ResizeHandle
              direction="horizontal"
              isDragging={isDraggingTree}
              onPointerDown={handleTreeDown}
              onPointerMove={handleTreeMove}
              onPointerUp={handleTreeUp}
              onDoubleClick={resetTreeWidth}
              title="Zmień szerokość drzewa katalogów (podwójne kliknięcie resetuje)"
            />
          </div>

          {/* Mobile Bottom Resize Handle */}
          <div className="md:hidden absolute bottom-0 left-0 right-0 translate-y-1/2 z-40 flex justify-center">
            <ResizeHandle
              direction="vertical"
              showPill={true}
              isDragging={isDraggingTreeMobile}
              onPointerDown={handleTreeMobileDown}
              onPointerMove={handleTreeMobileMove}
              onPointerUp={handleTreeMobileUp}
              onDoubleClick={resetTreeHeightMobile}
              title="Zmień wysokość listy plików (podwójne kliknięcie resetuje)"
              className="w-full h-4"
            />
          </div>

          {/* Quick Filter Bar */}
          <div className="p-2 border-b border-border/60 shrink-0">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-subtle" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filtruj pliki..."
                className="w-full pl-8 pr-7 py-1 text-xs rounded-md bg-surface border border-border text-main placeholder:text-subtle focus:outline-none focus:border-primary transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-subtle hover:text-main"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Directory Tree */}
          <div className="flex-1 p-2 overflow-y-auto">
            {isLoadingTree && filteredTree.length === 0 ? (
              <div className="flex items-center justify-center p-6 text-xs text-muted">
                <Loader2 className="w-4 h-4 animate-spin mr-2 text-primary" />
                Ładowanie plików...
              </div>
            ) : filteredTree.length === 0 ? (
              <div className="p-4 text-center text-xs text-subtle">
                {searchQuery ? 'Brak pasujących plików' : 'Brak plików w projekcie'}
              </div>
            ) : (
              filteredTree.map((node) => renderNode(node))
            )}
          </div>
        </div>

        {/* File Preview Area */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-card">
          {selectedFilePath ? (
            <div className="h-full flex flex-col">
              {/* Preview Header / Action Bar */}
              <div className="px-3 py-2 border-b border-border bg-surface/40 flex items-center justify-between gap-2 flex-wrap">
                {/* Left: file path and metadata */}
                <div className="flex items-center gap-2 min-w-0">
                  {getFileIcon(selectedFilePath, category)}
                  <span className="font-mono text-xs font-semibold text-main truncate">
                    {selectedFilePath.split('/').pop()}
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase font-semibold bg-surface text-subtle border border-border">
                    {category}
                  </span>
                  {selectedFileContent && (
                    <span className="text-[11px] text-subtle font-mono hidden sm:inline">
                      {formatFileSize(selectedFileContent.size)}
                    </span>
                  )}
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Markdown Preview/Raw Toggle */}
                  {category === 'markdown' && (
                    <div className="flex items-center bg-surface border border-border rounded-md p-0.5 mr-1">
                      <button
                        type="button"
                        onClick={() => setMarkdownMode('preview')}
                        className={`px-2 py-0.5 text-[11px] rounded transition-colors cursor-pointer flex items-center gap-1 ${
                          markdownMode === 'preview'
                            ? 'bg-primary text-white font-medium shadow-xs'
                            : 'text-subtle hover:text-main'
                        }`}
                      >
                        <Eye className="w-3 h-3" />
                        Podgląd
                      </button>
                      <button
                        type="button"
                        onClick={() => setMarkdownMode('raw')}
                        className={`px-2 py-0.5 text-[11px] rounded transition-colors cursor-pointer flex items-center gap-1 ${
                          markdownMode === 'raw'
                            ? 'bg-primary text-white font-medium shadow-xs'
                            : 'text-subtle hover:text-main'
                        }`}
                      >
                        <Code className="w-3 h-3" />
                        Źródło
                      </button>
                    </div>
                  )}

                  {/* Code Wrap Toggle */}
                  {(category === 'code' || category === 'text' || category === 'json' || (category === 'markdown' && markdownMode === 'raw')) && (
                    <button
                      type="button"
                      onClick={() => setWrapLines((w) => !w)}
                      title={wrapLines ? 'Wyłącz zawijanie wierszy' : 'Włącz zawijanie wierszy'}
                      className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                        wrapLines
                          ? 'bg-primary/15 text-primary'
                          : 'text-subtle hover:text-main hover:bg-surface-hover'
                      }`}
                    >
                      <WrapText className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Copy Button */}
                  {selectedFileContent?.content && !selectedFileContent.isBinary && (
                    <button
                      type="button"
                      onClick={handleCopy}
                      title="Kopiuj zawartość"
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-subtle hover:text-main hover:bg-surface-hover transition-colors cursor-pointer"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                          <span className="text-[11px] text-emerald-500 font-medium">Skopiowano</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span className="text-[11px] hidden sm:inline">Kopiuj</span>
                        </>
                      )}
                    </button>
                  )}

                  {/* Open Raw in New Tab */}
                  <a
                    href={rawUrl}
                    target="_blank"
                    rel="noreferrer"
                    title="Otwórz w nowej karcie"
                    className="p-1.5 rounded-md text-subtle hover:text-main hover:bg-surface-hover transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  {/* Download */}
                  <a
                    href={downloadUrl}
                    download
                    title="Pobierz plik"
                    className="p-1.5 rounded-md text-subtle hover:text-main hover:bg-surface-hover transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              {/* Breadcrumb sub-header with full path */}
              <div className="px-3 py-1.5 bg-surface/20 border-b border-border/60 text-[11px] font-mono text-subtle break-all select-all leading-relaxed">
                {selectedFilePath}
              </div>

              {/* Content Body */}
              <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                {renderPreviewContent()}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center text-subtle">
              <File className="w-10 h-10 mb-3 opacity-30 text-primary" />
              <p className="text-xs font-medium text-main mb-1">
                Wybierz plik z drzewa, aby podejrzeć jego zawartość
              </p>
              <p className="text-[11px] text-subtle max-w-xs">
                Obsługiwane są pliki kodu, dokumentacji Markdown, obrazy, audio, wideo oraz pliki binarne.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
