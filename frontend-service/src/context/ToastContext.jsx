 'use client';
 
 import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
 
 const ToastContext = createContext(null);
 
 function clamp(n, min, max) {
   return Math.max(min, Math.min(max, n));
 }
 
 export function ToastProvider({ children }) {
   const [toasts, setToasts] = useState([]);
   const seq = useRef(1);
 
   const removeToast = useCallback((id) => {
     setToasts((prev) => prev.filter((t) => t.id !== id));
   }, []);
 
   const addToast = useCallback((toast) => {
     const id = `t_${Date.now()}_${seq.current++}`;
     const ttl = clamp(Number(toast?.ttlMs ?? 4500), 1500, 15000);
     const next = {
       id,
       title: String(toast?.title || '').trim(),
       message: String(toast?.message || '').trim(),
       tone: String(toast?.tone || 'info'),
       createdAt: Date.now(),
       ttlMs: ttl,
     };
     setToasts((prev) => [next, ...prev].slice(0, 4));
     if (typeof window !== 'undefined') {
       window.setTimeout(() => removeToast(id), ttl);
     }
     return id;
   }, [removeToast]);
 
   const value = useMemo(() => ({ toasts, addToast, removeToast }), [toasts, addToast, removeToast]);
 
   return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
 }
 
 export function useToasts() {
   const ctx = useContext(ToastContext);
   if (!ctx) {
     throw new Error('useToasts must be used within ToastProvider');
   }
   return ctx;
 }
