'use client';

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [state, setState] = useState({ open: false });
  const resolverRef = useRef(null);

  const hide = useCallback(() => setState({ open: false }), []);

  const resolve = useCallback((ok) => {
    const r = resolverRef.current;
    resolverRef.current = null;
    if (typeof r === 'function') r(Boolean(ok));
  }, []);

  const confirm = useCallback((opts) => {
    const o = opts || {};
    setState({
      open: true,
      title: String(o.title || '').trim(),
      description: String(o.description || '').trim(),
      confirmText: String(o.confirmText || '').trim(),
      cancelText: String(o.cancelText || '').trim(),
      variant: String(o.variant || 'primary').trim(),
    });
    return new Promise((resolvePromise) => {
      resolverRef.current = resolvePromise;
    });
  }, []);

  const value = useMemo(() => ({ state, confirm, resolve, hide }), [state, confirm, resolve, hide]);

  return <ConfirmContext.Provider value={value}>{children}</ConfirmContext.Provider>;
}

export function useConfirmContext() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirmContext must be used within ConfirmProvider');
  return ctx;
}

