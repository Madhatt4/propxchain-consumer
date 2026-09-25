// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect, beforeEach } from 'vitest';
import {
  PENDING_INVITE_URL_KEY,
  storePendingInviteUrl,
  consumePendingInviteUrl,
} from '../pendingInviteUrl';

beforeEach(() => {
  localStorage.clear();
});

describe('pendingInviteUrl', () => {
  it('should store and consume a full invite URL with its query string', () => {
    storePendingInviteUrl('/join/TX-1234-ABCD?role=seller&side=seller&by=aaa');
    expect(consumePendingInviteUrl()).toBe(
      '/join/TX-1234-ABCD?role=seller&side=seller&by=aaa'
    );
  });

  it('should clear the stored URL after consuming it once', () => {
    storePendingInviteUrl('/join/TX-1234-ABCD?role=seller');
    consumePendingInviteUrl();
    expect(consumePendingInviteUrl()).toBeNull();
    expect(localStorage.getItem(PENDING_INVITE_URL_KEY)).toBeNull();
  });

  it('should return null when nothing has been stored', () => {
    expect(consumePendingInviteUrl()).toBeNull();
  });

  it('should refuse to store an absolute URL (open-redirect guard)', () => {
    storePendingInviteUrl('https://evil.example/x');
    expect(consumePendingInviteUrl()).toBeNull();
  });

  it('should refuse to store a path outside /join (open-redirect guard)', () => {
    storePendingInviteUrl('/dashboard');
    expect(consumePendingInviteUrl()).toBeNull();
  });
});
