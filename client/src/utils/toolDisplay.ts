/**
 * Human-centric translations for tools with zero developer jargon.
 */

import { ToolStatus } from '@/types';

export interface ToolDisplayInfo {
  title: string;
  subtitle?: string;
  icon: string; // emoji or icon identifier
  isDanger?: boolean;
}

/**
 * Shorten redundant absolute system paths to clean, readable friendly paths.
 * E.g. /home/adam/projects/my-domain/src/App.tsx -> my-domain/src/App.tsx
 * /home/adam/.gemini/config.json -> ~/.gemini/config.json
 */
export function formatFriendlyPath(rawPath?: string | null): string {
  if (!rawPath || typeof rawPath !== 'string') return '';
  let p = rawPath.trim();
  if (p.startsWith('/home/adam/projects/')) {
    p = p.replace('/home/adam/projects/', '');
  } else if (p.startsWith('/home/adam/')) {
    p = p.replace('/home/adam/', '~/');
  }
  return p;
}

export function getToolDisplayInfo(toolName: string, args: Record<string, unknown> = {}): ToolDisplayInfo {
  const norm = toolName.toLowerCase();

  // Read / View file
  if (norm.includes('read') || norm.includes('view')) {
    const rawPath = (args.path || args.file_path || args.AbsolutePath || args.TargetFile || '') as string;
    const shortName = rawPath ? rawPath.split('/').filter(Boolean).pop() || rawPath : '';
    const friendlyPath = formatFriendlyPath(rawPath);
    const lineRange =
      args.StartLine !== undefined && args.EndLine !== undefined
        ? ` (L${args.StartLine}–${args.EndLine})`
        : '';

    return {
      title: shortName ? `Odczyt: ${shortName}${lineRange}` : 'Odczyt pliku',
      subtitle: friendlyPath || (args.toolAction as string) || 'Przeglądanie zawartości',
      icon: 'FileText',
    };
  }

  // Create / Write file
  if (norm.includes('write') || norm.includes('create')) {
    const rawPath = (args.path || args.file_path || args.TargetFile || args.AbsolutePath || '') as string;
    const shortName = rawPath ? rawPath.split('/').filter(Boolean).pop() || rawPath : '';
    const friendlyPath = formatFriendlyPath(rawPath);

    return {
      title: shortName ? `Nowy plik: ${shortName}` : 'Utworzenie pliku',
      subtitle: friendlyPath || (args.Description as string) || 'Zapis nowego pliku w projekcie',
      icon: 'FilePlus',
    };
  }

  // Edit / Replace / Patch file
  if (norm.includes('replace') || norm.includes('edit') || norm.includes('patch')) {
    const rawPath = (args.path || args.file_path || args.TargetFile || args.AbsolutePath || '') as string;
    const shortName = rawPath ? rawPath.split('/').filter(Boolean).pop() || rawPath : '';
    const friendlyPath = formatFriendlyPath(rawPath);
    const lineRange =
      args.StartLine !== undefined && args.EndLine !== undefined
        ? ` (L${args.StartLine}–${args.EndLine})`
        : '';

    return {
      title: shortName ? `Edycja: ${shortName}${lineRange}` : 'Zmiana w pliku',
      subtitle: friendlyPath || (args.Instruction as string) || (args.Description as string) || 'Wprowadzanie zmian w pliku',
      icon: 'FileCode',
    };
  }

  // Terminal command execution
  if (norm.includes('command') || norm.includes('bash') || norm.includes('exec') || norm.includes('run')) {
    const cmd = (args.command || args.CommandLine || args.cmd || '') as string;
    const cwd = args.Cwd ? formatFriendlyPath(args.Cwd as string) : '';

    return {
      title: cmd ? `Polecenie: ${cmd}` : 'Polecenie w terminalu',
      subtitle: cwd ? `w katalogu: ${cwd}` : (args.toolAction as string) || (args.toolSummary as string) || 'Wykonanie procesu',
      icon: 'Terminal',
      isDanger: cmd.includes('rm -rf') || cmd.includes('delete') || norm.includes('rm'),
    };
  }

  // Search / Grep
  if (norm.includes('grep') || (norm.includes('search') && !norm.includes('web'))) {
    const query = (args.query || args.Query || args.pattern || args.Pattern || '') as string;
    const searchPath = args.SearchPath ? formatFriendlyPath(args.SearchPath as string) : '';

    return {
      title: query ? `Szukaj: "${query}"` : 'Wyszukiwanie w kodzie',
      subtitle: searchPath ? `w: ${searchPath}` : (args.toolAction as string) || 'Skanowanie plików',
      icon: 'Search',
    };
  }

  // Directory inspection
  if (norm.includes('find') || norm.includes('list') || norm.includes('dir')) {
    const pattern = (args.Pattern as string) || '';
    const rawDir = (args.SearchDirectory || args.DirectoryPath || args.path || '') as string;
    const friendlyDir = formatFriendlyPath(rawDir);
    const dirBasename = rawDir ? rawDir.split('/').filter(Boolean).pop() || friendlyDir : '';

    return {
      title: pattern
        ? `Szukaj plików: ${pattern}`
        : dirBasename
        ? `Katalog: ${dirBasename}`
        : 'Przeglądanie katalogów',
      subtitle: friendlyDir || 'Struktura plików',
      icon: 'FolderSearch',
    };
  }

  // Web search / URL fetch
  if (norm.includes('web') || norm.includes('url') || norm.includes('browse')) {
    const url = (args.url || args.Url || '') as string;
    const q = (args.query || args.Query || '') as string;

    return {
      title: url ? 'Pobieranie URL' : q ? `Szukaj w sieci: "${q}"` : 'Wyszukiwanie w sieci',
      subtitle: url || q || 'Pobieranie aktualnych informacji',
      icon: 'Globe',
    };
  }

  // Subagents and swarm coordination
  if (norm.includes('subagent') || norm.includes('manage_subagents') || norm.includes('send_message')) {
    if (norm.includes('invoke')) {
      let subCount = 1;
      try {
        let subs = args.Subagents;
        if (typeof subs === 'string') subs = JSON.parse(subs);
        if (Array.isArray(subs)) subCount = subs.length;
      } catch {}

      return {
        title: `Uruchomienie podagentów (${subCount})`,
        subtitle: (args.toolAction as string) || (args.toolSummary as string) || 'Delegowanie zadań do zespołu',
        icon: 'Users',
      };
    }

    if (norm.includes('define')) {
      const name = (args.name as string) || '';
      return {
        title: name ? `Definicja roli: ${name}` : 'Nowa rola agenta',
        subtitle: (args.description as string) || 'Rejestracja profilu subagenta',
        icon: 'Bot',
      };
    }

    if (norm.includes('manage')) {
      const action = (args.Action as string) || '';
      return {
        title: action ? `Zarządzanie: ${action}` : 'Status podagentów',
        subtitle: (args.toolAction as string) || 'Kontrola i koordynacja procesów',
        icon: 'Users',
      };
    }

    if (norm.includes('send_message')) {
      return {
        title: 'Wiadomość wewnętrzna',
        subtitle: (args.Recipient as string) ? `Do agenta: ${args.Recipient}` : 'Komunikacja między procesami',
        icon: 'MessageSquare',
      };
    }
  }

  const action = (args.toolAction || args.toolSummary) as string;
  return {
    title: action || `Narzędzie: ${toolName}`,
    subtitle: (args.Description as string) || 'Wykonywanie operacji pomocniczej',
    icon: 'Wrench',
  };
}

export function getToolStatusText(status: ToolStatus): { label: string; shortLabel: string; color: string } {
  switch (status) {
    case 'running':
      return { label: 'W trakcie...', shortLabel: '...', color: 'text-amber-500 bg-amber-500/10 border-amber-500/30' };
    case 'completed':
      return { label: 'Zakończono', shortLabel: '✓', color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30' };
    case 'failed':
      return { label: 'Niepowodzenie', shortLabel: '✕', color: 'text-rose-500 bg-rose-500/10 border-rose-500/30' };
    case 'cancelled':
      return { label: 'Anulowano', shortLabel: '⊘', color: 'text-neutral-400 bg-neutral-500/10 border-neutral-500/30' };
    case 'pending':
    default:
      return { label: 'W kolejce', shortLabel: '•', color: 'text-neutral-400 bg-neutral-500/10 border-neutral-500/30' };
  }
}

