/**
 * Utility functions for friendly Polish formatting and session grouping
 */

import { SessionSummary } from '@/types';

export interface GroupedSessions {
  today: SessionSummary[];
  yesterday: SessionSummary[];
  lastWeek: SessionSummary[];
  older: SessionSummary[];
}

export function groupSessionsByDate(sessions: SessionSummary[]): GroupedSessions {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
  const weekStart = todayStart - 7 * 24 * 60 * 60 * 1000;

  const grouped: GroupedSessions = {
    today: [],
    yesterday: [],
    lastWeek: [],
    older: [],
  };

  const sorted = [...sessions].sort((a, b) => b.updated_at - a.updated_at);

  for (const session of sorted) {
    const time = session.updated_at || session.created_at;
    if (time >= todayStart) {
      grouped.today.push(session);
    } else if (time >= yesterdayStart) {
      grouped.yesterday.push(session);
    } else if (time >= weekStart) {
      grouped.lastWeek.push(session);
    } else {
      grouped.older.push(session);
    }
  }

  return grouped;
}

export function formatDuration(ms?: number | null): string {
  if (!ms || ms < 0) return '0s';
  const seconds = ms / 1000;
  if (seconds < 1) {
    return `${(seconds).toFixed(1)}s`;
  }
  if (seconds < 60) {
    return `${seconds.toFixed(seconds < 10 ? 1 : 0)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

export function formatRelativeTime(timestamp: number): string {
  if (!timestamp) return '';
  const now = Date.now();
  const diffSec = Math.floor((now - timestamp) / 1000);

  if (diffSec < 45) return 'przed chwilą';
  if (diffSec < 90) return 'minutę temu';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    if (diffMin >= 2 && diffMin <= 4) return `${diffMin} minuty temu`;
    return `${diffMin} minut temu`;
  }
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) {
    if (diffHours === 1) return 'godzinę temu';
    if (diffHours >= 2 && diffHours <= 4) return `${diffHours} godziny temu`;
    return `${diffHours} godzin temu`;
  }
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'wczoraj';
  if (diffDays < 7) return `${diffDays} dni temu`;
  return new Date(timestamp).toLocaleDateString('pl-PL', {
    day: 'numeric',
    month: 'short',
  });
}

export function formatEffortLabel(effort: string): string {
  switch (effort) {
    case 'high':
      return 'Głęboka analiza';
    case 'medium':
      return 'Standardowa analiza';
    case 'low':
      return 'Szybka odpowiedź';
    default:
      return 'Zrównoważony';
  }
}
