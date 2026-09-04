import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseResizableOptions {
  initialSize: number;
  minSize?: number | (() => number);
  maxSize?: number | (() => number);
  direction: 'horizontal' | 'vertical';
  reverse?: boolean; // True if dragging in negative delta increases size (e.g. left handle of right-docked panel)
  storageKey?: string;
  onResize?: (newSize: number) => void;
}

export function useResizable({
  initialSize,
  minSize = 100,
  maxSize = 1000,
  direction,
  reverse = false,
  storageKey,
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
    if (storageKey) {
      localStorage.removeItem(storageKey);
    }
    onResize?.(initialSize);
  }, [initialSize, storageKey, onResize]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // Ignore pointer capture error if unsupported
    }
    setIsDragging(true);
    dragRef.current = {
      startPos: direction === 'horizontal' ? e.clientX : e.clientY,
      startSize: size,
    };
  }, [direction, size]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    const currentPos = direction === 'horizontal' ? e.clientX : e.clientY;
    const delta = currentPos - dragRef.current.startPos;
    const effectiveDelta = reverse ? -delta : delta;

    const min = getMin();
    const max = getMax();
    const newSize = Math.max(min, Math.min(max, dragRef.current.startSize + effectiveDelta));

    setSize(newSize);
    onResize?.(newSize);
  }, [isDragging, direction, reverse, getMin, getMax, onResize]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (isDragging) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      setIsDragging(false);
      if (storageKey) {
        localStorage.setItem(storageKey, size.toString());
      }
    }
  }, [isDragging, storageKey, size]);

  // Persist size when it settles
  useEffect(() => {
    if (storageKey && !isDragging) {
      localStorage.setItem(storageKey, size.toString());
    }
  }, [size, storageKey, isDragging]);

  return {
    size,
    setSize,
    isDragging,
    resetSize,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  };
}
