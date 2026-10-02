// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { isNativeApp } from '@/lib/native';
import { getPushPermission, requestPushPermission } from '@/lib/pushNotifications';
import { registerDevicePushToken } from '@/services/devicePushToken.service';

/**
 * Card on the phone home screen offering notifications. The system permission
 * dialog only appears after the person taps the button, so they know why it is
 * asking. Hidden once they have answered either way.
 */
export default function PushPrompt(): JSX.Element | null {
  const native = isNativeApp();
  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!native) return;
    void getPushPermission().then((p) => setShown(p === 'prompt'));
  }, [native]);

  if (!native || !shown) return null;

  const turnOn = async () => {
    setBusy(true);
    try {
      const result = await requestPushPermission();
      if (result === 'granted') await registerDevicePushToken();
      setShown(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="flex items-start gap-3 rounded-lg border border-sage-light/40 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <Bell className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" aria-hidden="true" />
      <div className="flex-1">
        <p className="font-sans text-sm font-medium text-stone-900 dark:text-gray-100">
          Get a nudge when something needs you
        </p>
        <p className="mt-1 font-sans text-xs text-stone-600 dark:text-slate-300">
          We send a short notification when there is an update on your move. It never includes your
          address or any details.
        </p>
        <button
          type="button"
          onClick={() => void turnOn()}
          disabled={busy}
          className="mt-3 min-h-11 rounded-lg bg-teal-700 px-4 font-sans text-sm font-medium text-white disabled:opacity-50"
        >
          Turn on notifications
        </button>
      </div>
    </section>
  );
}
