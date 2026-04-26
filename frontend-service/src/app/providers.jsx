'use client';

import dynamic from 'next/dynamic';
import { ThemeProvider } from '@/context/ThemeContext';
import { AuthProvider } from '@/context/AuthContext';
import { IncomingCallProvider } from '@/context/IncomingCallContext';
import { ToastProvider } from '@/context/ToastContext';
import { ConfirmProvider } from '@/context/ConfirmContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const QuickSwitcher = dynamic(() => import('@/components/QuickSwitcher'), {
  ssr: false,
  loading: () => null,
});

const IncomingCallOverlay = dynamic(() => import('@/components/IncomingCallOverlay'), {
  ssr: false,
  loading: () => null,
});

const ConfirmDialog = dynamic(() => import('@/components/ConfirmDialog'), {
  ssr: false,
  loading: () => null,
});

const ToastViewport = dynamic(() => import('@/components/ToastViewport').then((m) => m.ToastViewport), {
  ssr: false,
  loading: () => null,
});

const InAppNotificationListener = dynamic(() => import('@/components/InAppNotificationListener'), {
  ssr: false,
  loading: () => null,
});

export function Providers({ children }) {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <ConfirmProvider>
              <IncomingCallProvider>
                <IncomingCallOverlay />
                <QuickSwitcher />
                <InAppNotificationListener />
                <ToastViewport />
                <ConfirmDialog />
                {children}
              </IncomingCallProvider>
            </ConfirmProvider>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
