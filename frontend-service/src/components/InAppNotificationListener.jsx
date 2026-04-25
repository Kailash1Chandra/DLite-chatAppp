'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useToasts } from '@/context/ToastContext';
import { subscribeGroupDeleted, subscribeGroupMemberRemoved, subscribeThreadUpdated } from '@/services/chatClient';

function shouldToastForThread(pathname) {
  const p = String(pathname || '');
  // Avoid noisy popups while user is already inside chat UIs.
  return !(p.startsWith('/dashboard') || p.startsWith('/groups'));
}

export default function InAppNotificationListener() {
  const { user } = useAuth();
  const { addToast } = useToasts();
  const pathname = usePathname();
  const lastThreadAtRef = useRef(0);

  useEffect(() => {
    if (!user?.id) return;

    const unsubThread = subscribeThreadUpdated((payload) => {
      const now = Date.now();
      // Basic spam guard: thread_updated can come in bursts.
      if (now - lastThreadAtRef.current < 900) return;
      lastThreadAtRef.current = now;

      // Only toast when user isn't already in chat pages.
      if (!shouldToastForThread(pathname)) return;

      const chatId = String(payload?.chatId || '').trim();
      addToast({
        title: 'New message',
        message: chatId ? `You have new activity in a chat.` : 'You have new activity.',
        tone: 'info',
        ttlMs: 4200,
      });
    });

    const unsubRemoved = subscribeGroupMemberRemoved(({ groupId, userId }) => {
      if (String(userId || '').trim() !== String(user.id).trim()) return;
      addToast({
        title: 'Removed from group',
        message: groupId ? `You were removed from a group.` : 'You were removed from a group.',
        tone: 'warning',
        ttlMs: 6500,
      });
    });

    const unsubDeleted = subscribeGroupDeleted(({ groupId }) => {
      addToast({
        title: 'Group deleted',
        message: groupId ? `A group you’re in was deleted.` : 'A group you’re in was deleted.',
        tone: 'warning',
        ttlMs: 6500,
      });
    });

    return () => {
      try {
        unsubThread?.();
        unsubRemoved?.();
        unsubDeleted?.();
      } catch {
        /* ignore */
      }
    };
  }, [user?.id, pathname, addToast]);

  return null;
}
