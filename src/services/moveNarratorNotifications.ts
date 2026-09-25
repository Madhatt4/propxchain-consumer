/**
 * Move Narrator — client-side store for delivered in-app notifications.
 *
 * The `deliver` action returns the in-app card to the client rather than
 * persisting it (email/SMS are the only server-sent channels). The live
 * notifications feed (bell + /notifications) is canister-backed and has no
 * client write path, so delivered Narrator cards live here, in localStorage,
 * and are merged into that feed for display.
 *
 * No PII is fabricated and nothing is sent anywhere — this is purely the local
 * record of a card the server already produced and handed back.
 */

export const MOVE_NARRATOR_NOTIFICATIONS_KEY = 'moveNarrator:notifications';

/** Custom DOM event so an append in this tab refreshes mounted hooks live. */
export const MOVE_NARRATOR_NOTIFICATIONS_EVENT = 'moveNarrator:notifications-changed';

/** Cap the stored list so the feed can't grow unbounded. */
const MAX_NOTIFICATIONS = 50;

export interface DeliveredNotificationInput {
  txId: string;
  title: string;
  body: string;
  txUrl: string;
  /** 'blocking' | 'soon' | 'later' — drives urgency styling in the feed. */
  urgency: string;
}

export interface DeliveredNotification extends DeliveredNotificationInput {
  id: string;
  /** Epoch milliseconds the card was recorded. */
  createdAt: number;
  read: boolean;
}

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

function readAll(): DeliveredNotification[] {
  const raw = storage()?.getItem(MOVE_NARRATOR_NOTIFICATIONS_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DeliveredNotification[]) : [];
  } catch {
    // Corrupt payload — treat as empty rather than crashing the feed.
    return [];
  }
}

function writeAll(items: DeliveredNotification[]): void {
  const store = storage();
  if (!store) return;
  store.setItem(MOVE_NARRATOR_NOTIFICATIONS_KEY, JSON.stringify(items.slice(0, MAX_NOTIFICATIONS)));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(MOVE_NARRATOR_NOTIFICATIONS_EVENT));
  }
}

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `mn_${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
}

/** All delivered Narrator notifications, newest first. */
export function listNotifications(): DeliveredNotification[] {
  return readAll().sort((a, b) => b.createdAt - a.createdAt);
}

/** Number of unread Narrator notifications. */
export function unreadCount(): number {
  return readAll().filter((n) => !n.read).length;
}

/** Record a delivered card and return the stored notification. */
export function appendNotification(input: DeliveredNotificationInput): DeliveredNotification {
  const notification: DeliveredNotification = {
    ...input,
    id: newId(),
    createdAt: Date.now(),
    read: false,
  };
  writeAll([notification, ...readAll()]);
  return notification;
}

/** Mark one Narrator notification read. */
export function markNotificationRead(id: string): void {
  writeAll(readAll().map((n) => (n.id === id ? { ...n, read: true } : n)));
}

/** Mark every Narrator notification read. */
export function markAllNotificationsRead(): void {
  writeAll(readAll().map((n) => ({ ...n, read: true })));
}
