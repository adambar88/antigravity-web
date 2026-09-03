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

export function getToolDisplayInfo(toolName: string, args: Record<string, unknown> = {}): ToolDisplayInfo {
  const norm = toolName.toLowerCase();

  if (norm.includes('read') || norm.includes('view')) {
    const path = (args.path || args.file_path || args.AbsolutePath || args.TargetFile || '') as string;
    const shortName = path ? path.split('/').filter(Boolean).pop() || path : '';
    return {
      title: shortName ? `📄 Odczyt pliku: ${shortName}` : '📄 Odczyt pliku',
      subtitle: path || 'Przeglądanie zawartości pliku',
      icon: 'FileText',
    };
  }

  if (norm.includes('write') || norm.includes('create')) {
    const path = (args.path || args.file_path || args.TargetFile || '') as string;
    const shortName = path ? path.split('/').filter(Boolean).pop() || path : '';
    return {
      title: shortName ? `📝 Utworzenie pliku: ${shortName}` : '📝 Utworzenie pliku',
      subtitle: path || 'Zapis nowego pliku w projekcie',
      icon: 'FilePlus',
    };
  }

  if (norm.includes('replace') || norm.includes('edit') || norm.includes('patch')) {
    const path = (args.path || args.file_path || args.TargetFile || '') as string;
    const shortName = path ? path.split('/').filter(Boolean).pop() || path : '';
    return {
      title: shortName ? `✏️ Zmiana w pliku: ${shortName}` : '✏️ Zmiana w pliku',
      subtitle: path || 'Wprowadzanie zmian w pliku',
      icon: 'FileCode',
    };
  }

  if (norm.includes('command') || norm.includes('bash') || norm.includes('exec') || norm.includes('run')) {
    const cmd = (args.command || args.CommandLine || args.cmd || '') as string;
    const shortCmd = cmd.length > 35 ? cmd.substring(0, 32) + '...' : cmd;
    return {
      title: shortCmd ? `⚡ Polecenie: ${shortCmd}` : '⚡ Polecenie systemowe',
      subtitle: cmd || 'Uruchomienie procesu w terminalu',
      icon: 'Terminal',
      isDanger: norm.includes('rm') || norm.includes('delete'),
    };
  }

  if (norm.includes('grep') || norm.includes('search') && !norm.includes('web')) {
    const query = (args.query || args.Query || args.pattern || '') as string;
    return {
      title: query ? `🔍 Wyszukiwanie: "${query}"` : '🔍 Wyszukiwanie w projekcie',
      subtitle: 'Skanowanie plików w poszukiwaniu dopasowań',
      icon: 'Search',
    };
  }

  if (norm.includes('find') || norm.includes('list') || norm.includes('dir')) {
    return {
      title: '📁 Przeglądanie katalogów',
      subtitle: (args.SearchDirectory || args.DirectoryPath || args.path || 'Eksploracja struktury plików') as string,
      icon: 'FolderSearch',
    };
  }

  if (norm.includes('web') || norm.includes('url') || norm.includes('browse')) {
    return {
      title: '🌐 Wyszukiwanie w sieci',
      subtitle: (args.url || args.Url || args.query || 'Pobieranie aktualnych informacji') as string,
      icon: 'Globe',
    };
  }

  return {
    title: `🛠️ Działanie: ${toolName}`,
    subtitle: 'Wykonywanie operacji pomocniczej',
    icon: 'Wrench',
  };
}

export function getToolStatusText(status: ToolStatus): { label: string; color: string } {
  switch (status) {
    case 'running':
      return { label: 'W trakcie...', color: 'text-amber-500 bg-amber-500/10 border-amber-500/30' };
    case 'completed':
      return { label: 'Zakończono', color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30' };
    case 'failed':
      return { label: 'Niepowodzenie', color: 'text-rose-500 bg-rose-500/10 border-rose-500/30' };
    case 'cancelled':
      return { label: 'Anulowano', color: 'text-neutral-400 bg-neutral-500/10 border-neutral-500/30' };
    case 'pending':
    default:
      return { label: 'W kolejce', color: 'text-neutral-400 bg-neutral-500/10 border-neutral-500/30' };
  }
}
