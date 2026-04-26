'use client';

import { Providers } from './providers';
import RouteTransitions from '@/components/RouteTransitions';

export default function ClientLayout({ children }) {
  return (
    <Providers>
      <RouteTransitions>{children}</RouteTransitions>
    </Providers>
  );
}

