'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function safeMsg(v) {
  const s = String(v || '').trim();
  return s.length > 800 ? `${s.slice(0, 800)}…` : s;
}

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null, expanded: false, errorId: '' };
  }

  static getDerivedStateFromError(error) {
    const errorId = `err_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    return { hasError: true, error, errorId };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', { error, info });
    this.setState({ info });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const message = safeMsg(this.state.error?.message || 'Something went wrong.');
    const stack = safeMsg(this.state.error?.stack || '');
    const componentStack = safeMsg(this.state.info?.componentStack || '');
    const isDev = process.env.NODE_ENV === 'development';

    return (
      <div className={cn('app-shell flex min-h-[100dvh] items-center justify-center bg-ui-canvas p-4', this.props.className)}>
        <div className="w-full max-w-xl rounded-3xl border border-ui-border bg-ui-panel p-6 shadow-2xl shadow-black/10 dark:shadow-black/40">
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Something went wrong</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{message}</p>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Error ID: <span className="font-mono font-semibold">{this.state.errorId}</span>
          </p>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Button
              onClick={() => {
                try {
                  window.location.reload();
                } catch {
                  /* ignore */
                }
              }}
              className="sm:flex-1"
            >
              Reload
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                try {
                  navigator.clipboard?.writeText?.(this.state.errorId);
                } catch {
                  /* ignore */
                }
              }}
              className="sm:flex-1"
            >
              Copy error ID
            </Button>
            <Button
              variant="ghost"
              onClick={() => this.setState((s) => ({ ...s, expanded: !s.expanded }))}
              className="sm:flex-1"
            >
              {this.state.expanded ? 'Hide details' : 'Show details'}
            </Button>
          </div>

          {this.state.expanded ? (
            <div className="mt-4 rounded-2xl border border-ui-border bg-ui-muted/40 p-3">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Details</p>
              {isDev ? (
                <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-snug text-slate-700 dark:text-slate-200">
                  {stack}
                  {'\n'}
                  {componentStack}
                </pre>
              ) : (
                <p className="mt-2 text-[12px] text-slate-600 dark:text-slate-300">
                  Thanks — if this keeps happening, share the error ID with support.
                </p>
              )}
            </div>
          ) : null}
        </div>
      </div>
    );
  }
}

