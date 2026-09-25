import { describe, it, expect, beforeEach } from 'vitest';

import {
  appendNotification,
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  unreadCount,
  MOVE_NARRATOR_NOTIFICATIONS_KEY,
  type DeliveredNotificationInput,
} from '../moveNarratorNotifications';

const CARD: DeliveredNotificationInput = {
  txId: 'tx_test',
  title: 'Your title is on its way',
  body: 'We requested the official title from HM Land Registry.',
  txUrl: 'https://app.example/transaction/tx_test',
  urgency: 'soon',
};

describe('moveNarratorNotifications store', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('should start empty', () => {
    expect(listNotifications()).toEqual([]);
    expect(unreadCount()).toBe(0);
  });

  it('should append a delivered card as unread with an id and timestamp', () => {
    const saved = appendNotification(CARD);

    const all = listNotifications();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(saved.id);
    expect(all[0].read).toBe(false);
    expect(all[0].title).toBe(CARD.title);
    expect(typeof all[0].createdAt).toBe('number');
    expect(unreadCount()).toBe(1);
  });

  it('should list newest first', () => {
    const first = appendNotification({ ...CARD, title: 'First' });
    const second = appendNotification({ ...CARD, title: 'Second' });

    const all = listNotifications();
    expect(all[0].id).toBe(second.id);
    expect(all[1].id).toBe(first.id);
  });

  it('should mark a single notification read', () => {
    const saved = appendNotification(CARD);

    markNotificationRead(saved.id);

    expect(listNotifications()[0].read).toBe(true);
    expect(unreadCount()).toBe(0);
  });

  it('should mark all notifications read', () => {
    appendNotification({ ...CARD, title: 'A' });
    appendNotification({ ...CARD, title: 'B' });

    markAllNotificationsRead();

    expect(unreadCount()).toBe(0);
    expect(listNotifications().every((n) => n.read)).toBe(true);
  });

  it('should tolerate corrupt storage by returning an empty list', () => {
    window.localStorage.setItem(MOVE_NARRATOR_NOTIFICATIONS_KEY, 'not json');

    expect(listNotifications()).toEqual([]);
  });
});
