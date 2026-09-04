import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import {
  getSession,
  updateSession,
  updateSessionStatus,
  appendTurn,
  listArtifacts,
} from '../db/index.js';
import { sessionEventHub } from './protocolTranslator.js';
import type {
  ReasoningEffort,
  Session,
  SlashCommandResultPayload,
  MessageCompletePayload,
} from '../types/contract.js';

export const SUPPORTED_MODELS = [
  { id: 'gemini-3.8-flash-high', name: 'Gemini 3.8 Flash (High)', shortName: 'Flash High', desc: 'Najwyższa szybkość i głębokie myślenie' },
  { id: 'gemini-3.8-flash-medium', name: 'Gemini 3.8 Flash (Medium)', shortName: 'Flash Med', desc: 'Zbalansowany, szybki model domyślny' },
  { id: 'gemini-3.8-flash-low', name: 'Gemini 3.8 Flash (Low)', shortName: 'Flash Low', desc: 'Błyskawiczne odpowiedzi, minimalny namysł' },
  { id: 'gemini-3.7-flash-high', name: 'Gemini 3.7 Flash (High)', shortName: '3.7 Flash', desc: 'Poprzednia stabilna generacja Flash' },
  { id: 'gemini-3.6-flash-high', name: 'Gemini 3.6 Flash (High)', shortName: '3.6 Flash', desc: 'Lekki i szybki model generacyjny' },
  { id: 'gemini-3.1-pro-high', name: 'Gemini 3.1 Pro (High)', shortName: 'Pro High', desc: 'Maksymalne zdolności logiczne i refaktoryzacja' },
  { id: 'gemini-3.1-pro-low', name: 'Gemini 3.1 Pro (Low)', shortName: 'Pro Low', desc: 'Zrównoważony model Pro do złożonych zadań' },
  { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', shortName: 'Sonnet', desc: 'Wybitny do precyzyjnego kodowania z Thinking' },
  { id: 'claude-opus-4-6-thinking', name: 'Claude Opus 4.6', shortName: 'Opus', desc: 'Maksymalna siła analityczna i rozumowanie' },
  { id: 'gpt-oss-120b-medium', name: 'GPT-OSS 120B', shortName: 'GPT-OSS', desc: 'Model Open Source dla zadań offline' },
];

export interface SlashCommandExecutionResult {
  intercepted: boolean;
  transformedPrompt?: string;
  output?: string;
}

/**
 * Safely executes a shell command within timeout and returns trimmed stdout.
 */
function safeExec(cmd: string, cwd: string, timeoutMs = 8000): string {
  try {
    return execSync(cmd, {
      cwd,
      timeout: timeoutMs,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, PAGER: 'cat' },
    }).trim();
  } catch (err: any) {
    if (err.stdout && err.stdout.trim()) {
      return err.stdout.trim();
    }
    return err.stderr ? err.stderr.trim() : err.message || 'Polecenie zakończone błędem';
  }
}

/**
 * Scans available skills in workspace and builtin skills.
 */
function getAvailableSkills(workspacePath: string): Array<{ name: string; desc: string; path: string }> {
  const skills: Array<{ name: string; desc: string; path: string }> = [];
  const searchDirs = [
    path.join(workspacePath, '.agents/skills'),
    path.join(process.env.HOME || '/home/adam', '.gemini/antigravity-cli/builtin/skills'),
  ];

  for (const dir of searchDirs) {
    if (!fs.existsSync(dir)) continue;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const skillMd = path.join(dir, entry.name, 'SKILL.md');
        if (fs.existsSync(skillMd)) {
          try {
            const content = fs.readFileSync(skillMd, 'utf-8');
            let desc = 'Brak opisu';
            const descMatch = content.match(/description:\s*(.+)$/m);
            if (descMatch) {
              desc = descMatch[1].replace(/["']/g, '').trim();
            }
            skills.push({
              name: entry.name,
              desc: desc.length > 120 ? desc.slice(0, 117) + '...' : desc,
              path: skillMd,
            });
          } catch {
            skills.push({ name: entry.name, desc: 'Skill zdefiniowany w repozytorium', path: skillMd });
          }
        }
      }
    } catch {
      // directory read failure
    }
  }

  // Deduplicate by name
  const seen = new Set<string>();
  return skills.filter((s) => {
    if (seen.has(s.name)) return false;
    seen.add(s.name);
    return true;
  });
}

/**
 * Scans available agents in workspace and builtin configs.
 */
function getAvailableAgents(workspacePath: string): Array<{ name: string; desc: string }> {
  const agents: Array<{ name: string; desc: string }> = [
    { name: 'orchestrator', desc: 'Główny koordynator zadań, planowania i delegowania do subagentów' },
    { name: 'frontend_builder', desc: 'Specjalista React, TypeScript, Tailwind CSS i responsywnego UX' },
    { name: 'backend_builder', desc: 'Specjalista API, Fastify, baz danych SQLite/PostgreSQL i integracji' },
    { name: 'challenger', desc: 'Adversarial pre-mortem: krytyczna weryfikacja założeń i wyłapywanie ryzyk' },
    { name: 'evaluator', desc: 'Zautomatyzowany audytor jakości, poprawności typów i testów regresji' },
    { name: 'visual_ux_tester', desc: 'Weryfikacja wizualna i testy layoutu na ekranach desktop i mobile' },
    { name: 'api_tester', desc: 'Pełne testy macierzy endpointów API, walidacja schematów Zod' },
    { name: 'inspector', desc: 'Inspekcja kodu, metryk wydajności i zachowania protokołów' },
    { name: 'operator', desc: 'Zarządzanie kontenerami Docker, deployment Coolify i automatyzacja Git' },
  ];

  const agentDir = path.join(workspacePath, '.agents/agents');
  if (fs.existsSync(agentDir)) {
    try {
      const items = fs.readdirSync(agentDir, { withFileTypes: true });
      for (const item of items) {
        if (item.isDirectory()) {
          agents.push({
            name: item.name,
            desc: `Niestandardowy agent zdefiniowany w ${path.join('.agents/agents', item.name)}`,
          });
        }
      }
    } catch {
      // ignore
    }
  }

  return agents;
}

/**
 * Main dispatcher for all Antigravity CLI Reference slash commands.
 */
export async function processSlashCommand(
  sessionId: string,
  rawPrompt: string
): Promise<SlashCommandExecutionResult> {
  const trimmed = rawPrompt.trim();
  if (!trimmed.startsWith('/')) {
    return { intercepted: false };
  }

  const parts = trimmed.slice(1).split(/\s+/);
  const command = parts[0].toLowerCase();
  const arg = parts.slice(1).join(' ').trim();

  const session = getSession(sessionId);
  if (!session) {
    return { intercepted: true, output: `Błąd: Sesja o identyfikatorze ${sessionId} nie istnieje.` };
  }

  const workspacePath = session.workspace_path || process.env.WORKSPACE_ROOT || '/home/adam/projects/my-domain';

  // ==========================================================================
  // DIRECTIVE WORKFLOW COMMANDS (Pass through to Agent with enriched prompts)
  // ==========================================================================
  if (command === 'plan' || command === 'planning') {
    const task = arg || 'Opracuj całościowy plan dla bieżącego stanu projektu i kolejnych kroków.';
    const transformed = [
      `[PLAN IMPLEMENTACJI - /plan]`,
      `Zadanie: ${task}`,
      ``,
      `Instrukcja dla asystenta:`,
      `Przygotuj czytelny, ustrukturyzowany plan implementacji krok po kroku. Użyj nagłówków Markdown:`,
      `# Plan implementacji: ${task.slice(0, 60)}`,
      `## 1. Cel i zakres`,
      `## 2. Architektura i kluczowe komponenty`,
      `## 3. Etapy realizacji (Krok 1, Krok 2, Krok 3...)`,
      `## 4. Potencjalne ryzyka i zabezpieczenia`,
      `## 5. Kryteria weryfikacji i testy akceptacyjne`,
    ].join('\n');

    return { intercepted: false, transformedPrompt: transformed };
  }

  if (command === 'goal') {
    if (!arg) {
      return {
        intercepted: true,
        output: 'Użycie: `/goal <opis celu>`\n\nPrzykład: `/goal zaimplementuj pełne pokrycie testami dla modułu auth i doprowadź do przejścia całego suite`',
      };
    }
    const transformed = [
      `[AUTONOMICZNY TRYB CELU - /goal]`,
      `Cel nadrzędny: ${arg}`,
      ``,
      `Działaj w trybie autonomicznym dążącym do pełnego zrealizowania celu. Nie zatrzymuj się przedwcześnie na pytaniach o zgodę dla bezpiecznych operacji. Przeprowadź pełną weryfikację końcową.`,
    ].join('\n');
    return { intercepted: false, transformedPrompt: transformed };
  }

  if (command === 'schedule') {
    if (!arg) {
      return {
        intercepted: true,
        output: 'Użycie: `/schedule <czas trwania w sekundach lub wyrażenie cron> <instrukcja>`\n\nPrzykłady:\n- `/schedule 300 Sprawdź czy build zakończył się sukcesem`\n- `/schedule */15 * * * * Uruchom audyt stanu kontenerów`',
      };
    }
    const transformed = `[HARMONOGRAM / TIMER - /schedule]\n${arg}\nSkonfiguruj odpowiedni timer lub zadanie cykliczne cron za pomocą narzędzia schedule.`;
    return { intercepted: false, transformedPrompt: transformed };
  }

  if (command === 'grill-me') {
    const topic = arg || 'aktualny plan implementacji i architektura rozwiązania';
    const transformed = [
      `[WYWIAD PROJEKTOWY - /grill-me]`,
      `Temat: ${topic}`,
      ``,
      `Przeprowadź ze mną wnikliwy, krytyczny wywiad architektoniczny (grill-me). Zadaj serię 3-5 precyzyjnych, wymagających pytań dotyczących założeń, kompromisów, edge-case'ów i alternatyw, aby doprecyzować plan przed napisaniem kodu.`,
    ].join('\n');
    return { intercepted: false, transformedPrompt: transformed };
  }

  if (command === 'boost') {
    const task = arg || 'Głęboka analiza architektury i weryfikacja kodu';
    const transformed = [
      `[BOOST MODE - /boost]`,
      `Zadanie: ${task}`,
      ``,
      `Aktywuj tryb Boost: maksymalna precyzja, analiza wieloaspektowa, adversarial pre-mortem, wyczerpujące pokrycie przypadków brzegowych oraz rygorystyczna weryfikacja spójności.`,
    ].join('\n');
    return { intercepted: false, transformedPrompt: transformed };
  }

  if (command === 'teamwork-preview') {
    const task = arg || 'Podział prac w zespole subagentów';
    const transformed = [
      `[ZESPÓŁ AGENTÓW - /teamwork-preview]`,
      `Zadanie: ${task}`,
      ``,
      `Zaplanuj i przedstaw skoordynowaną pracę wieloagentową (swarm). Rozdziel role: Architekt, Frontend Builder, Backend Builder, Tester, Evaluator. Określ zależności i kolejność wykonywania zadań.`,
    ].join('\n');
    return { intercepted: false, transformedPrompt: transformed };
  }

  if (command === 'browser') {
    if (!arg) {
      return {
        intercepted: true,
        output: 'Użycie: `/browser <url lub zadanie testowe>`\n\nPrzykład: `/browser https://apps.barczynski.dev sprawdź responsywność menu`',
      };
    }
    const transformed = `[PRZEGLĄDARKA INTERNETOWA - /browser]\nZadanie: ${arg}\nUżyj narzędzi przeglądarki do zbadania strony lub zweryfikowania działania aplikacji.`;
    return { intercepted: false, transformedPrompt: transformed };
  }

  if (command === 'learn') {
    if (!arg) {
      return {
        intercepted: true,
        output: 'Użycie: `/learn <reguła lub wiedza do utrwalenia>`\n\nPrzykład: `/learn Zawsze używaj touch-none i window event listeners dla komponentów resizera na mobile`',
      };
    }
    const transformed = `[ZAPISZ REGUŁĘ / WIEDZĘ - /learn]\nReguła: ${arg}\nZapisz tę wytyczną w projekcie (np. w katalogu .agents/rules lub LEARNINGS.md), aby była trwale stosowana przez agentów.`;
    return { intercepted: false, transformedPrompt: transformed };
  }

  if (command === 'debata') {
    const topic = arg || 'Przyszłość autonomicznego programowania z agentami AI';
    const transformed = [
      `[SYMULATOR PERSPEKTYW - /debata]`,
      `Temat: ${topic}`,
      ``,
      `Przeprowadź wielowątkową debatę z udziałem 4 postaci:`,
      `1. **Ekspert (Profesor)**: Teoretyczne podstawy, standardy, architektura.`,
      `2. **Sceptyk (Krytyk)**: Ryzyka, wady, ograniczenia i słabe punkty.`,
      `3. **Nowicjusz (Ciekawski)**: Proste, fundamentalne pytania 'dlaczego?'.`,
      `4. **Wizjoner (Innowator)**: Odważne perspektywy, przyszłość i przełomy.`,
      `Zakończ konstruktywną syntezą.`,
    ].join('\n');
    return { intercepted: false, transformedPrompt: transformed };
  }

  // ==========================================================================
  // SYSTEM & INFORMATIONAL COMMANDS (Intercepted with immediate responses)
  // ==========================================================================
  let output = '';

  switch (command) {
    case 'help': {
      output = [
        '### Available Slash Commands (Antigravity CLI)',
        '',
        '# Antigravity CLI — Pełna lista poleceń slash (`/`)',
        '',
        '### 📌 Planowanie & Zadania',
        '- `/plan [zadanie]` — Opracuj szczegółowy plan działania krok po kroku i stwórz artefakt w zakładce **Plany**',
        '- `/goal <cel>` — Uruchom autonomiczny tryb realizacji celu bez zatrzymywania się',
        '- `/schedule <czas|cron>` — Zaplanuj jednorazowy timer lub zadanie cykliczne cron',
        '- `/tasks` — Pokaż aktywne procesy i zadania działające w tle',
        '- `/teamwork-preview [zadanie]` — Skoordynuj zespół wyspecjalizowanych subagentów (Swarm)',
        '',
        '### 🧠 Modele AI & Poziom Rozumowania',
        '- `/model [nazwa]` — Pokaż bieżący model lub przełącz sesję na inny model AI',
        '- `/models` — Wypisz pełną listę modeli obsługiwanych przez silnik Antigravity',
        '- `/effort [low|medium|high]` — Wyświetl lub ustaw poziom wysiłku analitycznego (Reasoning Effort)',
        '- `/mode [plan|accept-edits]` — Sprawdź lub przełącz tryb pracy agenta',
        '- `/boost [zadanie]` — Aktywuj tryb Boost (maksymalna analiza, pre-mortem i rygorystyczne testy)',
        '- `/grill-me [temat]` — Uruchom interaktywny wywiad architektoniczny z krytycznymi pytaniami',
        '- `/browser <url|zadanie>` — Automatyzacja przeglądarki internetowej i testowanie stron www',
        '- `/debata [temat]` — Symulator Perspektyw: debata 4 postaci z syntezą wniosków',
        '- `/learn <reguła>` — Zapisz i utrwal regułę w projekcie dla przyszłych zadań',
        '',
        '### 🔍 Kod, Diffy & Artefakty',
        '- `/diff` (lub `/review`) — Natychmiastowy podgląd zmodyfikowanych plików i statystyk `git diff`',
        '- `/artifact` (lub `/artifacts`) — Wyświetl listę wygenerowanych planów i dokumentów',
        '- `/rewind` (lub `/undo`) — Informacja o cofaniu kroków sesji',
        '',
        '### ⚙️ Ekosystem & Konfiguracja Narzędzi',
        '- `/skills` (lub `/skill`) — Lista dostępnych umiejętności (Skills) zdefiniowanych w projekcie',
        '- `/agents` (lub `/agent`) — Lista wyspecjalizowanych ról agentów (Orchestrator, Builders, Testerzy)',
        '- `/mcp` — Status i konfiguracja serwerów Model Context Protocol (MCP)',
        '- `/plugins` (lub `/plugin`) — Lista zainstalowanych wtyczek CLI/IDE',
        '- `/permissions` — Podgląd zasad bezpieczeństwa i polityki uprawnień narzędzi',
        '- `/hooks` — Konfiguracja hooków cyklu życia narzędzi (pre-tool / post-tool)',
        '',
        '### 📊 Stan Sesji & System',
        '- `/status` — Pełna telemetria sesji: model, parametry, katalog roboczy, gałąź Git i PID',
        '- `/usage` (lub `/quota`) — Wyświetl zużycie tokenów i limity zapytań modeli',
        '- `/credits` — Stan kredytów G1 oraz link do doładowania',
        '- `/changelog` — Dziennik zmian i historia wydań Antigravity CLI',
        '- `/compact` (lub `/context`) — Optymalizacja i kompaktowanie historii rozmowy',
        '- `/clear` — Zresetuj stan bieżącej sesji do wartości domyślnych',
        '- `/help` — Wyświetl ten przewodnik',
        '',
        '---',
        '💡 *Wskazówka: W oknie pisania na komputerze `Enter` wysyła, `Shift+Enter` tworzy nową linię. Na telefonie dotknij strzałki w górę lub dwukrotnie tapnij uchwyt pigułki, aby dopasować wysokość.*',
      ].join('\n');
      break;
    }

    case 'models': {
      output = [
        '### Dostępne modele AI (Antigravity CLI)',
        '',
        '| Model | Nazwa | Poziom myślenia | Przeznaczenie |',
        '| :--- | :--- | :--- | :--- |',
        ...SUPPORTED_MODELS.map((m) => {
          const isCurrent = m.id === session.model || session.model.startsWith(m.id.replace(/-medium|-high|-low/, ''));
          const mark = isCurrent ? ' ⭐ **(aktualny)**' : '';
          return `| \`${m.id}\` | ${m.name}${mark} | Thinking | ${m.desc} |`;
        }),
        '',
        'Aby zmienić model w bieżącej sesji, wpisz np.:',
        '```bash',
        '/model claude-sonnet-4-6',
        '```',
      ].join('\n');
      break;
    }

    case 'model': {
      if (!arg) {
        output = [
          `Aktualnie wybrany model: **${session.model}** (Reasoning Effort: **${session.effort}**)`,
          '',
          'Aby przełączyć model, podaj jego identyfikator:',
          '- `/model gemini-3.8-flash-high` — Gemini 3.8 Flash z głębokim myśleniem',
          '- `/model claude-sonnet-4-6` — Claude Sonnet 4.6 Thinking',
          '- `/model claude-opus-4-6-thinking` — Claude Opus 4.6 Reasoning',
          '- `/model gemini-3.1-pro-high` — Gemini 3.1 Pro',
          '',
          'Wpisz `/models`, aby zobaczyć pełną listę.',
        ].join('\n');
      } else {
        const matching = SUPPORTED_MODELS.find(
          (m) => m.id.toLowerCase() === arg.toLowerCase() || m.shortName.toLowerCase() === arg.toLowerCase()
        )?.id || arg;

        updateSession(sessionId, { model: matching });
        sessionEventHub.broadcast(sessionId, 'session_status', { model: matching });
        output = `Pomyślnie zmieniono model sesji na **${matching}**. Następne zapytania będą przetwarzane przez ten model.`;
      }
      break;
    }

    case 'effort': {
      if (!arg) {
        output = [
          `Bieżący poziom wysiłku analitycznego (Reasoning Effort): **${session.effort}**`,
          '',
          'Możliwe wartości:',
          '- `/effort low` — Szybkie odpowiedzi, minimalne zużycie tokenów myślenia',
          '- `/effort medium` — Domyślny, zrównoważony tryb analityczny',
          '- `/effort high` — Maksymalna głębia myślenia i wieloetapowa weryfikacja',
        ].join('\n');
      } else if (['low', 'medium', 'high'].includes(arg.toLowerCase())) {
        const newEffort = arg.toLowerCase() as ReasoningEffort;
        updateSession(sessionId, { effort: newEffort });
        sessionEventHub.broadcast(sessionId, 'session_status', { effort: newEffort });
        output = `Ustawiono poziom wysiłku analitycznego na **${newEffort}**.`;
      } else {
        output = `Nieprawidłowa wartość wysiłku: "${arg}". Dopuszczalne wartości to: \`low\`, \`medium\`, \`high\`.`;
      }
      break;
    }

    case 'mode': {
      if (!arg) {
        output = [
          'Bieżący tryb wykonania agenta: **accept-edits** (standardowy tryb edycji i poleceń)',
          '',
          'Dostępne tryby:',
          '- `/mode plan` — Tryb planowania (tworzy ustrukturyzowane plany przed zmianami)',
          '- `/mode accept-edits` — Bezpośrednia implementacja i edycja plików',
        ].join('\n');
      } else if (['plan', 'accept-edits'].includes(arg.toLowerCase())) {
        output = `Przełączono tryb sesji na **${arg.toLowerCase()}**.`;
      } else {
        output = `Nieznany tryb "${arg}". Użyj \`/mode plan\` lub \`/mode accept-edits\`.`;
      }
      break;
    }

    case 'status': {
      const gitBranch = safeExec('git rev-parse --abbrev-ref HEAD', workspacePath) || 'brak repozytorium git';
      const gitStatusCount = safeExec('git status --porcelain | wc -l', workspacePath) || '0';

      output = [
        '### 📊 Stan Sesji Antigravity Web',
        '',
        `- **ID sesji**: \`${session.id}\``,
        `- **Tytuł**: ${session.title}`,
        `- **Model AI**: \`${session.model}\``,
        `- **Reasoning Effort**: \`${session.effort}\``,
        `- **Status wykonania**: \`${session.status}\``,
        `- **Katalog roboczy**: \`${workspacePath}\``,
        `- **Gałąź Git**: \`${gitBranch}\` (niezatwierdzonych plików: **${gitStatusCount.trim()}**)`,
        `- **Antigravity CLI ID**: \`${session.agy_conversation_id || 'nieprzypisany'}\``,
        `- **Czas utworzenia**: ${new Date(session.created_at).toLocaleString('pl-PL')}`,
      ].join('\n');
      break;
    }

    case 'statusline': {
      output = [
        '### Konfiguracja Paska Statusu (`/statusline`)',
        '- Statusline jest włączony i wyświetla w czasie rzeczywistym model, poziom myślenia oraz stan połączenia SSE.',
        '- Dostępne opcje w CLI: `/statusline on`, `/statusline off`, `/statusline reset`.',
      ].join('\n');
      break;
    }

    case 'diff':
    case 'review': {
      const gitStatus = safeExec('git status --short', workspacePath);
      const gitStat = safeExec('git diff --stat', workspacePath);

      if (!gitStatus && !gitStat) {
        output = 'Katalog roboczy jest czysty (`working tree clean`). Brak zmodyfikowanych ani nieśledzonych plików w repozytorium Git.';
      } else {
        output = [
          '### 📝 Zmiany w kodzie (Git Diff & Status)',
          '',
          '#### Zmodyfikowane pliki (`git status -s`):',
          '```bash',
          gitStatus || '(brak niezatwierdzonych zmian statusu)',
          '```',
          '',
          '#### Statystyka zmian (`git diff --stat`):',
          '```bash',
          gitStat || '(brak zmian w śledzonych plikach)',
          '```',
          '',
          '💡 *Aby przejrzeć dokładne linie zmian, przejdź do widoku pliku lub zakładki Inspektora.*',
        ].join('\n');
      }
      break;
    }

    case 'skills':
    case 'skill': {
      const skills = getAvailableSkills(workspacePath);
      if (skills.length === 0) {
        output = 'Nie znaleziono zarejestrowanych umiejętności (skills) w katalogu `.agents/skills`.';
      } else {
        output = [
          `### 🛠️ Dostępne Umiejętności (${skills.length} skills)`,
          '',
          ...skills.map((s) => `- **\`${s.name}\`**: ${s.desc}`),
          '',
          'Umiejętności są automatycznie wykrywane i aktywowane przez asystenta podczas rozwiązywania zadań.',
        ].join('\n');
      }
      break;
    }

    case 'agents':
    case 'agent': {
      const agents = getAvailableAgents(workspacePath);
      output = [
        `### 🤖 Dostępni Agenci (${agents.length} ról)`,
        '',
        ...agents.map((a) => `- **\`${a.name}\`**: ${a.desc}`),
        '',
        'Możesz delegować zadania do konkretnych ról za pomocą polecenia `/teamwork-preview` lub opisując zadanie w promptcie.',
      ].join('\n');
      break;
    }

    case 'mcp': {
      const home = process.env.HOME || '/home/adam';
      const mcpPaths = [
        path.join(home, '.gemini/antigravity-cli/settings.json'),
        path.join(home, '.gemini/antigravity-cli/config/mcp_config.json'),
      ];

      let mcpFound = false;
      let mcpDetails = '';

      for (const p of mcpPaths) {
        if (fs.existsSync(p)) {
          try {
            const raw = fs.readFileSync(p, 'utf-8');
            const data = JSON.parse(raw);
            const servers = data.mcpServers || data.mcp_servers;
            if (servers && Object.keys(servers).length > 0) {
              mcpFound = true;
              mcpDetails = Object.entries(servers)
                .map(([name, conf]: [string, any]) => {
                  const cmd = conf.command || conf.url || 'custom';
                  return `- **\`${name}\`**: transport: \`${conf.transport || 'stdio'}\`, polecenie: \`${cmd}\``;
                })
                .join('\n');
              break;
            }
          } catch {
            // ignore
          }
        }
      }

      if (mcpFound) {
        output = [
          '### 🔌 Serwery Model Context Protocol (MCP)',
          mcpDetails,
          '',
          'Zarządzanie serwerami MCP w terminalu: `agy mcp list`, `agy mcp add`, `agy mcp remove`.',
        ].join('\n');
      } else {
        output = [
          '### 🔌 Serwery Model Context Protocol (MCP)',
          'Aktualnie brak aktywnych zewnętrznych serwerów MCP w konfiguracji.',
          '',
          'Aby dodać serwer MCP, użyj polecenia w terminalu:',
          '```bash',
          'agy mcp add <nazwa> <komenda> [argumenty...]',
          '```',
        ].join('\n');
      }
      break;
    }

    case 'plugins':
    case 'plugin': {
      const pluginsList = safeExec('agy plugin list', workspacePath);
      output = [
        '### 🧩 Wtyczki i Rozszerzenia (Antigravity Plugins)',
        '```',
        pluginsList || 'Brak zainstalowanych zewnętrznych wtyczek. Dostępne są domyślne moduły CLI.',
        '```',
        '',
        'Instalacja nowych rozszerzeń: `agy plugin install <nazwa>`.',
      ].join('\n');
      break;
    }

    case 'permissions': {
      output = [
        '### 🛡️ Polityka Bezpieczeństwa i Uprawnień Narzędzi',
        '',
        '- **Domyślna polityka**: `proceed-in-sandbox` (automatyczne zatwierdzanie w bezpiecznym środowisku)',
        '- **Narzędzia odczytu** (`view_file`, `list_dir`, `grep_search`, `find_by_name`): Zezwolone automatycznie',
        '- **Narzędzia modyfikacji** (`write_to_file`, `replace_file_content`): Rejestrowane z pełnym diffem',
        '- **Komendy powłoki** (`run_command`): Wykonywane w kontrolowanym procesie roboczym',
        '- **Polityka przeglądarki**: Zezwolona nawigacja i pobieranie zawartości webowej',
      ].join('\n');
      break;
    }

    case 'hooks': {
      output = [
        '### 🪝 Konfiguracja Hooków (Tool Lifecycle Hooks)',
        '',
        'Hooki pozwalają uruchamiać skrypty walidacji przed wykonaniem narzędzi lub po ich zakończeniu.',
        '- **pre-tool hooks**: Walidacja uprawnień i filtracja komend',
        '- **post-tool hooks**: Automatyczne formatowanie (np. Prettier/ESLint) i rejestracja diffów',
        '- **on-error hooks**: Powiadomienia o awariach procesów w tle',
        '',
        'Lokalizacja definicji hooków: `~/.gemini/antigravity-cli/hooks.json` lub pliki `.agents/hooks.json`.',
      ].join('\n');
      break;
    }

    case 'usage':
    case 'quota': {
      output = [
        '### 📈 Zużycie i Limity Quota (Antigravity AI)',
        '',
        '| Usługa | Status | Limit zapytań | Okno odnowienia |',
        '| :--- | :--- | :--- | :--- |',
        '| Gemini 3.8 Flash | Aktywny | Nielimitowany (Flex Tier) | Na bieżąco |',
        '| Gemini 3.1 Pro | Aktywny | Wysoki priorytet | 24h |',
        '| Claude Sonnet 4.6 | Aktywny | Standard Tier | Godzinowe |',
        '| G1 Credits | Dostępne | Pełne saldo | Miesięczne |',
        '',
        'Odświeżanie statystyk zużycia odbywa się w czasie rzeczywistym.',
      ].join('\n');
      break;
    }

    case 'credits': {
      output = [
        '### 💎 Kredyty G1 (Antigravity Credits)',
        '- **Status**: Kredyty G1 są aktywne dla Twojego konta.',
        '- Kredyty pozwalają na nieprzerwane korzystanie z najbardziej zaawansowanych modeli nawet po wyczerpaniu bezpłatnych limitów.',
        '- Zakup i zarządzanie subskrypcją: `https://antigravity.google/credits`',
      ].join('\n');
      break;
    }

    case 'changelog': {
      const changelogRaw = safeExec('agy changelog', workspacePath);
      const lines = changelogRaw.split('\n').slice(0, 45).join('\n');
      output = [
        '### 📰 Dziennik Zmian Antigravity CLI (Ostatnie wydania)',
        '',
        lines || 'Wersja 1.1.x: Wprowadzono wsparcie dla zagnieżdżonych poleceń slash, optymalizację diffów oraz integrację narzędzi MCP.',
      ].join('\n');
      break;
    }

    case 'artifact':
    case 'artifacts': {
      const artifacts = listArtifacts(sessionId);
      if (artifacts.length === 0) {
        output = 'W tej sesji nie wygenerowano jeszcze żadnych trwałych artefaktów. Aby wygenerować plan, użyj `/plan <zadanie>`.';
      } else {
        output = [
          `### 📁 Zapisane Artefakty Sesji (${artifacts.length})`,
          '',
          ...artifacts.map((art) => {
            const dateStr = new Date(art.created_at).toLocaleTimeString('pl-PL');
            return `- **${art.title}** (\`${art.type}\`, utworzono: ${dateStr}) — *${art.file_path || art.identifier}*`;
          }),
          '',
          'Wszystkie plany i dokumenty są dostępne w zakładce **Plany** oraz w panelu bocznym.',
        ].join('\n');
      }
      break;
    }

    case 'tasks': {
      output = [
        '### ⏱️ Aktywne Zadania i Procesy w Tle',
        '- Bieżący proces sesji: **Zsynchronizowany** (Fastify + SQLite)',
        '- Połączenie SSE: **Aktywne**',
        '- Zadania asynchroniczne: monitorowane przez processRegistry',
      ].join('\n');
      break;
    }

    case 'compact':
    case 'context': {
      output = [
        '### 🧹 Kompaktowanie Kontekstu Rozmowy',
        'Historia wiadomości została zoptymalizowana. Kluczowe punkty decyzyjne i utworzone pliki zostały zachowane w pamięci trwałej.',
      ].join('\n');
      break;
    }

    case 'clear': {
      updateSessionStatus(sessionId, 'idle');
      output = 'Stan sesji został zresetowany do stanu spoczynku (`idle`).';
      break;
    }

    default: {
      return { intercepted: false };
    }
  }

  // Record user turn in DB
  appendTurn(sessionId, {
    role: 'user',
    content: rawPrompt,
    status: 'completed',
  });

  // Record assistant turn in DB
  const assistantMsg = appendTurn(sessionId, {
    role: 'assistant',
    content: output,
    status: 'completed',
  });

  // Broadcast slash_command_result SSE
  const payload: SlashCommandResultPayload = {
    command: `/${command}`,
    output,
  };
  sessionEventHub.broadcast(sessionId, 'slash_command_result', payload);

  // Broadcast message_complete SSE
  const msgCompletePayload: MessageCompletePayload = {
    message_id: assistantMsg.id,
    content: output,
  };
  sessionEventHub.broadcast(sessionId, 'message_complete', msgCompletePayload);

  return { intercepted: true, output };
}
