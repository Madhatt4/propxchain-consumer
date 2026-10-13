// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { isNativeApp } from '@/lib/native';
import { getPushPermission, requestPushPermission, type PushPermission } from '@/lib/pushNotifications';
import { registerDevicePushToken } from '@/services/devicePushToken.service';
import { sendTestPush, type ChannelResult } from '@/services/moveNarrator.service';

/**
 * Settings card that sends the standard notification to the person's own
 * phones, so they can check notifications reach them without waiting for a
 * real update on a move. Works from the website too: it reaches every phone
 * the person has turned notifications on for.
 */

function describeResult(result: ChannelResult): string {
  if (result.status === 'sent') return 'Sent. It should arrive on your phone in a few seconds.';
  const detail = result.detail ?? '';
  if (detail.includes('no registered phones') || detail.includes('no longer valid')) {
    return 'No phone is signed up for notifications yet. Open the PropXchain app on your phone and turn them on.';
  }
  if (detail.includes('not configured')) {
    return 'Notifications are not switched on at our end yet.';
  }
  return `It did not send (${detail || result.status}).`;
}

export default function TestPushCard(): JSX.Element {
  const native = isNativeApp();
  const [permission, setPermission] = useState<PushPermission | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!native) return;
    void getPushPermission().then(setPermission);
  }, [native]);

  const turnOn = async () => {
    setBusy(true);
    try {
      const result = await requestPushPermission();
      setPermission(result);
      if (result === 'granted') await registerDevicePushToken();
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async () => {
    setBusy(true);
    setMessage(null);
    try {
      // Refresh this phone's address first, so a stale one can't fail the test.
      if (native) await registerDevicePushToken();
      setMessage(describeResult(await sendTestPush()));
    } catch (err) {
      setMessage(`It did not send (${err instanceof Error ? err.message : String(err)}).`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" aria-hidden="true" />
          Notifications
        </CardTitle>
        <CardDescription>
          Check that move updates reach your phone. The test says only that there is an update, with no
          address or details.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {native && permission === 'denied' ? (
          <p className="text-sm text-muted-foreground">
            Notifications are off for PropXchain. Turn them on in your phone&apos;s Settings, under
            PropXchain, then Notifications.
          </p>
        ) : native && permission === 'prompt' ? (
          <Button onClick={() => void turnOn()} disabled={busy} className="min-h-11">
            Turn on notifications
          </Button>
        ) : (
          <Button onClick={() => void sendTest()} disabled={busy} className="min-h-11">
            {busy ? 'Sending…' : 'Send me a test notification'}
          </Button>
        )}
        {message && (
          <p role="status" className="text-sm">
            {message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
