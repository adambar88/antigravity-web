import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseResizableOptions {
  initialSize: number;
  minSize?: number | (() => number);
  maxSize?: number | (() => number);
  direction: 'horizontal' | 'vertical';
  reverse?: boolean; // True if dragging in negative delta increases size
  storageKey?: string;
  getCurrentSize?: () => number;
  onResize?: (newSize: number) => void;
}

export function useResizable({
  initialSize,
  minSize = 100,
  maxSize = 1000,
  direction,
  reverse = false,
  storageKey,
  getCurrentSize,
  onResize,
}: UseResizableOptions) {
  const getMin = useCallback(() => {
    return typeof minSize === 'function' ? minSize() : minSize;
  }, [minSize]);

  const getMax = useCallback(() => {
    return typeof maxSize === 'function' ? maxSize() : maxSize;
  }, [maxSize]);

  const [size, setSize] = useState<number>(() => {
    if (storageKey && typeof window !== 'undefined') {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = parseFloat(saved);
        if (!isNaN(parsed)) {
          const min = typeof minSize === 'function' ? minSize() : minSize;
          const max = typeof maxSize === 'function' ? maxSize() : maxSize;
          return Math.max(min, Math.min(max, parsed));
        }
      }
    }
    return initialSize;
  });

  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{
    startPos: number;
    startSize: number;
  }>({ startPos: 0, startSize: initialSize });

  const resetSize = useCallback(() => {
    setSize(initialSize);
    if (storageKey && typeof window !== 'undefined') {
      localStorage.removeItem(storageKey);
    }
    onResize?.(initialSize);
  }, [initialSize, storageKey, onResize]);

  const handleMoveRef = useRef<((e: PointerEvent) => void) | null>(null);
  const handleUpRef = useRef<((e: PointerEvent) => void) | null>(null);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Prevent text selection, keyboard popping and scrolling
      e.preventDefault();
      e.stopPropagation();

      const currentSize = getCurrentSize ? getCurrentSize() : size;
      const startPos = direction === 'horizontal' ? e.clientX : e.clientY;

      dragRef.current = {
        startPos,
        startSize: currentSize,
      };

      setIsDragging(true);

      const prevUserSelect = document.body.style.userSelect;
      const prevTouchAction = document.body.style.touchAction;
      document.body.style.userSelect = 'none';
      document.body.style.touchAction = 'none';

      const onPointerMove = (moveEvent: PointerEvent) => {
        moveEvent.preventDefault();
        moveEvent.stopPropagation();

        const curPos = direction === 'horizontal' ? moveEvent.clientX : moveEvent.clientY;
        const delta = curPos - dragRef.current.startPos;
        const effectiveDelta = reverse ? -delta : delta;

        const min = getMin();
        const max = getMax();
        const newSize = Math.max(min, Math.min(max, Math.round(dragRef.current.startSize + effectiveDelta)));

        setSize(newSize);
        onResize?.(newSize);
      };

      const onPointerUp = (upEvent: PointerEvent) => {
        upEvent.preventDefault();
        upEvent.stopPropagation();

        setIsDragging(false);
        document.body.style.userSelect = prevUserSelect;
        document.body.style.touchAction = prevTouchAction;

        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerUp);

        const curPos = direction === 'horizontal' ? upEvent.clientX : upEvent.clientY;
        const delta = curPos - dragRef.current.startPos;
        const effectiveDelta = reverse ? -delta : delta;
        const min = getMin();
        const max = getMax();
        const finalSize = Math.max(min, Math.min(max, Math.round(dragRef.current.startSize + effectiveDelta)));

        if (storageKey && typeof window !== 'undefined') {
          localStorage.setItem(storageKey, finalSize.toString());
        }
      };

      handleMoveRef.current = onPointerMove;
      handleUpRef.current = onPointerUp;

      window.addEventListener('pointermove', onPointerMove, { passive: false });
      window.addEventListener('pointerup', onPointerUp, { passive: false });
      window.addEventListener('pointercancel', onPointerUp, { passive: false });
    },
    [direction, size, reverse, getMin, getMax, storageKey, getCurrentSize, onResize]
  );

  useEffect(() => {
    return () => {
      if (handleMoveRef.current) {
        window.removeEventListener('pointermove', handleMoveRef.current);
      }
      if (handleUpRef.current) {
        window.removeEventListener('pointerup', handleUpRef.current);
        window.removeEventListener('pointercancel', handleUpRef.current);
      }
    };
  }, []);

  return {
    size,
    setSize,
    isDragging,
    resetSize,
    handlePointerDown,
    handlePointerMove: () => {},
    handlePointerUp: () => {},
  };
}
