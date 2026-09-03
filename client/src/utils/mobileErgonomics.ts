/**
 * Antigravity Web Studio - Mobile Ergonomics & Viewport Adapter
 *
 * Provides dynamic viewport height adjustments, virtual keyboard offset tracking
 * via window.visualViewport, safe area inset computation, and touch ergonomic baseline.
 */

export interface SafeAreaInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface ViewportState {
  keyboardOffset: number;
  isKeyboardOpen: boolean;
  viewportHeight: number;
  viewportWidth: number;
  offsetTop: number;
  safeAreas: SafeAreaInsets;
  orientation: 'portrait' | 'landscape';
}

type ViewportChangeListener = (state: ViewportState) => void;

// Active listeners and teardown handlers
const listeners = new Set<ViewportChangeListener>();
let rafId: number | null = null;
let isInitialized = false;
let probeElement: HTMLElement | null = null;

// Current state cache
let currentState: ViewportState = {
  keyboardOffset: 0,
  isKeyboardOpen: false,
  viewportHeight: typeof window !== 'undefined' ? window.innerHeight : 0,
  viewportWidth: typeof window !== 'undefined' ? window.innerWidth : 0,
  offsetTop: 0,
  safeAreas: { top: 0, bottom: 0, left: 0, right: 0 },
  orientation: 'portrait'
};

/**
 * Creates or retrieves a hidden probe element measuring safe-area-inset values.
 */
function getOrCreateProbe(): HTMLElement {
  if (probeElement && document.body.contains(probeElement)) {
    return probeElement;
  }

  const probe = document.createElement('div');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.position = 'fixed';
  probe.style.top = '0';
  probe.style.left = '0';
  probe.style.width = '0';
  probe.style.height = '0';
  probe.style.visibility = 'hidden';
  probe.style.pointerEvents = 'none';
  probe.style.zIndex = '-9999';

  // Apply env() variables for computed measurement
  probe.style.paddingTop = 'env(safe-area-inset-top, 0px)';
  probe.style.paddingBottom = 'env(safe-area-inset-bottom, 0px)';
  probe.style.paddingLeft = 'env(safe-area-inset-left, 0px)';
  probe.style.paddingRight = 'env(safe-area-inset-right, 0px)';

  if (document.body) {
    document.body.appendChild(probe);
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      document.body.appendChild(probe);
    });
  }

  probeElement = probe;
  return probe;
}

/**
 * Measure real pixel safe-area insets from environment.
 */
export function getSafeAreaInsets(): SafeAreaInsets {
  if (typeof window === 'undefined') {
    return { top: 0, bottom: 0, left: 0, right: 0 };
  }

  try {
    const probe = getOrCreateProbe();
    const style = window.getComputedStyle(probe);

    return {
      top: parseFloat(style.paddingTop) || 0,
      bottom: parseFloat(style.paddingBottom) || 0,
      left: parseFloat(style.paddingLeft) || 0,
      right: parseFloat(style.paddingRight) || 0
    };
  } catch {
    return { top: 0, bottom: 0, left: 0, right: 0 };
  }
}

/**
 * Recalculates viewport dimensions, keyboard offset, and safe areas.
 * Updates CSS Custom Properties on :root.
 */
export function updateMobileMetrics(): ViewportState {
  if (typeof window === 'undefined') return currentState;

  const root = document.documentElement;
  const vv = window.visualViewport;
  const layoutHeight = window.innerHeight;
  const layoutWidth = window.innerWidth;

  let vvHeight = layoutHeight;
  let vvWidth = layoutWidth;
  let offsetTop = 0;

  if (vv) {
    vvHeight = vv.height;
    vvWidth = vv.width;
    offsetTop = vv.offsetTop;
  }

  // Calculate keyboard height
  // On iOS Safari / Chrome Android, opening keyboard shrinks visualViewport.height relative to innerHeight
  const rawKeyboardOffset = layoutHeight - vvHeight - offsetTop;
  // Ignore minor address bar collapses (< 60px)
  const isKeyboardOpen = rawKeyboardOffset > 80;
  const keyboardOffset = Math.max(0, Math.round(rawKeyboardOffset));

  const safeAreas = getSafeAreaInsets();
  const orientation: 'portrait' | 'landscape' =
    vvWidth > vvHeight ? 'landscape' : 'portrait';

  // 1. Dynamic CSS Custom Properties for layout styling
  root.style.setProperty('--keyboard-offset', `${keyboardOffset}px`);
  root.style.setProperty('--visual-viewport-height', `${Math.round(vvHeight)}px`);
  root.style.setProperty('--visual-viewport-width', `${Math.round(vvWidth)}px`);
  root.style.setProperty('--visual-viewport-offset-top', `${Math.round(offsetTop)}px`);

  // Normalized dvh / vh units for browsers lacking full modern dvh support
  root.style.setProperty('--vh', `${layoutHeight * 0.01}px`);
  root.style.setProperty('--dvh', `${vvHeight * 0.01}px`);

  // Safe area custom properties
  root.style.setProperty('--safe-area-top', `${safeAreas.top}px`);
  root.style.setProperty('--safe-area-bottom', `${safeAreas.bottom}px`);
  root.style.setProperty('--safe-area-left', `${safeAreas.left}px`);
  root.style.setProperty('--safe-area-right', `${safeAreas.right}px`);

  // 2. Data attributes on <html> for CSS selector scoping
  root.dataset.keyboardOpen = isKeyboardOpen ? 'true' : 'false';
  root.dataset.orientation = orientation;

  currentState = {
    keyboardOffset,
    isKeyboardOpen,
    viewportHeight: Math.round(vvHeight),
    viewportWidth: Math.round(vvWidth),
    offsetTop: Math.round(offsetTop),
    safeAreas,
    orientation
  };

  // 3. Notify subscribed listeners
  listeners.forEach((listener) => {
    try {
      listener(currentState);
    } catch (err) {
      console.error('[MobileErgonomics] Listener error:', err);
    }
  });

  return currentState;
}

/**
 * Throttles metric updates using requestAnimationFrame for 60fps/120fps smoothness.
 */
function scheduleUpdate(): void {
  if (rafId !== null) return;
  rafId = window.requestAnimationFrame(() => {
    rafId = null;
    updateMobileMetrics();
  });
}

/**
 * Handles window scroll adjustment when keyboard appears to keep active input visible.
 */
function handleVisualViewportScroll(): void {
  scheduleUpdate();
}

/**
 * Initializes mobile ergonomics monitoring: binds to visualViewport and window events.
 * Returns a cleanup unbind function.
 */
export function initMobileErgonomics(): () => void {
  if (typeof window === 'undefined' || isInitialized) {
    return cleanupMobileErgonomics;
  }

  isInitialized = true;

  // Initial calculation
  updateMobileMetrics();

  // Bind to visualViewport if supported
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', scheduleUpdate, { passive: true });
    window.visualViewport.addEventListener('scroll', handleVisualViewportScroll, { passive: true });
  }

  // Bind to standard window events
  window.addEventListener('resize', scheduleUpdate, { passive: true });
  window.addEventListener('orientationchange', scheduleUpdate, { passive: true });

  // Handle focus in/out on input fields for immediate keyboard response
  document.addEventListener('focusin', scheduleUpdate, { passive: true });
  document.addEventListener('focusout', () => {
    // Slight delay to allow keyboard retraction animation
    setTimeout(scheduleUpdate, 100);
  }, { passive: true });

  return cleanupMobileErgonomics;
}

/**
 * Cleans up mobile ergonomics event listeners and resets state.
 */
export function cleanupMobileErgonomics(): void {
  if (typeof window === 'undefined' || !isInitialized) return;

  if (window.visualViewport) {
    window.visualViewport.removeEventListener('resize', scheduleUpdate);
    window.visualViewport.removeEventListener('scroll', handleVisualViewportScroll);
  }

  window.removeEventListener('resize', scheduleUpdate);
  window.removeEventListener('orientationchange', scheduleUpdate);
  document.removeEventListener('focusin', scheduleUpdate);

  if (rafId !== null) {
    window.cancelAnimationFrame(rafId);
    rafId = null;
  }

  if (probeElement && probeElement.parentNode) {
    probeElement.parentNode.removeChild(probeElement);
    probeElement = null;
  }

  listeners.clear();
  isInitialized = false;
}

/**
 * Subscribes to viewport and keyboard state changes.
 * Returns an unsubscribe callback.
 */
export function subscribeKeyboardChange(listener: ViewportChangeListener): () => void {
  listeners.add(listener);
  // Emit current state immediately
  listener(currentState);

  return () => {
    listeners.delete(listener);
  };
}

/**
 * Returns current virtual keyboard offset in pixels.
 */
export function getKeyboardOffset(): number {
  return currentState.keyboardOffset;
}

/**
 * Returns true if virtual keyboard is currently detected as open.
 */
export function isKeyboardOpen(): boolean {
  return currentState.isKeyboardOpen;
}

/**
 * Returns current cached viewport state.
 */
export function getViewportState(): ViewportState {
  return currentState;
}
