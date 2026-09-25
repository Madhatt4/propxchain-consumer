// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * WalletMigrationBanner — one-time, explicit-consent move of legacy
 * device-local wallet files into the user's account storage (wallet spec
 * 2026-08-18, decision 9: never silent). Rendered only while legacy files
 * exist on this device; "Not now" hides it for the session.
 */
import { useEffect, useState } from 'react';
import { vaultMigrationService, type MigrationResult } from '@/services/vaultMigration.service';
import type { VaultDocument } from '@/types/vault.types';

interface WalletMigrationBannerProps {
  principal: string;
  onMigrated: (docs: VaultDocument[]) => void;
}

const dismissKey = (principal: string): string => `wallet:migrationDismissed:${principal}`;

export function WalletMigrationBanner({
  principal,
  onMigrated,
}: WalletMigrationBannerProps): JSX.Element | null {
  const [count, setCount] = useState(0);
  const [isBusy, setIsBusy] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [result, setResult] = useState<MigrationResult | null>(null);

  useEffect(() => {
    if (!principal) return;
    setIsDismissed(sessionStorage.getItem(dismissKey(principal)) === '1');
    void vaultMigrationService
      .listLegacy(principal)
      .then((legacy) => setCount(legacy.length))
      .catch(() => setCount(0));
  }, [principal]);

  if (count === 0 || isDismissed) return null;

  const move = async (): Promise<void> => {
    setIsBusy(true);
    const moved: VaultDocument[] = [];
    const r = await vaultMigrationService.migrateAll(principal, (d) => moved.push(d));
    onMigrated(moved);
    setResult(r);
    setIsBusy(false);
  };

  const dismiss = (): void => {
    sessionStorage.setItem(dismissKey(principal), '1');
    setIsDismissed(true);
  };

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-700 dark:bg-amber-950/30">
      {result ? (
        <p className="text-foreground">
          Moved {result.moved} · {result.failed} could not be moved
          {result.failed > 0 ? ' — they stay on this device; try again later.' : '.'}
        </p>
      ) : (
        <>
          <p className="font-medium text-foreground">
            {count} {count === 1 ? 'file is' : 'files are'} still stored only on this device.
          </p>
          <p className="mt-1 text-muted-foreground">
            Your PropXchain Wallet now lives in your account, so it follows you to any device.
            Moving copies each file into your private storage (only you can open it) and removes
            it from this browser. Only a hash was ever written to the blockchain — that doesn&apos;t
            change.
          </p>
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              onClick={() => void move()}
              disabled={isBusy}
              className="rounded bg-teal-600 px-3 py-1.5 text-white hover:bg-teal-700 disabled:opacity-50"
            >
              {isBusy ? 'Moving…' : 'Move to my account'}
            </button>
            <button
              type="button"
              onClick={dismiss}
              disabled={isBusy}
              className="text-muted-foreground hover:text-foreground"
            >
              Not now
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default WalletMigrationBanner;
