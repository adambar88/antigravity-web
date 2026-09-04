import React, { useRef } from 'react';

export interface ResizeHandleProps {
  direction: 'horizontal' | 'vertical';
  isDragging?: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove?: (e: React.PointerEvent) => void;
  onPointerUp?: (e: React.PointerEvent) => void;
  onDoubleClick?: () => void;
  className?: string;
  showPill?: boolean;
  title?: string;
}

export const ResizeHandle: React.FC<ResizeHandleProps> = ({
  direction,
  isDragging = false,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onDoubleClick,
  className = '',
  showPill = false,
  title = 'Przeciągnij, aby zmienić rozmiar (podwójne kliknięcie resetuje)',
}) => {
  const isHorizontal = direction === 'horizontal';
  const lastTapRef = useRef<number>(0);

  const handlePointerDown = (e: React.PointerEvent) => {
    const now = Date.now();
    // Detect double tap on touch / mobile screens (within 350ms)
    if (onDoubleClick && now - lastTapRef.current < 350) {
      lastTapRef.current = 0;
      e.preventDefault();
      e.stopPropagation();
      onDoubleClick();
      return;
    }
    lastTapRef.current = now;
    onPointerDown(e);
  };

  return (
    <div
      role="separator"
      aria-orientation={isHorizontal ? 'vertical' : 'horizontal'}
      title={title}
      onPointerDown={handlePointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={onDoubleClick}
      className={`touch-none select-none transition-colors relative flex items-center justify-center z-30 ${
        isHorizontal
          ? 'w-3 hover:w-3 cursor-col-resize -mx-1.5'
          : 'h-6 sm:h-5 cursor-row-resize'
      } ${
        isDragging ? 'bg-primary/20' : 'hover:bg-primary/10'
      } ${className}`}
    >
      {/* Visual indicator line or pill */}
      {showPill ? (
        <div
          className={`rounded-full transition-all pointer-events-none ${
            isHorizontal
              ? 'w-1 h-8 bg-border-strong group-hover:bg-primary'
              : 'w-14 h-1.5 bg-border-strong group-hover:bg-primary'
          } ${isDragging ? 'bg-primary scale-110' : ''}`}
        />
      ) : (
        <div
          className={`transition-colors pointer-events-none ${
            isHorizontal
              ? 'w-0.5 h-full bg-border hover:bg-primary/60'
              : 'h-0.5 w-full bg-border hover:bg-primary/60'
          } ${isDragging ? 'bg-primary' : ''}`}
        />
      )}
    </div>
  );
};

