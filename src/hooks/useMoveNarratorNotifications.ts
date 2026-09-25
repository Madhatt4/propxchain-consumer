/**
 * useMoveNarratorNotifications — live view of delivered Move Narrator cards.
 *
 * Reads the localStorage-backed store and re-renders when it changes, whether
 * the change came from this tab (custom event) or another (storage event). The
 * feed surfaces (bell + /notifications) merge these with the canister
 * notifications for display.
 */

import { useCallback, useEffect, useState } from 'react';

import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type DeliveredNotification,
  MOVE_NARRATOR_NOTIFICATIONS_EVENT,
  MOVE_NARRATOR_NOTIFICATIONS_KEY,
} from '../services/moveNarratorNotifications';

interface UseMoveNarratorNotificationsReturn {
  notifications: DeliveredNotification[];
  unreadCount: number;
  markRead: (id: string) => void;
  markAllRead: () => void;
}

export function useMoveNarratorNotifications(): UseMoveNarratorNotificationsReturn {
  const [notifications, setNotifications] = useState<DeliveredNotification[]>(() =>
    listNotifications(),
  );

  const refresh = useCallback((): void => {
    setNotifications(listNotifications());
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent): void => {
      if (e.key === null || e.key === MOVE_NARRATOR_NOTIFICATIONS_KEY) refresh();
    };
    window.addEventListener(MOVE_NARRATOR_NOTIFICATIONS_EVENT, refresh);
    window.addEventListener('storage', onStorage);
    // Re-sync once on mount in case a card landed before this hook mounted.
    refresh();
    return () => {
      window.removeEventListener(MOVE_NARRATOR_NOTIFICATIONS_EVENT, refresh);
      window.removeEventListener('storage', onStorage);
    };
  }, [refresh]);

  const markRead = useCallback((id: string): void => {
    markNotificationRead(id);
    setNotifications(listNotifications());
  }, []);

  const markAllRead = useCallback((): void => {
    markAllNotificationsRead();
    setNotifications(listNotifications());
  }, []);

  return {
    notifications,
    unreadCount: notifications.filter((n) => !n.read).length,
    markRead,
    markAllRead,
  };
}
