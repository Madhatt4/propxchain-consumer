// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { useEffect, useState } from 'react';
import { isNativeApp } from '@/lib/native';
import { canLockDevice, isLockEnabled, setLockEnabled } from '@/lib/biometricLock';

/** Switch for the Face ID lock. Shown only in the native app, on phones that can lock. */
export default function FaceIdToggle(): JSX.Element | null {
  const native = isNativeApp();
  const [available, setAvailable] = useState(false);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (!native) return;
    void (async () => {
      setAvailable(await canLockDevice());
      setEnabled(await isLockEnabled());
    })();
  }, [native]);

  if (!native || !available) return null;

  const toggle = async () => {
    const next = !enabled;
    setEnabled(next);
    try {
      await setLockEnabled(next);
    } catch {
      // Saving failed: show the setting that is actually stored.
      setEnabled(!next);
    }
  };

  return (
    <section className="flex items-center justify-between gap-4 rounded-lg border border-sage-light/40 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <div>
        <p className="font-sans text-sm font-medium text-stone-900 dark:text-gray-100">Face ID lock</p>
        <p className="font-sans text-xs text-stone-600 dark:text-slate-300">
          Ask for Face ID, fingerprint or passcode each time you open the app.
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label="Face ID lock"
        onClick={() => void toggle()}
        className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${enabled ? 'bg-teal-700' : 'bg-stone-300 dark:bg-slate-600'}`}
      >
        <span
          className={`absolute top-1 h-6 w-6 rounded-full bg-white transition-all ${enabled ? 'left-7' : 'left-1'}`}
        />
      </button>
    </section>
  );
}
