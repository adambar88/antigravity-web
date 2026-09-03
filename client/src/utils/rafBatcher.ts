/**
 * RequestAnimationFrame (RAF) Token Batching Utility
 *
 * Prevents React render saturation and layout thrashing during high-throughput
 * token streaming bursts (100+ tokens/sec). Buffers arriving stream deltas and
 * commits them once per animation frame (~16.6ms at 60Hz or ~8.3ms at 120Hz).
 *
 * Includes background tab fallback (max delay cap) and immediate flush on stream completion.
 */

import { useEffect, useRef, useState, useCallback } from 'react';

export interface RafBatcherOptions {
  /**
   * Maximum latency before flushing even if RAF hasn't fired
   * (crucial for background tabs where RAF is paused by the browser).
   * Default: 50ms.
   */
  maxDelayMs?: number;

  /**
   * Optional custom accumulator (default: string concatenation).
   */
  accumulator?: (current: string, incoming: string) => string;
}

const defaultAccumulator = (current: string, incoming: string): string => current + incoming;

/**
 * Low-level RAF Token Batcher
 */
export class RafTokenBatcher {
  private buffer: string = '';
  private rafId: number | null = null;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private onFlush: (batched: string) => void;
  private maxDelayMs: number;
  private accumulator: (current: string, incoming: string) => string;
  private isDisposed: boolean = false;

  constructor(
    onFlush: (batched: string) => void,
    options: RafBatcherOptions = {}
  ) {
    this.onFlush = onFlush;
    this.maxDelayMs = options.maxDelayMs ?? 50;
    this.accumulator = options.accumulator ?? defaultAccumulator;
  }

  /**
   * Enqueues an incoming token / delta string.
   * If no RAF frame is currently scheduled, one will be requested.
   */
  public add(delta: string): void {
    if (this.isDisposed || !delta) return;

    this.buffer = this.accumulator(this.buffer, delta);
    this.scheduleFlush();
  }

  /**
   * Alias for add()
   */
  public push(delta: string): void {
    this.add(delta);
  }

  /**
   * Schedules a flush on the next animation frame, with a safety timeout
   * for background tabs.
   */
  private scheduleFlush(): void {
    if (this.rafId !== null) {
      // Already scheduled on RAF
      return;
    }

    // Schedule RAF if available
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      this.rafId = window.requestAnimationFrame(() => {
        this.rafId = null;
        this.flush();
      });
    } else {
      // Fallback for SSR / Node environment
      this.rafId = (setTimeout(() => {
        this.rafId = null;
        this.flush();
      }, 16) as unknown) as number;
    }

    // Safety timeout: in case the tab is hidden and RAF stops ticking
    if (this.timeoutId === null && this.maxDelayMs > 0) {
      this.timeoutId = setTimeout(() => {
        this.timeoutId = null;
        if (this.buffer.length > 0) {
          this.flush();
        }
      }, this.maxDelayMs);
    }
  }

  /**
   * Immediately flushes any pending buffer synchronously.
   * Must be called on stream completion (message_complete / thought_complete / abort).
   */
  public flush(): void {
    this.clearTimers();

    if (this.buffer.length === 0) return;

    const toFlush = this.buffer;
    this.buffer = '';

    try {
      this.onFlush(toFlush);
    } catch (err) {
      console.error('Błąd podczas opróżniania bufora RAF tokenów:', err);
    }
  }

  /**
   * Cancels scheduled flushes and clears the buffer without invoking the callback.
   */
  public cancel(): void {
    this.clearTimers();
    this.buffer = '';
  }

  /**
   * Returns whether there are unflushed tokens waiting in the buffer.
   */
  public get hasPending(): boolean {
    return this.buffer.length > 0;
  }

  /**
   * Returns the current unflushed buffer content without flushing it.
   */
  public get pending(): string {
    return this.buffer;
  }

  /**
   * Permanently disposes the batcher instance.
   */
  public dispose(): void {
    this.isDisposed = true;
    this.cancel();
  }

  private clearTimers(): void {
    if (this.rafId !== null) {
      if (typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
        window.cancelAnimationFrame(this.rafId);
      } else {
        clearTimeout(this.rafId as unknown as NodeJS.Timeout);
      }
      this.rafId = null;
    }

    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}

/**
 * Keyed RAF Token Batcher
 * Allows managing multiple concurrent streaming keys (e.g., thought vs message, or multiple steps)
 * using a single unified animation frame loop.
 */
export class KeyedRafTokenBatcher<K = string> {
  private buffers: Map<K, string> = new Map();
  private rafId: number | null = null;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private onFlush: (key: K, batched: string) => void;
  private maxDelayMs: number;
  private isDisposed: boolean = false;

  constructor(
    onFlush: (key: K, batched: string) => void,
    options: RafBatcherOptions = {}
  ) {
    this.onFlush = onFlush;
    this.maxDelayMs = options.maxDelayMs ?? 50;
  }

  public add(key: K, delta: string): void {
    if (this.isDisposed || !delta) return;

    const current = this.buffers.get(key) || '';
    this.buffers.set(key, current + delta);
    this.scheduleFlush();
  }

  private scheduleFlush(): void {
    if (this.rafId !== null) return;

    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      this.rafId = window.requestAnimationFrame(() => {
        this.rafId = null;
        this.flush();
      });
    } else {
      this.rafId = (setTimeout(() => {
        this.rafId = null;
        this.flush();
      }, 16) as unknown) as number;
    }

    if (this.timeoutId === null && this.maxDelayMs > 0) {
      this.timeoutId = setTimeout(() => {
        this.timeoutId = null;
        if (this.buffers.size > 0) {
          this.flush();
        }
      }, this.maxDelayMs);
    }
  }

  public flush(targetKey?: K): void {
    if (targetKey !== undefined) {
      const chunk = this.buffers.get(targetKey);
      if (chunk) {
        this.buffers.delete(targetKey);
        this.onFlush(targetKey, chunk);
      }
      if (this.buffers.size === 0) {
        this.clearTimers();
      }
      return;
    }

    this.clearTimers();
    if (this.buffers.size === 0) return;

    const entries = Array.from(this.buffers.entries());
    this.buffers.clear();

    for (const [key, chunk] of entries) {
      if (chunk.length > 0) {
        try {
          this.onFlush(key, chunk);
        } catch (err) {
          console.error(`Błąd podczas flushowania bufora dla klucza ${String(key)}:`, err);
        }
      }
    }
  }

  public cancel(key?: K): void {
    if (key !== undefined) {
      this.buffers.delete(key);
      if (this.buffers.size === 0) {
        this.clearTimers();
      }
    } else {
      this.clearTimers();
      this.buffers.clear();
    }
  }

  public dispose(): void {
    this.isDisposed = true;
    this.cancel();
  }

  private clearTimers(): void {
    if (this.rafId !== null) {
      if (typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
        window.cancelAnimationFrame(this.rafId);
      } else {
        clearTimeout(this.rafId as unknown as NodeJS.Timeout);
      }
      this.rafId = null;
    }
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}

/**
 * Factory helper
 */
export function createRafBatcher(
  onFlush: (buffered: string) => void,
  options?: RafBatcherOptions
): RafTokenBatcher {
  return new RafTokenBatcher(onFlush, options);
}

/**
 * React Hook: useRafTokenBatcher
 *
 * Wraps an onFlush callback so that high frequency add(delta) calls
 * are throttled to requestAnimationFrame boundaries.
 */
export function useRafTokenBatcher(
  onFlush: (batched: string) => void,
  options?: RafBatcherOptions
) {
  const onFlushRef = useRef(onFlush);
  onFlushRef.current = onFlush;

  const batcherRef = useRef<RafTokenBatcher | null>(null);

  if (!batcherRef.current) {
    batcherRef.current = new RafTokenBatcher((batched) => {
      onFlushRef.current(batched);
    }, options);
  }

  useEffect(() => {
    return () => {
      batcherRef.current?.dispose();
    };
  }, []);

  const add = useCallback((delta: string) => {
    batcherRef.current?.add(delta);
  }, []);

  const flush = useCallback(() => {
    batcherRef.current?.flush();
  }, []);

  const cancel = useCallback(() => {
    batcherRef.current?.cancel();
  }, []);

  return {
    add,
    flush,
    cancel,
    get hasPending() {
      return batcherRef.current?.hasPending ?? false;
    },
  };
}

/**
 * React Hook: useBufferedTokenStream
 *
 * Manages text streaming state batched via RAF.
 * Automatically appends incoming deltas to state on animation frame boundaries.
 */
export function useBufferedTokenStream(initialValue = '', options?: RafBatcherOptions) {
  const [text, setText] = useState(initialValue);

  const batcher = useRafTokenBatcher(
    useCallback((batchedDelta: string) => {
      setText((prev) => prev + batchedDelta);
    }, []),
    options
  );

  const appendDelta = useCallback(
    (delta: string) => {
      batcher.add(delta);
    },
    [batcher]
  );

  const flush = useCallback(() => {
    batcher.flush();
  }, [batcher]);

  const reset = useCallback(
    (newText = '') => {
      batcher.cancel();
      setText(newText);
    },
    [batcher]
  );

  return {
    text,
    setText,
    appendDelta,
    flush,
    reset,
  };
}
