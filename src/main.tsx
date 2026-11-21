import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface ErrorBoundaryState {
  error: Error | null;
}

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error): void {
    console.error('[Frontiers] Render boundary caught error:', error);
  }

  override render() {
    if (this.state.error) {
      return (
        <div className="w-screen h-screen bg-[#0c0f13] text-[#efece4] flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-sm border border-[#d4a253]/40 bg-[#151b24] p-6 space-y-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-[#d4a253] font-semibold">
              Frontiers and Foundations · Recovery
            </p>
            <h1 className="font-display text-lg font-bold text-[#f3efe6]">
              The Meridian Viewport Needs a Reset
            </h1>
            <p className="text-xs text-[#9ca7b5] leading-relaxed">
              {this.state.error.message || 'An unexpected rendering error occurred.'}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-sm bg-[#d4a253] hover:bg-[#e1b366] text-[#14110b] text-xs font-bold uppercase tracking-[0.12em] cursor-pointer"
            >
              Reload Frontier
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>,
);
