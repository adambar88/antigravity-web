import React from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { ToastMessage } from '@/types';

interface ToastNotificationProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastNotification: React.FC<ToastNotificationProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-18 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => {
        let icon = <Info className="w-4 h-4 text-sky-500" />;
        let border = 'border-sky-500/30';

        if (toast.type === 'success') {
          icon = <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
          border = 'border-emerald-500/30';
        } else if (toast.type === 'error') {
          icon = <AlertCircle className="w-4 h-4 text-rose-500" />;
          border = 'border-rose-500/30';
        }

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-card border ${border} shadow-lg text-xs font-medium text-main min-w-[240px] max-w-sm animate-in fade-in slide-in-from-bottom-2 duration-150`}
          >
            {icon}
            <span className="flex-1 truncate">{toast.message}</span>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="p-1 rounded-md text-subtle hover:text-main cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
