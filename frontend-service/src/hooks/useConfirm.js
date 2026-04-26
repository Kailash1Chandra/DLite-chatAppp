'use client';

import { useConfirmContext } from '@/context/ConfirmContext';

export function useConfirm() {
  const { confirm } = useConfirmContext();
  return { confirm };
}

