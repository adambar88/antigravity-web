import { useCallback, useState } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { useSessions } from '@/hooks/useSessions';
import { useSessionStream } from '@/hooks/useSessionStream';
import { useScrollAnchor } from '@/hooks/useScrollAnchor';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { ChatCanvas } from '@/components/ChatCanvas';
import { PromptComposer } from '@/components/PromptComposer';
import { Inspector } from '@/components/Inspector';
import { MobileNavigation } from '@/components/MobileNavigation';
import { ToastNotification } from '@/components/ToastNotification';
import { NewSessionModal } from '@/components/NewSessionModal';
import { ActiveTab, InspectorTab, ToastMessage } from '@/types';

export default function App() {
  const { theme, toggleTheme } = useTheme();

  const {
    sessions,
    activeSessionId,
    setActiveSessionId,
    createNewSession,
    deleteSession,
    updateSessionTitle,
    updateSessionWorkspace,
  } = useSessions();

  const {
    session,
    messages,
    diffs,
    artifacts,
    connectionStatus,
    isGenerating,
    currentThought,
    streamingContent,
    activeTools,
    sendPrompt,
    abortGeneration,
    setMessages,
  } = useSessionStream(activeSessionId);

  // Scroll anchoring: watches streaming messages & thinking updates
  const {
    containerRef,
    showScrollBadge,
    scrollToBottom,
    handleScroll,
  } = useScrollAnchor([
    messages.length,
    streamingContent,
    currentThought.thought,
    activeTools.length,
  ]);

  // UI Panels state
  const [isSidebarMobileOpen, setIsSidebarMobileOpen] = useState(false);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('diffs');
  const [mobileTab, setMobileTab] = useState<ActiveTab>('chat');
  const [highlightDiffPath, setHighlightDiffPath] = useState<string | null>(null);
  const [isNewSessionModalOpen, setIsNewSessionModalOpen] = useState(false);
  const [activeDiffsCount, setActiveDiffsCount] = useState(0);

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback(
    (
      type: 'info' | 'success' | 'warning' | 'error',
      message: string,
      action?: { label: string; onClick: () => void },
      duration?: number
    ) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      // Keep at most 3 active toasts in queue to prevent clutter
      setToasts((prev) => [...prev.slice(-2), { id, type, message, action, duration }]);
    },
    []
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // When clicking diff badge in tool execution card
  const handleViewDiff = useCallback((filePath: string) => {
    setHighlightDiffPath(filePath);
    setInspectorTab('diffs');
    setIsInspectorOpen(true);
    setMobileTab('diffs');
  }, []);

  // Handle mobile bottom navigation
  const handleMobileTabSelect = (tab: ActiveTab) => {
    setMobileTab(tab);
    if (tab === 'sessions') {
      setIsSidebarMobileOpen(true);
      setIsInspectorOpen(false);
    } else if (tab === 'diffs') {
      setInspectorTab('diffs');
      setIsInspectorOpen(true);
      setIsSidebarMobileOpen(false);
    } else if (tab === 'files') {
      setInspectorTab('files');
      setIsInspectorOpen(true);
      setIsSidebarMobileOpen(false);
    } else if (tab === 'artifacts') {
      setInspectorTab('artifacts');
      setIsInspectorOpen(true);
      setIsSidebarMobileOpen(false);
    } else {
      setIsInspectorOpen(false);
      setIsSidebarMobileOpen(false);
    }
  };

  const activeTitle =
    sessions.find((s) => s.id === activeSessionId)?.title ||
    session?.title ||
    'Nowe zadanie';

  const activeWorkspacePath =
    session?.workspace_path ||
    sessions.find((s) => s.id === activeSessionId)?.workspace_path ||
    '/home/adam';

  return (
    <div className="flex h-screen h-dvh w-screen overflow-hidden bg-app text-main">
      {/* Sidebar: Desktop + Mobile Drawer */}
      <Sidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={(id) => {
          setActiveSessionId(id);
          setIsSidebarMobileOpen(false);
          setMobileTab('chat');
        }}
        onCreateSession={() => {
          setIsNewSessionModalOpen(true);
        }}
        onDeleteSession={(id) => {
          deleteSession(id);
          addToast('info', 'Zadanie zostało usunięte');
        }}
        isOpenMobile={isSidebarMobileOpen}
        onCloseMobile={() => setIsSidebarMobileOpen(false)}
      />

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Header */}
        <Header
          sessionTitle={activeTitle}
          workspacePath={activeWorkspacePath}
          connectionStatus={connectionStatus}
          theme={theme}
          onToggleTheme={toggleTheme}
          onToggleSidebar={() => setIsSidebarMobileOpen(true)}
          onToggleInspector={() => setIsInspectorOpen((prev) => !prev)}
          onUpdateTitle={(newTitle) => {
            if (activeSessionId) {
              updateSessionTitle(activeSessionId, newTitle);
              addToast('success', 'Zaktualizowano nazwę zadania');
            }
          }}
          onUpdateWorkspace={(newPath) => {
            if (activeSessionId) {
              updateSessionWorkspace(activeSessionId, newPath);
              addToast('success', `Zmieniono katalog roboczy na: ${newPath}`);
            }
          }}
          isInspectorOpen={isInspectorOpen}
        />

        {/* Central Workspace Content: Chat + Inspector */}
        <div className="flex-1 flex min-h-0 overflow-hidden relative">
          {/* Mobile backdrop when Inspector is open */}
          {isInspectorOpen && (
            <div
              onClick={() => {
                setIsInspectorOpen(false);
                setMobileTab('chat');
              }}
              className="fixed inset-0 bg-black/25 backdrop-blur-[1px] z-30 md:hidden transition-opacity"
            />
          )}

          {/* Chat Canvas Area */}
          <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden transition-all flex">
            <ChatCanvas
              messages={messages}
              currentThought={currentThought}
              streamingContent={streamingContent}
              activeTools={activeTools}
              isGenerating={isGenerating}
              containerRef={containerRef}
              showScrollBadge={showScrollBadge}
              onScroll={handleScroll}
              onScrollToBottom={() => scrollToBottom(true)}
              onAbort={() => {
                abortGeneration();
                addToast('warning', 'Wstrzymano generowanie odpowiedzi');
              }}
              onQuickPrompt={(text) => sendPrompt(text)}
              onViewDiff={handleViewDiff}
            />

            {/* Prompt Composer input bar */}
            <PromptComposer
              onSend={(prompt, model, effort) => sendPrompt(prompt, model, effort)}
              onAbort={abortGeneration}
              onClearCanvas={() => {
                setMessages([]);
                addToast('info', 'Widok rozmowy został wyczyszczony');
              }}
              isGenerating={isGenerating}
            />
          </div>

          {/* Inspector Panel (Diffs, File Tree, Artifacts/Plans) */}
          <Inspector
            isOpen={isInspectorOpen}
            onClose={() => {
              setIsInspectorOpen(false);
              setMobileTab('chat');
            }}
            diffs={diffs}
            artifacts={artifacts}
            activeTab={inspectorTab}
            onTabChange={(tab) => setInspectorTab(tab)}
            highlightFilePath={highlightDiffPath}
            workspacePath={activeWorkspacePath}
            onDiffsCountChange={(count) => setActiveDiffsCount(count)}
          />
        </div>

        {/* Mobile Navigation bar */}
        <MobileNavigation
          activeTab={mobileTab}
          onTabSelect={handleMobileTabSelect}
          diffsCount={activeDiffsCount || diffs.length}
        />
      </div>

      {/* New Session Modal with Workspace selection */}
      <NewSessionModal
        isOpen={isNewSessionModalOpen}
        onClose={() => setIsNewSessionModalOpen(false)}
        defaultWorkspacePath={activeWorkspacePath}
        onSubmit={async (params) => {
          await createNewSession(params);
          addToast('success', `Utworzono zadanie w katalogu: ${params.workspace_path}`);
        }}
      />

      {/* Floating Polish Toast Notifications */}
      <ToastNotification toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
