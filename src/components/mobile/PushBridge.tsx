// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { isNativeApp } from '@/lib/native';
import { getPushPermission, onPushTapped, onPushTokenRefreshed } from '@/lib/pushNotifications';
import { pushTapDestination } from '@/lib/pushTapDestination';
import { registerDevicePushToken } from '@/services/devicePushToken.service';
import { useAuthStore } from '@/stores/authStore';

/**
 * Invisible. In the native app it (1) keeps this phone's push address current
 * for the signed-in person, once they have allowed notifications, and
 * (2) opens the right transaction when a notification is tapped.
 */
export default function PushBridge(): null {
  const native = isNativeApp();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (!native || !isAuthenticated) return;
    let cancelled = false;
    void getPushPermission().then((p) => {
      if (!cancelled && p === 'granted') void registerDevicePushToken();
    });
    const stopRefresh = onPushTokenRefreshed((token) => {
      void registerDevicePushToken(token);
    });
    return () => {
      cancelled = true;
      stopRefresh();
    };
  }, [native, isAuthenticated]);

  useEffect(() => {
    if (!native) return;
    return onPushTapped((data) => {
      const to = pushTapDestination(data);
      if (to) navigate(to);
    });
  }, [native, navigate]);

  return null;
}
