// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { useCallback, useEffect, useRef, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Lock } from 'lucide-react';
import { isNativeApp } from '@/lib/native';
import { canLockDevice, isLockEnabled, promptUnlock } from '@/lib/biometricLock';
import { useAuthStore } from '@/stores/authStore';

/** How long the app can sit in the background before it asks again. */
export const RELOCK_AFTER_MS = 60_000;

type Phase = 'checking' | 'locked' | 'open';

/**
 * Full-screen cover shown in the native app until the phone confirms the
 * owner with Face ID, fingerprint or the device passcode. It is an overlay,
 * so it needs no wrapping around the routes. It appears at once on a cold
 * start and again after the app has been in the background for a minute.
 * A phone with no lock set up, or a person who has switched the lock off,
 * goes straight in.
 */
export default function BiometricGate(): JSX.Element | null {
  const native = isNativeApp();
  const [phase, setPhase] = useState<Phase>(native ? 'checking' : 'open');
  const [failed, setFailed] = useState(false);
  const backgroundedAt = useRef<number | null>(null);
  const prompting = useRef(false);

  const attempt = useCallback(async () => {
    if (prompting.current) return;
    prompting.current = true;
    setFailed(false);
    try {
      const result = await promptUnlock();
      if (result === 'unlocked') setPhase('open');
      else setFailed(true);
    } finally {
      prompting.current = false;
    }
  }, []);

  const evaluate = useCallback(async () => {
    const [available, enabled] = await Promise.all([canLockDevice(), isLockEnabled()]);
    if (!available || !enabled) {
      setPhase('open');
      return;
    }
    setPhase('locked');
    void attempt();
  }, [attempt]);

  useEffect(() => {
    if (!native) return;
    void evaluate();
  }, [native, evaluate]);

  useEffect(() => {
    if (!native) return;
    const handle = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) {
        backgroundedAt.current = Date.now();
        return;
      }
      const since = backgroundedAt.current;
      backgroundedAt.current = null;
      if (since !== null && Date.now() - since >= RELOCK_AFTER_MS) {
        void evaluate();
      }
    });
    return () => {
      void handle.then((h) => h.remove());
    };
  }, [native, evaluate]);

  if (!native || phase === 'open') return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="PropXchain is locked"
      data-testid="biometric-gate"
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-4 bg-stone-50 px-6 text-center dark:bg-slate-900"
    >
      <Lock className="h-10 w-10 text-teal-700" aria-hidden="true" />
      <h1 className="font-display text-2xl text-stone-900 dark:text-gray-100">PropXchain is locked</h1>
      <p className="max-w-xs font-sans text-sm text-stone-600 dark:text-slate-300">
        Use Face ID, your fingerprint or your phone passcode to open it.
      </p>
      {failed && (
        <p role="alert" className="font-sans text-sm text-rose-800 dark:text-rose-300">
          That did not unlock it. Try again.
        </p>
      )}
      <button
        type="button"
        onClick={() => void attempt()}
        className="min-h-11 rounded-lg bg-teal-700 px-6 font-sans text-sm font-medium text-white"
      >
        Unlock
      </button>
      <button
        type="button"
        onClick={() => void useAuthStore.getState().logout().then(() => setPhase('open'))}
        className="min-h-11 px-4 font-sans text-sm text-stone-600 underline dark:text-slate-300"
      >
        Sign out instead
      </button>
    </div>
  );
}
