import React from 'react';

export interface ResizeHandleProps {
  direction: 'horizontal' | 'vertical';
  isDragging: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onDoubleClick?: () => void;
  className?: string;
  showPill?: boolean;
  title?: string;
}

export const ResizeHandle: React.FC<ResizeHandleProps> = ({
  direction,
  isDragging,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onDoubleClick,
  className = '',
  showPill = false,
  title = 'Przeciągnij, aby zmienić rozmiar (podwójne kliknięcie resetuje)',
}) => {
  const isHorizontal = direction === 'horizontal';

  return (
    <div
      role="separator"
      aria-orientation={isHorizontal ? 'vertical' : 'horizontal'}
      title={title}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={onDoubleClick}
      className={`touch-none select-none transition-colors relative flex items-center justify-center z-30 ${
        isHorizontal
          ? 'w-2 hover:w-2 cursor-col-resize -mx-1'
          : 'h-2 hover:h-2 cursor-row-resize -my-1'
      } ${
        isDragging ? 'bg-primary/40' : 'hover:bg-primary/20'
      } ${className}`}
    >
      {/* Visual indicator line or pill */}
      {showPill ? (
        <div
          className={`rounded-full transition-colors ${
            isHorizontal
              ? 'w-1 h-8 bg-border-strong group-hover:bg-primary'
              : 'w-12 h-1.5 bg-border-strong group-hover:bg-primary'
          } ${isDragging ? 'bg-primary' : ''}`}
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
