import React, { useEffect, useRef, useState, useCallback } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { ToastMessage } from '@/types';

interface ToastNotificationProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

interface ToastItemProps {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onDismiss }) => {
  // Calculate dynamic duration based on message severity and length
  const defaultDuration = (() => {
    if (toast.duration) return toast.duration;
    if (toast.type === 'error') return 7500;
    if (toast.type === 'warning') return 5500;
    return Math.max(3500, toast.message.length * 55);
  })();

  const [remainingTime, setRemainingTime] = useState<number>(defaultDuration);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isDismissing, setIsDismissing] = useState<boolean>(false);

  // Touch gesture state for swipe-to-dismiss
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Trigger brief subtle vibration on mobile for alerts/warnings
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        if (toast.type === 'error') navigator.vibrate?.([25, 40, 25]);
        else if (toast.type === 'warning') navigator.vibrate?.(30);
      } catch {
        // Non-fatal if unsupported or blocked by browser policy
      }
    }
  }, [toast.type]);

  // Handle countdown & progress bar with pause support
  useEffect(() => {
    if (isPaused || isDismissing) return;

    const intervalStep = 50;
    const interval = setInterval(() => {
      setRemainingTime((prev) => {
        if (prev <= intervalStep) {
          clearInterval(interval);
          setIsDismissing(true);
          setTimeout(() => onDismiss(toast.id), 180);
          return 0;
        }
        return prev - intervalStep;
      });
    }, intervalStep);

    return () => clearInterval(interval);
  }, [isPaused, isDismissing, toast.id, onDismiss]);

  const handleManualDismiss = useCallback(() => {
    setIsDismissing(true);
    setTimeout(() => onDismiss(toast.id), 150);
  }, [toast.id, onDismiss]);

  // Touch Gestures: Swipe to Dismiss (Horizontal or Upwards)
  const handleTouchStart = (e: React.TouchEvent) => {
    setIsPaused(true);
    setIsDragging(true);
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;

    // Allow horizontal drag and upward drag (since mobile toast is at the top)
    setDragOffset({
      x: deltaX,
      y: Math.min(0, deltaY),
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    setIsPaused(false);

    // If swiped horizontally > 75px or swiped upwards < -40px, dismiss
    if (Math.abs(dragOffset.x) > 75 || dragOffset.y < -40) {
      setIsDismissing(true);
      setTimeout(() => onDismiss(toast.id), 150);
    } else {
      // Snap back to initial position
      setDragOffset({ x: 0, y: 0 });
    }
    touchStartRef.current = null;
  };

  // Icon & Theme Tokens
  let icon = <Info className="w-4 h-4 text-sky-500 shrink-0" />;
  let borderStyle = 'border-sky-500/30';
  let progressBg = 'bg-sky-500';

  if (toast.type === 'success') {
    icon = <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />;
    borderStyle = 'border-emerald-500/30';
    progressBg = 'bg-emerald-500';
  } else if (toast.type === 'warning') {
    icon = <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />;
    borderStyle = 'border-amber-500/30';
    progressBg = 'bg-amber-500';
  } else if (toast.type === 'error') {
    icon = <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />;
    borderStyle = 'border-rose-500/30';
    progressBg = 'bg-rose-500';
  }

  const progressPercent = Math.max(0, Math.min(100, (remainingTime / defaultDuration) * 100));
  const dragOpacity = isDragging ? Math.max(0.2, 1 - Math.abs(dragOffset.x) / 180) : 1;

  return (
    <div
      role={toast.type === 'error' || toast.type === 'warning' ? 'alert' : 'status'}
      aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        transform: `translate3d(${dragOffset.x}px, ${dragOffset.y}px, 0)`,
        opacity: isDismissing ? 0 : dragOpacity,
        transition: isDragging ? 'none' : 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.18s ease-out',
      }}
      className={`pointer-events-auto relative w-full max-w-sm rounded-2xl bg-surface/95 backdrop-blur-md border ${borderStyle} shadow-xl text-xs font-medium text-main overflow-hidden transition-all duration-200 select-none ${
        isDismissing ? 'scale-95' : 'animate-in fade-in slide-in-from-top-3 sm:slide-in-from-right-4 duration-200'
      }`}
    >
      <div className="flex items-center gap-3 px-3.5 py-3">
        {icon}
        <span className="flex-1 break-words text-main leading-relaxed select-text">{toast.message}</span>

        {/* Optional Action Button */}
        {toast.action && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toast.action?.onClick();
              handleManualDismiss();
            }}
            className="px-2.5 py-1 rounded-lg bg-primary/15 hover:bg-primary/25 text-primary text-[11px] font-semibold tracking-wide shrink-0 transition-colors cursor-pointer"
          >
            {toast.action.label}
          </button>
        )}

        {/* Close Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleManualDismiss();
          }}
          className="p-1 rounded-lg text-muted hover:text-main hover:bg-surface-hover transition-colors cursor-pointer shrink-0"
          title="Zamknij powiadomienie"
          aria-label="Zamknij"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Progress Bar Indicator */}
      <div className="w-full h-0.5 bg-border/25 overflow-hidden">
        <div
          className={`h-full ${progressBg} transition-all duration-75 ease-linear`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
};

export const ToastNotification: React.FC<ToastNotificationProps> = ({ toasts, onDismiss }) => {
  // Global Escape key dismisses the most recent toast
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && toasts.length > 0) {
        onDismiss(toasts[toasts.length - 1].id);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toasts, onDismiss]);

  if (toasts.length === 0) return null;

  return (
    <aside
      aria-label="Powiadomienia systemowe"
      className="fixed z-50 pointer-events-none transition-all duration-300
                 top-3 inset-x-3 flex flex-col items-center gap-2.5
                 sm:top-5 sm:right-6 sm:left-auto sm:w-96 sm:items-end"
    >
      {toasts.slice(-3).map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </aside>
  );
};
