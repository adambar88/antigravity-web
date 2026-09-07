import { useCallback, useEffect, useState } from 'react';
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
import { ActiveTab, InspectorTab, ReasoningEffort, ToastMessage } from '@/types';

export default function App() {
  const { theme, toggleTheme } = useTheme();

  const {
    sessions,
    activeSessionId,
    setActiveSessionId,
    createNewSession,
    deleteSession,
    updateSessionTitle,
    updateLocalSessionTitle,
    updateSessionWorkspace,
  } = useSessions();

  const {
    session,
    messages,
    diffs,
    artifacts,
    subagents,
    connectionStatus,
    isGenerating,
    currentThought,
    streamingContent,
    activeTools,
    sendPrompt,
    abortGeneration,
    setMessages,
    refreshSubagents,
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

  // Synchronize live session title changes (e.g. from SSE session_title_updated) with the sessions sidebar list
  useEffect(() => {
    if (session?.id && session?.title) {
      updateLocalSessionTitle(session.id, session.title);
    }
  }, [session?.id, session?.title, updateLocalSessionTitle]);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('diffs');
  const [mobileTab, setMobileTab] = useState<ActiveTab>('chat');
  const [highlightDiffPath, setHighlightDiffPath] = useState<string | null>(null);
  const [selectedSubagentId, setSelectedSubagentId] = useState<string | null>(null);
  const [isNewSessionModalOpen, setIsNewSessionModalOpen] = useState(false);
  const [activeDiffsCount, setActiveDiffsCount] = useState(0);

  // Pending initial prompt for newly created session (Prompt-First Quick Launcher)
  const [pendingInitialPrompt, setPendingInitialPrompt] = useState<{
    text: string;
    model?: string;
    effort?: ReasoningEffort;
  } | null>(null);

  useEffect(() => {
    if (
      pendingInitialPrompt &&
      activeSessionId &&
      (connectionStatus === 'connected' || connectionStatus === 'streaming')
    ) {
      const promptToSend = pendingInitialPrompt;
      setPendingInitialPrompt(null);
      sendPrompt(promptToSend.text, promptToSend.model, promptToSend.effort);
    }
  }, [pendingInitialPrompt, activeSessionId, connectionStatus, sendPrompt]);

  useEffect(() => {
    if (!pendingInitialPrompt || !activeSessionId) return;
    const timer = setTimeout(() => {
      if (pendingInitialPrompt) {
        const promptToSend = pendingInitialPrompt;
        setPendingInitialPrompt(null);
        sendPrompt(promptToSend.text, promptToSend.model, promptToSend.effort);
      }
    }, 1200);
    return () => clearTimeout(timer);
  }, [pendingInitialPrompt, activeSessionId, sendPrompt]);

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

  // When opening subagents tab (optionally focusing a specific subagent)
  const handleOpenSubagents = useCallback((subagentId?: string) => {
    if (subagentId) {
      setSelectedSubagentId(subagentId);
    }
    setInspectorTab('subagents');
    setIsInspectorOpen(true);
    setMobileTab('subagents');
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
    } else if (tab === 'subagents') {
      setInspectorTab('subagents');
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
        subagents={subagents}
        onSelectSubagent={(subId) => {
          handleOpenSubagents(subId);
        }}
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
              onOpenSubagents={() => handleOpenSubagents()}
            />

            {/* Prompt Composer input bar */}
            <PromptComposer
              onSend={(prompt, model, effort, attachments) => sendPrompt(prompt, model, effort, attachments)}
              onAbort={abortGeneration}
              onClearCanvas={() => {
                setMessages([]);
                addToast('info', 'Widok rozmowy został wyczyszczony');
              }}
              isGenerating={isGenerating}
            />
          </div>

          {/* Inspector Panel (Diffs, File Tree, Artifacts/Plans, Subagents) */}
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
            sessionId={activeSessionId}
            subagents={subagents}
            selectedSubagentId={selectedSubagentId}
            onRefreshSubagents={refreshSubagents}
            isGenerating={isGenerating}
          />
        </div>

        {/* Mobile Navigation bar */}
        <MobileNavigation
          activeTab={mobileTab}
          onTabSelect={handleMobileTabSelect}
          diffsCount={activeDiffsCount || diffs.length}
          subagentsCount={subagents.length}
          artifactsCount={artifacts.length}
        />
      </div>

      {/* New Session Modal with Workspace selection */}
      <NewSessionModal
        isOpen={isNewSessionModalOpen}
        onClose={() => setIsNewSessionModalOpen(false)}
        defaultWorkspacePath={activeWorkspacePath}
        onSubmit={async (params) => {
          await createNewSession({
            title: params.title,
            workspace_path: params.workspace_path,
            model: params.model,
            effort: params.effort,
            initialPrompt: params.initialPrompt,
            auto_title: params.auto_title,
          });
          addToast('success', `Utworzono zadanie w katalogu: ${params.workspace_path}`);
          if (params.initialPrompt?.trim()) {
            setPendingInitialPrompt({
              text: params.initialPrompt.trim(),
              model: params.model,
              effort: params.effort,
            });
          }
        }}
      />

      {/* Floating Polish Toast Notifications */}
      <ToastNotification toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
