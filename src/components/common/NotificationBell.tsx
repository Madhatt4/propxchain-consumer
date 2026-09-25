// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { icpService } from '../../services/icp.service';
import { useNavigate } from 'react-router-dom';
import { logger } from '@/utils/logger';
import { useMoveNarratorNotifications } from '../../hooks/useMoveNarratorNotifications';
import { useSubscription } from '../../hooks/useSubscription';

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

interface BellItem {
  key: string;
  source: 'canister' | 'narrator';
  transactionId: string;
  message: string;
  createdAtMs: number;
  read: boolean;
  onMarkRead: () => void;
}

interface NotificationBellProps {
  className?: string;
}

function formatTimeAgo(timeMs: number): string {
  const diff = Date.now() - timeMs;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timeMs).toLocaleDateString();
}

const NotificationBell: React.FC<NotificationBellProps> = ({ className = '' }) => {
  const [canisterNotifs, setCanisterNotifs] = useState<CanisterNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const { isPremium } = useSubscription();
  const {
    notifications: narratorNotifsRaw,
    markRead: markNarratorRead,
    markAllRead: markAllNarratorRead,
  } = useMoveNarratorNotifications();
  // AI cards are a premium feature — hide them from the feed on the starter
  // tier so the tier toggle shows a real difference everywhere, not just in
  // the transaction view.
  const narratorNotifs = isPremium ? narratorNotifsRaw : [];

  const fetchNotifications = async (): Promise<void> => {
    try {
      const notifs = await icpService.getMyNotifications();
      setCanisterNotifs(notifs);
    } catch (error) {
      logger.error('Error fetching notifications:', error);
    }
  };

  useEffect(() => {
    void fetchNotifications();
    const interval = setInterval(() => void fetchNotifications(), 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
    setIsLoading(true);
    try {
      await icpService.markAllNotificationsRead();
      setCanisterNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (error) {
      logger.error('Error marking all notifications as read:', error);
    } finally {
      setIsLoading(false);
    }
    markAllNarratorRead();
  };

  const items: BellItem[] = useMemo(() => {
    const fromCanister: BellItem[] = canisterNotifs.map((n) => ({
      key: `c-${n.id}`,
      source: 'canister',
      transactionId: n.transactionId,
      message: n.message,
      createdAtMs: Number(n.createdAt) / 1_000_000,
      read: n.read,
      onMarkRead: () => void markCanisterRead(n.id),
    }));
    const fromNarrator: BellItem[] = narratorNotifs.map((n) => ({
      key: `n-${n.id}`,
      source: 'narrator',
      transactionId: n.txId,
      message: n.title,
      createdAtMs: n.createdAt,
      read: n.read,
      onMarkRead: () => markNarratorRead(n.id),
    }));
    return [...fromCanister, ...fromNarrator].sort((a, b) => b.createdAtMs - a.createdAtMs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canisterNotifs, narratorNotifs]);

  const unreadCount = items.filter((n) => !n.read).length;

  const handleItemClick = (item: BellItem): void => {
    item.onMarkRead();
    setIsOpen(false);
    navigate(`/transaction/${item.transactionId}`);
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Icon-only control in the SHARED dashboard header, so it appears on
          every dashboard page. Measured at 40px in production 2026-07-31. No
          inline exception applies to an icon button — it takes the full 44px
          (WCAG 2.5.5). */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative inline-flex min-h-11 min-w-11 items-center justify-center p-2 text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
        aria-label="Notifications"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                disabled={isLoading}
                className="text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 disabled:opacity-50"
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                <svg className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                  />
                </svg>
                <p className="text-sm">No notifications yet</p>
              </div>
            ) : (
              items.map((item) => (
                <div
                  key={item.key}
                  onClick={() => handleItemClick(item)}
                  data-source={item.source}
                  className={`px-4 py-3 border-b border-gray-100 dark:border-gray-700 last:border-b-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                    !item.read ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                        !item.read
                          ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900 dark:text-emerald-400'
                          : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                      }`}
                    >
                      {item.source === 'narrator' ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!item.read ? 'font-medium text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300'}`}>
                        {item.message}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {formatTimeAgo(item.createdAtMs)}
                      </p>
                    </div>

                    {!item.read && (
                      <div className="flex-shrink-0 w-2 h-2 bg-emerald-500 rounded-full mt-2"></div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {items.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => {
                  setIsOpen(false);
                  navigate('/notifications');
                }}
                className="w-full text-center text-sm text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
              >
                View all notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
