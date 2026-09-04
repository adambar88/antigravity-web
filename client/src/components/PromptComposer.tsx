import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  ArrowUp,
  BookOpen,
  Brain,
  CheckCircle2,
  ChevronDown,
  Clock,
  Cpu,
  FileSearch,
  FolderKanban,
  Gauge,
  HelpCircle,
  ListTodo,
  LogOut,
  Sparkles,
  Square,
  Target,
  Terminal,
  Trash2,
  Users,
  Zap,
} from 'lucide-react';
import { ReasoningEffort } from '@/types';
import { useResizable } from '@/hooks/useResizable';
import { ResizeHandle } from './ResizeHandle';

interface SlashCommand {
  command: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const SLASH_COMMANDS: SlashCommand[] = [
  {
    command: '/plan',
    label: 'Opracuj plan',
    description: 'Przygotuj uporządkowany plan działania krok po kroku',
    icon: ListTodo,
  },
  {
    command: '/review',
    label: 'Przegląd zmian (diff)',
    description: 'Dokonaj analizy i oceny wprowadzonych zmian w kodzie',
    icon: FileSearch,
  },
  {
    command: '/goal',
    label: 'Tryb celu (autonomiczny)',
    description: 'Autonomiczna realizacja zadania bez zatrzymywania się',
    icon: Target,
  },
  {
    command: '/models',
    label: 'Lista modeli AI',
    description: 'Wyświetl pełną listę obsługiwanych modeli',
    icon: Cpu,
  },
  {
    command: '/model',
    label: 'Przełącz model',
    description: 'Wybierz model AI dla bieżącej sesji',
    icon: Brain,
  },
  {
    command: '/effort',
    label: 'Poziom myślenia',
    description: 'Dostosuj wysiłek analityczny (low, medium, high)',
    icon: Sparkles,
  },
  {
    command: '/status',
    label: 'Status sesji',
    description: 'Telemetria, parametry, gałąź Git i środowisko',
    icon: Activity,
  },
  {
    command: '/tasks',
    label: 'Zadania w tle',
    description: 'Pokaż aktywne procesy i status zadań asynchronicznych',
    icon: Gauge,
  },
  {
    command: '/artifacts',
    label: 'Artefakty i plany',
    description: 'Lista zapisanych planów, diffów i dokumentów',
    icon: FolderKanban,
  },
  {
    command: '/boost',
    label: 'Boost Mode',
    description: 'Maksymalna analiza, pre-mortem i rygorystyczne testy',
    icon: Zap,
  },
  {
    command: '/grill-me',
    label: 'Wywiad architektoniczny',
    description: 'Krytyczny wywiad z pytaniami o założenia projektu',
    icon: HelpCircle,
  },
  {
    command: '/teamwork-preview',
    label: 'Zespół agentów (Swarm)',
    description: 'Koordynacja wyspecjalizowanych subagentów',
    icon: Users,
  },
  {
    command: '/schedule',
    label: 'Harmonogram / Timer',
    description: 'Zaplanuj timer lub zadanie cykliczne cron',
    icon: Clock,
  },
  {
    command: '/skills',
    label: 'Dostępne umiejętności',
    description: 'Lista zarejestrowanych skilli w projekcie',
    icon: Terminal,
  },
  {
    command: '/agents',
    label: 'Dostępni agenci',
    description: 'Role agentów: Builder, Tester, Challenger, Evaluator',
    icon: Users,
  },
  {
    command: '/learn',
    label: 'Zapisz regułę',
    description: 'Utrwal wiedzę w projekcie dla przyszłych zadań',
    icon: BookOpen,
  },
  {
    command: '/help',
    label: 'Pomoc Antigravity CLI',
    description: 'Pełna lista poleceń slash i przewodnik',
    icon: HelpCircle,
  },
  {
    command: '/logout',
    label: 'Wyloguj / zmień konto',
    description: 'Zarządzaj kontem Google i zmień profil logowania',
    icon: LogOut,
  },
  {
    command: '/clear',
    label: 'Wyczyść stan',
    description: 'Zresetuj stan sesji do spoczynku',
    icon: Trash2,
  },
];

interface PromptComposerProps {
  onSend: (prompt: string, model?: string, effort?: ReasoningEffort) => void;
  onAbort?: () => void;
  onClearCanvas?: () => void;
  isGenerating?: boolean;
  disabled?: boolean;
}

export const PromptComposer: React.FC<PromptComposerProps> = ({
  onSend,
  onAbort,
  onClearCanvas,
  isGenerating = false,
  disabled = false,
}) => {
  const [text, setText] = useState('');
  const [effort, setEffort] = useState<ReasoningEffort>('medium');
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.8-flash-medium');
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [selectedSlashIndex, setSelectedSlashIndex] = useState(0);
  const [showEffortMenu, setShowEffortMenu] = useState(false);
  const [showModelMenu, setShowModelMenu] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const [isManualHeight, setIsManualHeight] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return Boolean(localStorage.getItem('ag_composer_height_manual'));
    }
    return false;
  });

  const {
    size: composerHeight,
    isDragging: isDraggingHeight,
    resetSize: resetComposerHeight,
    handlePointerDown: handleHeightDown,
  } = useResizable({
    initialSize: 120,
    minSize: 44,
    maxSize: () => (typeof window !== 'undefined' ? Math.min(450, window.innerHeight * 0.55) : 400),
    direction: 'vertical',
    reverse: true, // Dragging up increases height
    storageKey: 'ag_composer_height',
    getCurrentSize: () => {
      if (textareaRef.current) {
        return textareaRef.current.getBoundingClientRect().height;
      }
      return 44;
    },
    onResize: () => {
      setIsManualHeight(true);
      if (typeof window !== 'undefined') {
        localStorage.setItem('ag_composer_height_manual', 'true');
      }
    },
  });

  const handleResetHeight = () => {
    resetComposerHeight();
    setIsManualHeight(false);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('ag_composer_height_manual');
    }
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  // Auto-resize textarea
  const adjustHeight = () => {
    const el = textareaRef.current;
    if (!el) return;
    if (isManualHeight) {
      el.style.height = `${composerHeight}px`;
      return;
    }
    el.style.height = 'auto';
    const newHeight = Math.min(el.scrollHeight, 180);
    el.style.height = `${Math.max(newHeight, 44)}px`;
  };

  useEffect(() => {
    adjustHeight();
  }, [text, isManualHeight, composerHeight]);

  const filteredSlashCommands = SLASH_COMMANDS.filter((cmd) => {
    if (!text.startsWith('/')) return false;
    const searchWord = text.split(/\s+/)[0].toLowerCase();
    return cmd.command.toLowerCase().startsWith(searchWord);
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);

    // Show slash commands popup if input starts with '/' or last word starts with '/'
    if (val.startsWith('/') && !val.includes(' ')) {
      const filtered = SLASH_COMMANDS.filter((cmd) =>
        cmd.command.toLowerCase().startsWith(val.toLowerCase())
      );
      setShowSlashMenu(filtered.length > 0);
      setSelectedSlashIndex(0);
    } else {
      setShowSlashMenu(false);
    }
  };

  const handleSelectSlashCommand = (cmd: SlashCommand) => {
    if (cmd.command === '/clear') {
      setText('');
      setShowSlashMenu(false);
      onClearCanvas?.();
      return;
    }
    if (cmd.command === '/model') {
      setText('');
      setShowSlashMenu(false);
      setShowModelMenu(true);
      return;
    }
    if (cmd.command === '/effort') {
      setText('');
      setShowSlashMenu(false);
      setShowEffortMenu(true);
      return;
    }
    setText(`${cmd.command} `);
    setShowSlashMenu(false);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSlashMenu && filteredSlashCommands.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedSlashIndex((prev) => (prev + 1) % filteredSlashCommands.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedSlashIndex((prev) => (prev - 1 + filteredSlashCommands.length) % filteredSlashCommands.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const selected = filteredSlashCommands[selectedSlashIndex] || filteredSlashCommands[0];
        if (selected) {
          handleSelectSlashCommand(selected);
        }
        return;
      }
      if (e.key === 'Escape') {
        setShowSlashMenu(false);
        return;
      }
    }

    const isMobileDevice =
      typeof window !== 'undefined' &&
      (window.matchMedia('(max-width: 768px)').matches ||
        window.matchMedia('(pointer: coarse)').matches);

    // On mobile devices: Enter inserts a new line (default behavior).
    // Sending is handled by tapping the Send button (↑) or pressing Ctrl/Cmd+Enter with an external keyboard.
    if (isMobileDevice) {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSubmit();
      }
      return;
    }

    // On desktop: Enter sends, Shift+Enter inserts a new line.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    if (!text.trim() || isGenerating || disabled) return;
    onSend(text.trim(), selectedModel, effort);
    setText('');
    setShowSlashMenu(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = '44px';
    }
  };

  const effortLabels: Record<ReasoningEffort, { title: string; shortTitle: string; desc: string }> = {
    high: { title: 'Głęboka analiza', shortTitle: 'Głęboka', desc: 'Maksymalna precyzja i wieloetapowe rozumowanie' },
    medium: { title: 'Standardowa analiza', shortTitle: 'Standard', desc: 'Optymalny balans między szybkością a dokładnością' },
    low: { title: 'Szybka odpowiedź', shortTitle: 'Szybka', desc: 'Krótkie wnioskowanie dla prostych pytań' },
  };

  const modelOptions = [
    { id: 'gemini-3.8-flash-medium', name: 'Gemini 3.8 Flash', shortName: 'Flash', tag: 'Domyślny' },
    { id: 'gemini-3.8-flash-high', name: 'Gemini 3.8 Flash (High)', shortName: 'Flash High', tag: 'Głęboki' },
    { id: 'gemini-3.7-flash-high', name: 'Gemini 3.7 Flash', shortName: '3.7 Flash', tag: 'Szybki' },
    { id: 'gemini-3.1-pro-high', name: 'Gemini 3.1 Pro', shortName: 'Pro', tag: 'Pro' },
    { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', shortName: 'Sonnet', tag: 'Thinking' },
    { id: 'claude-opus-4-6-thinking', name: 'Claude Opus 4.6', shortName: 'Opus', tag: 'Reasoning' },
    { id: 'gpt-oss-120b-medium', name: 'GPT-OSS 120B', shortName: 'GPT-OSS', tag: 'Open Source' },
  ];

  const currentModel = modelOptions.find((m) => m.id === selectedModel) || {
    id: selectedModel,
    name: selectedModel,
    shortName: selectedModel.replace('gemini-', '').replace('claude-', ''),
    tag: '',
  };

  return (
    <div className="relative w-full max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto px-3 sm:px-4 pb-3">
      {/* Slash command popover */}
      {showSlashMenu && filteredSlashCommands.length > 0 && (
        <div className="absolute bottom-full mb-2 left-3 sm:left-4 w-80 max-w-[calc(100vw-24px)] bg-surface border border-border rounded-2xl shadow-xl overflow-hidden z-30 transition-all">
          <div className="p-2 border-b border-border text-[11px] font-medium text-muted uppercase tracking-wider">
            Polecenia slash ({filteredSlashCommands.length})
          </div>
          <div className="p-1 space-y-0.5 max-h-60 overflow-y-auto">
            {filteredSlashCommands.map((cmd, idx) => {
              const Icon = cmd.icon;
              const isSelected = idx === selectedSlashIndex;
              return (
                <button
                  key={cmd.command}
                  type="button"
                  onClick={() => handleSelectSlashCommand(cmd)}
                  className={`w-full flex items-start gap-2.5 p-2 rounded-xl text-left transition-colors cursor-pointer ${
                    isSelected ? 'bg-primary/10 text-primary' : 'text-main hover:bg-surface-hover'
                  }`}
                >
                  <div className={`p-1.5 rounded-lg shrink-0 ${isSelected ? 'bg-primary/20' : 'bg-card'}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 font-medium text-xs">
                      <span>{cmd.label}</span>
                      <code className="text-[11px] font-mono text-muted bg-card px-1 py-0.2 rounded border border-border">
                        {cmd.command}
                      </code>
                    </div>
                    <p className="text-[11px] text-muted truncate mt-0.5">
                      {cmd.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main composer box: clean textarea + discreet bottom bar */}
      <div className="flex flex-col rounded-2xl border border-border bg-surface shadow-md focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all relative">
        {/* Top Resize Handle Bar (generous touch hit target) */}
        <ResizeHandle
          direction="vertical"
          showPill={true}
          isDragging={isDraggingHeight}
          onPointerDown={handleHeightDown}
          onDoubleClick={handleResetHeight}
          title="Przeciągnij w górę, aby powiększyć pole pisania (podwójne kliknięcie: auto)"
          className="w-full h-8 pt-1.5 pb-1 cursor-row-resize"
        />

        {/* Unobstructed typing area */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          enterKeyHint="enter"
          placeholder="Napisz wiadomość lub wpisz / aby wybrać polecenie..."
          rows={1}
          disabled={disabled}
          style={isManualHeight ? { height: `${composerHeight}px`, maxHeight: 'none' } : undefined}
          className="w-full resize-none bg-transparent px-3.5 pt-0.5 pb-1 text-sm text-main placeholder:text-muted focus:outline-hidden min-h-[44px]"
        />

        {/* Discreet bottom action bar */}
        <div className="flex items-center justify-between px-2.5 pb-2 pt-1 border-t border-border/20">
          <div className="relative flex items-center gap-1">
            {/* Discreet Model selector */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowModelMenu(!showModelMenu);
                  setShowEffortMenu(false);
                }}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-muted hover:text-main hover:bg-surface-hover transition-colors cursor-pointer"
                title="Wybierz model"
              >
                <Brain className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="hidden sm:inline">{currentModel.name}</span>
                <span className="sm:hidden">{currentModel.shortName}</span>
                <ChevronDown className="w-2.5 h-2.5 opacity-50" />
              </button>

              {showModelMenu && (
                <div className="absolute bottom-full mb-2 left-0 w-64 max-w-[calc(100vw-32px)] bg-surface border border-border rounded-xl shadow-xl p-1.5 z-40">
                  <div className="text-[11px] font-medium text-muted px-2 py-1">
                    Wybierz model Antigravity:
                  </div>
                  {modelOptions.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setSelectedModel(opt.id);
                        setShowModelMenu(false);
                      }}
                      className={`w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                        selectedModel === opt.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-surface-hover text-main'
                      }`}
                    >
                      <div>
                        <div className="font-semibold">{opt.name}</div>
                        <div className="text-[10px] text-muted">{opt.tag}</div>
                      </div>
                      {selectedModel === opt.id && <CheckCircle2 className="w-3.5 h-3.5 shrink-0 ml-2" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <span className="text-border/60 text-xs select-none">•</span>

            {/* Discreet Effort selector */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowEffortMenu(!showEffortMenu);
                  setShowModelMenu(false);
                }}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-muted hover:text-main hover:bg-surface-hover transition-colors cursor-pointer"
                title="Wybierz poziom analizy"
              >
                <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="hidden sm:inline">{effortLabels[effort].title}</span>
                <span className="sm:hidden">{effortLabels[effort].shortTitle}</span>
                <ChevronDown className="w-2.5 h-2.5 opacity-50" />
              </button>

              {showEffortMenu && (
                <div className="absolute bottom-full mb-2 left-0 w-64 max-w-[calc(100vw-32px)] bg-surface border border-border rounded-xl shadow-xl p-1.5 z-40">
                  <div className="text-[11px] font-medium text-muted px-2 py-1">
                    Wybierz poziom analizy:
                  </div>
                  {(['high', 'medium', 'low'] as ReasoningEffort[]).map((eff) => (
                    <button
                      key={eff}
                      type="button"
                      onClick={() => {
                        setEffort(eff);
                        setShowEffortMenu(false);
                      }}
                      className={`w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                        effort === eff ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-surface-hover text-main'
                      }`}
                    >
                      <div>
                        <div className="font-semibold">{effortLabels[eff].title}</div>
                        <div className="text-[10px] text-muted leading-tight">{effortLabels[eff].desc}</div>
                      </div>
                      {effort === eff && <CheckCircle2 className="w-3.5 h-3.5 shrink-0 ml-2" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isGenerating ? (
              <button
                type="button"
                onClick={onAbort}
                title="Wstrzymaj generowanie"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <Square className="w-3 h-3 fill-current" />
                <span className="text-[11px]">Zatrzymaj</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!text.trim() || disabled}
                title="Wyślij wiadomość (Enter)"
                className="p-2 rounded-xl bg-primary hover:bg-primary-hover disabled:opacity-40 disabled:hover:bg-primary text-white shadow-xs transition-all duration-150 cursor-pointer disabled:cursor-not-allowed"
              >
                <ArrowUp className="w-4 h-4 stroke-[2.5]" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="hidden sm:block text-center mt-2 text-[11px] text-subtle">
        Wciśnij <kbd className="px-1 py-0.5 rounded bg-card border border-border font-mono text-[10px]">Enter</kbd> aby wysłać, <kbd className="px-1 py-0.5 rounded bg-card border border-border font-mono text-[10px]">Shift+Enter</kbd> dla nowej linii.
      </div>
    </div>
  );
};

