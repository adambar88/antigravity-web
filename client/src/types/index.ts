export * from '@shared/types/contract';

export type ActiveTab = 'chat' | 'diffs' | 'files' | 'sessions' | 'artifacts';
export type InspectorTab = 'diffs' | 'files' | 'artifacts';
export type DiffViewMode = 'split' | 'unified';

export interface ToastMessage {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  duration?: number;
}
