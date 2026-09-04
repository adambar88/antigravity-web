import { Component, ErrorInfo, ReactNode, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { initMobileErgonomics } from './utils/mobileErgonomics';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class RootErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[RootErrorBoundary] Caught unhandled error:', error, errorInfo);
  }

  private handleReset = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((regs) => {
          regs.forEach((r) => r.unregister());
        });
      }
    } catch {
      // ignore
    }
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-screen bg-[#0d1117] text-[#f0f6fc] flex flex-col items-center justify-center p-6 text-center">
          <div className="max-w-md w-full bg-[#161b22] border border-[#30363d] rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto text-xl">
              ⚠️
            </div>
            <div>
              <h2 className="text-base font-bold text-main">Wystąpił błąd podczas renderowania</h2>
              <p className="text-xs text-muted mt-1">
                Wystąpił nieoczekiwany wyjątek w interfejsie użytkownika.
              </p>
            </div>
            <div className="p-3 rounded-xl bg-[#0d1117] border border-[#21262d] text-left text-xs font-mono text-rose-400 overflow-auto max-h-40">
              {this.state.error?.message || 'Nieznany błąd React'}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="flex-1 px-3 py-2 rounded-xl bg-[#21262d] hover:bg-[#30363d] text-xs font-medium text-main transition-colors cursor-pointer"
              >
                Odśwież stronę
              </button>
              <button
                type="button"
                onClick={this.handleReset}
                className="flex-1 px-3 py-2 rounded-xl bg-primary hover:bg-primary-hover text-xs font-semibold text-white transition-colors cursor-pointer"
              >
                Wyczyść dane i odśwież
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Initialize mobile ergonomics (visualViewport, keyboard offset, safe areas)
initMobileErgonomics();

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find root element');

createRoot(rootElement).render(
  <StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </StrictMode>
);
