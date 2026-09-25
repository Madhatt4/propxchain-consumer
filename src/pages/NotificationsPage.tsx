// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { icpService } from '../services/icp.service';
import DashboardHeader from '../components/navigation/DashboardHeader';
import { logger } from '@/utils/logger';
import { useAuthStore } from '../stores/authStore';
import { useMoveNarratorNotifications } from '../hooks/useMoveNarratorNotifications';
import { useSubscription } from '../hooks/useSubscription';
import type { DeliveredNotification } from '../services/moveNarratorNotifications';

interface CanisterNotification {
  id: number;
  transactionId: string;
  recipient: string;
  message: string;
  docType: string;
  documentHash: string;
  uploadedBy: string;
  createdAt: bigint;
  read: boolean;
}

/** Normalised row covering both notification sources. */
interface FeedItem {
  key: string;
  source: 'canister' | 'narrator';
  transactionId: string;
  title: string;
  /** Secondary line — Narrator body, or the canister doc type. */
  detail: string;
  createdAtMs: number;
  read: boolean;
  /** Narrator only — drives the accent colour. */
  urgency?: string;
  onMarkRead: () => void;
}

function formatTimeAgo(timeMs: number): string {
  const diff = Date.now() - timeMs;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  if (days < 7) return `${days} day${days !== 1 ? 's' : ''} ago`;
  return new Date(timeMs).toLocaleDateString();
}

/** sage-dark accent for blocking/soon, mirroring NextStepCard's urgency colours. */
function isUrgent(urgency?: string): boolean {
  return urgency === 'blocking' || urgency === 'soon';
}

const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const [canisterNotifs, setCanisterNotifs] = useState<CanisterNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<unknown>(null);

  const { isPremium } = useSubscription();
  const {
    notifications: narratorNotifsRaw,
    markRead: markNarratorRead,
    markAllRead: markAllNarratorRead,
  } = useMoveNarratorNotifications();
  // AI cards are a premium feature — hide them on the starter tier.
  const narratorNotifs = isPremium ? narratorNotifsRaw : [];

  useEffect(() => {
    const loadData = async (): Promise<void> => {
      const authState = useAuthStore.getState();
      const principalId = authState.principalId;
      if (!principalId || !authState.isAuthenticated) {
        navigate('/login');
        return;
      }

      try {
        await icpService.initialize();
        const profile = await icpService.getMyProfile();
        setUser(profile);
        const notifs = await icpService.getMyNotifications();
        setCanisterNotifs(notifs);
      } catch (error) {
        logger.error('Error loading notifications:', error);
      } finally {
        setIsLoading(false);
      }
    };
    void loadData();
  }, [navigate]);

  const markCanisterRead = async (notificationId: number): Promise<void> => {
    try {
      await icpService.markNotificationRead(notificationId);
      setCanisterNotifs((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n)),
      );
    } catch (error) {
      logger.error('Error marking notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async (): Promise<void> => {
    try {
      await icpService.markAllNotificationsRead();
      setCanisterNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (error) {
      logger.error('Error marking all as read:', error);
    }
    markAllNarratorRead();
  };

  const feed: FeedItem[] = useMemo(() => {
    const fromCanister: FeedItem[] = canisterNotifs.map((n) => ({
      key: `c-${n.id}`,
      source: 'canister',
      transactionId: n.transactionId,
      title: n.message,
      detail: n.docType,
      createdAtMs: Number(n.createdAt) / 1_000_000,
      read: n.read,
      onMarkRead: () => void markCanisterRead(n.id),
    }));

    const fromNarrator: FeedItem[] = narratorNotifs.map((n: DeliveredNotification) => ({
      key: `n-${n.id}`,
      source: 'narrator',
      transactionId: n.txId,
      title: n.title,
      detail: n.body,
      createdAtMs: n.createdAt,
      read: n.read,
      urgency: n.urgency,
      onMarkRead: () => markNarratorRead(n.id),
    }));

    return [...fromCanister, ...fromNarrator].sort((a, b) => b.createdAtMs - a.createdAtMs);
    // markCanisterRead is stable enough for this view; deps kept to the data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canisterNotifs, narratorNotifs]);

  const handleItemClick = (item: FeedItem): void => {
    item.onMarkRead();
    navigate(`/transaction/${item.transactionId}`);
  };

  const unreadCount = feed.filter((n) => !n.read).length;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <DashboardHeader user={user} title="Notifications" showBackButton backRoute="/dashboard" />

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">All Notifications</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {unreadCount > 0
                ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`
                : 'No unread notifications'}
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
            >
              Mark all as read
            </button>
          )}
        </div>

        <div className="bg-white border border-gray-200 dark:bg-gray-800 dark:border-gray-700 rounded-lg overflow-hidden">
          {feed.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <svg
                className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
              <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">No notifications yet</h3>
              <p className="text-gray-500 dark:text-gray-400">
                You'll get updates here when documents are uploaded and when your move progresses.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {feed.map((item) => (
                <div
                  key={item.key}
                  onClick={() => handleItemClick(item)}
                  data-source={item.source}
                  className={`px-6 py-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors ${
                    !item.read ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                        item.source === 'narrator' && isUrgent(item.urgency)
                          ? 'bg-sage-dark/30 text-[#5F8A68] dark:text-emerald-300'
                          : !item.read
                            ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900 dark:text-emerald-400'
                            : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                      }`}
                    >
                      {item.source === 'narrator' ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!item.read ? 'font-medium text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                        {item.title}
                      </p>
                      {item.source === 'narrator' && item.detail && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{item.detail}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-gray-500 dark:text-gray-400">{formatTimeAgo(item.createdAtMs)}</span>
                        <span className="text-xs text-gray-300 dark:text-gray-600">|</span>
                        <span className="text-xs text-emerald-600 dark:text-emerald-500">
                          {item.source === 'narrator' ? 'Move update' : item.detail}
                        </span>
                      </div>
                    </div>

                    {!item.read && (
                      <div className="flex-shrink-0 w-2.5 h-2.5 bg-emerald-500 rounded-full"></div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationsPage;
