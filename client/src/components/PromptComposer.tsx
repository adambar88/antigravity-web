import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  Brain,
  CheckCircle2,
  FileSearch,
  ListTodo,
  Sparkles,
  Square,
  Trash2,
} from 'lucide-react';
import { ReasoningEffort } from '@/types';

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
    label: 'Przegląd kodu',
    description: 'Dokonaj analizy i oceny wprowadzonych zmian',
    icon: FileSearch,
  },
  {
    command: '/model',
    label: 'Tryb myślenia',
    description: 'Dostosuj poziom wysiłku analitycznego modelu',
    icon: Brain,
  },
  {
    command: '/clear',
    label: 'Wyczyść widok',
    description: 'Zresetuj bieżący widok rozmowy',
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
  const [effort, setEffort] = useState<ReasoningEffort>('high');
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [selectedSlashIndex, setSelectedSlashIndex] = useState(0);
  const [showEffortMenu, setShowEffortMenu] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-resize textarea
  const adjustHeight = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const newHeight = Math.min(el.scrollHeight, 200);
    el.style.height = `${Math.max(newHeight, 44)}px`;
  };

  useEffect(() => {
    adjustHeight();
  }, [text]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);

    // Show slash commands popup if input starts with '/' or last word starts with '/'
    if (val.startsWith('/') && !val.includes(' ')) {
      setShowSlashMenu(true);
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
      setShowEffortMenu(true);
      return;
    }
    // For /plan or /review, populate friendly text
    if (cmd.command === '/plan') {
      setText('Przygotuj szczegółowy plan implementacji dla tego zadania: ');
    } else if (cmd.command === '/review') {
      setText('Przejrzyj dotychczasowe zmiany w kodzie i sprawdź jakość implementacji.');
    } else {
      setText(`${cmd.command} `);
    }
    setShowSlashMenu(false);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSlashMenu) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedSlashIndex((prev) => (prev + 1) % SLASH_COMMANDS.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedSlashIndex((prev) => (prev - 1 + SLASH_COMMANDS.length) % SLASH_COMMANDS.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        handleSelectSlashCommand(SLASH_COMMANDS[selectedSlashIndex]);
        return;
      }
      if (e.key === 'Escape') {
        setShowSlashMenu(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    if (!text.trim() || isGenerating || disabled) return;
    onSend(text.trim(), undefined, effort);
    setText('');
    setShowSlashMenu(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = '44px';
    }
  };

  const effortLabels: Record<ReasoningEffort, { title: string; desc: string }> = {
    high: { title: 'Głęboka analiza', desc: 'Maksymalna precyzja i wieloetapowe rozumowanie' },
    medium: { title: 'Standardowa analiza', desc: 'Optymalny balans między szybkością a dokładnością' },
    low: { title: 'Szybka odpowiedź', desc: 'Krótkie wnioskowanie dla prostych pytań' },
  };

  return (
    <div className="relative w-full max-w-4xl mx-auto px-4 pb-3">
      {/* Slash command popover */}
      {showSlashMenu && (
        <div className="absolute bottom-full mb-2 left-4 w-80 bg-surface border border-border rounded-2xl shadow-xl overflow-hidden z-30 transition-all">
          <div className="p-2 border-b border-border text-[11px] font-medium text-muted uppercase tracking-wider">
            Dostępne polecenia
          </div>
          <div className="p-1 space-y-0.5">
            {SLASH_COMMANDS.map((cmd, idx) => {
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

      {/* Main composer box */}
      <div className="relative rounded-2xl border border-border bg-surface shadow-md focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Napisz wiadomość lub wpisz / aby wybrać polecenie..."
          rows={1}
          disabled={disabled}
          className="w-full resize-none bg-transparent px-4 pt-3.5 pb-12 text-sm text-main placeholder:text-muted focus:outline-hidden min-h-[44px] max-h-[200px]"
        />

        <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between pointer-events-auto">
          <div className="relative flex items-center gap-1.5">
            {/* Effort selector dropdown toggle */}
            <button
              type="button"
              onClick={() => setShowEffortMenu(!showEffortMenu)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-muted hover:text-main bg-card hover:bg-surface-hover border border-border transition-colors cursor-pointer"
            >
              <Sparkles className="w-3 h-3 text-primary" />
              <span>{effortLabels[effort].title}</span>
            </button>

            {showEffortMenu && (
              <div className="absolute bottom-full mb-2 left-0 w-64 bg-surface border border-border rounded-xl shadow-lg p-1.5 z-40">
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

          <div className="flex items-center gap-2">
            {isGenerating ? (
              <button
                type="button"
                onClick={onAbort}
                title="Wstrzymaj generowanie"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Zatrzymaj</span>
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

      <div className="text-center mt-2 text-[11px] text-subtle">
        Wciśnij <kbd className="px-1 py-0.5 rounded bg-card border border-border font-mono text-[10px]">Enter</kbd> aby wysłać, <kbd className="px-1 py-0.5 rounded bg-card border border-border font-mono text-[10px]">Shift+Enter</kbd> dla nowej linii.
      </div>
    </div>
  );
};
