'use client';

import dynamic from 'next/dynamic';
import { ThemeProvider } from '@/context/ThemeContext';
import { AuthProvider } from '@/context/AuthContext';
import { SocketProvider } from '@/context/SocketContext';
import { IncomingCallProvider } from '@/context/IncomingCallContext';

const IncomingCallOverlay = dynamic(() => import('@/components/IncomingCallOverlay'), {
  ssr: false,
  loading: () => null,
});

export function Providers({ children }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SocketProvider>
          <IncomingCallProvider>
            <IncomingCallOverlay />
            {children}
          </IncomingCallProvider>
        </SocketProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
