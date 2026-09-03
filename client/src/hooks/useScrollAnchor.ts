import { useCallback, useEffect, useRef, useState } from 'react';

export function useScrollAnchor(dependencies: unknown[] = []) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showScrollBadge, setShowScrollBadge] = useState(false);
  const isAutoScrollingRef = useRef(false);

  const scrollToBottom = useCallback((smooth = true) => {
    const el = containerRef.current;
    if (!el) return;
    isAutoScrollingRef.current = true;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: smooth ? 'smooth' : 'instant',
    });
    setIsAtBottom(true);
    setShowScrollBadge(false);

    setTimeout(() => {
      isAutoScrollingRef.current = false;
    }, 150);
  }, []);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el || isAutoScrollingRef.current) return;

    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;

    // Disengage if scrolled up by more than 40px
    if (distanceFromBottom > 40) {
      setIsAtBottom(false);
      setShowScrollBadge(true);
    } else {
      setIsAtBottom(true);
      setShowScrollBadge(false);
    }
  }, []);

  // When dependencies change (e.g. streaming chunks, messages added),
  // scroll to bottom only if user hasn't scrolled up
  useEffect(() => {
    if (isAtBottom && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [isAtBottom, ...dependencies]);

  return {
    containerRef,
    isAtBottom,
    showScrollBadge,
    scrollToBottom,
    handleScroll,
  };
}
