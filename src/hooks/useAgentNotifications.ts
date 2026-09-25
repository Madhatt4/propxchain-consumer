/**
 * useAgentNotifications — Supabase Realtime hook for agent activity
 *
 * DROP-IN INSTRUCTIONS:
 * 1. Copy this file to frontend/src/hooks/useAgentNotifications.ts
 * 2. Ensure Supabase tables exist (run migrations 001-006)
 * 3. Import in any component: import { useAgentNotifications } from '@/hooks/useAgentNotifications'
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

// ============================================================
// Types
// ============================================================

export interface AgentNotification {
  id: string;
  notificationId: string;
  read: boolean;
  createdAt: string;
  event: {
    id: string;
    transactionId: string;
    skillId: string | null;
    eventType: string;
    severity: string;
    message: string;
    data: Record<string, unknown> | null;
    channels: string[];
    createdAt: string;
  } | null;
}

export interface ConsentRequest {
  id: string;
  transactionId: string;
  skillId: string;
  consentType: string;
  status: string;
  requestedBy: {
    type: string;
    userId: string;
    botType?: string;
  };
  deepLink: string | null;
  context: Record<string, unknown> | null;
  expiresAt: string;
  createdAt: string;
}

interface UseAgentNotificationsReturn {
  notifications: AgentNotification[];
  pendingConsents: ConsentRequest[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  markAsRead: (notificationRecipientId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  approveConsent: (consentRequestId: string) => Promise<boolean>;
  denyConsent: (consentRequestId: string) => Promise<boolean>;
  refresh: () => Promise<void>;
}

// ============================================================
// Hook
// ============================================================

export function useAgentNotifications(userId: string | null): UseAgentNotificationsReturn {
  const [notifications, setNotifications] = useState<AgentNotification[]>([]);
  const [pendingConsents, setPendingConsents] = useState<ConsentRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch initial notifications
  const fetchNotifications = useCallback(async (): Promise<void> => {
    if (!userId) return;

    try {
      const { data, error: fetchError } = await supabase
        .from('notification_recipients')
        .select(`
          id,
          notification_id,
          read,
          created_at,
          notification_events (
            id,
            transaction_id,
            skill_id,
            event_type,
            severity,
            message,
            data,
            channels,
            created_at
          )
        `)
        .eq('recipient_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (fetchError) {
        setError(fetchError.message);
        return;
      }

      const mapped: AgentNotification[] = (data ?? []).map((row: Record<string, unknown>) => ({
        id: row.id as string,
        notificationId: row.notification_id as string,
        read: row.read as boolean,
        createdAt: row.created_at as string,
        event: row.notification_events as AgentNotification['event'],
      }));

      setNotifications(mapped);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch notifications');
    }
  }, [userId]);

  // Fetch pending consent requests
  const fetchConsents = useCallback(async (): Promise<void> => {
    if (!userId) return;

    try {
      const { data, error: fetchError } = await supabase
        .from('consent_requests')
        .select('*')
        .eq('required_from', userId)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (fetchError) {
        setError(fetchError.message);
        return;
      }

      const mapped: ConsentRequest[] = (data ?? []).map((row: Record<string, unknown>) => ({
        id: row.id as string,
        transactionId: row.transaction_id as string,
        skillId: row.skill_id as string,
        consentType: row.consent_type as string,
        status: row.status as string,
        requestedBy: row.requested_by as ConsentRequest['requestedBy'],
        deepLink: (row.deep_link as string) ?? null,
        context: (row.context as Record<string, unknown>) ?? null,
        expiresAt: row.expires_at as string,
        createdAt: row.created_at as string,
      }));

      setPendingConsents(mapped);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch consents');
    }
  }, [userId]);

  // Combined refresh
  const refresh = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    await Promise.all([fetchNotifications(), fetchConsents()]);
    setIsLoading(false);
  }, [fetchNotifications, fetchConsents]);

  // Initial load + Realtime subscription
  useEffect(() => {
    if (!userId) return;

    void refresh();

    // Subscribe to new notification_recipients rows for this user
    const channel = supabase
      .channel(`agent-notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notification_recipients',
          filter: `recipient_id=eq.${userId}`,
        },
        () => {
          void fetchNotifications();
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'consent_requests',
          filter: `required_from=eq.${userId}`,
        },
        () => {
          void fetchConsents();
        },
      )
      .subscribe();

    return (): void => {
      void supabase.removeChannel(channel);
    };
  }, [userId, refresh, fetchNotifications, fetchConsents]);

  // Mark single notification as read
  const markAsRead = useCallback(async (notificationRecipientId: string): Promise<void> => {
    await supabase
      .from('notification_recipients')
      .update({ read: true })
      .eq('id', notificationRecipientId);

    setNotifications((prev) =>
      prev.map((n) =>
        n.id === notificationRecipientId ? { ...n, read: true } : n,
      ),
    );
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(async (): Promise<void> => {
    if (!userId) return;

    await supabase
      .from('notification_recipients')
      .update({ read: true })
      .eq('recipient_id', userId)
      .eq('read', false);

    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, [userId]);

  // Approve consent
  const approveConsent = useCallback(async (consentRequestId: string): Promise<boolean> => {
    const { error: updateError } = await supabase
      .from('consent_requests')
      .update({
        status: 'approved',
        resolved_at: new Date().toISOString(),
        resolved_by: userId,
      })
      .eq('id', consentRequestId)
      .eq('status', 'pending');

    if (updateError) {
      setError(updateError.message);
      return false;
    }

    setPendingConsents((prev) => prev.filter((c) => c.id !== consentRequestId));
    return true;
  }, [userId]);

  // Deny consent
  const denyConsent = useCallback(async (consentRequestId: string): Promise<boolean> => {
    const { error: updateError } = await supabase
      .from('consent_requests')
      .update({
        status: 'denied',
        resolved_at: new Date().toISOString(),
        resolved_by: userId,
      })
      .eq('id', consentRequestId)
      .eq('status', 'pending');

    if (updateError) {
      setError(updateError.message);
      return false;
    }

    setPendingConsents((prev) => prev.filter((c) => c.id !== consentRequestId));
    return true;
  }, [userId]);

  const unreadCount = notifications.filter((n) => !n.read).length + pendingConsents.length;

  return {
    notifications,
    pendingConsents,
    unreadCount,
    isLoading,
    error,
    markAsRead,
    markAllAsRead,
    approveConsent,
    denyConsent,
    refresh,
  };
}
