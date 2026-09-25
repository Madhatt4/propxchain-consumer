// PropXchain - Open Source Blockchain Property Conveyancing Platform
// Copyright (C) 2025 PropXchain Contributors
// SPDX-License-Identifier: Proprietary

import { Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { SubscriptionTier } from '@/constants/subscriptionFeatures';

interface UpgradeTeaserProps {
  /** What the locked tab unlocks, one line. */
  blurb: string;
  /** Tier required to unlock. */
  requiredTier: SubscriptionTier;
  /** Optional preview rendered behind a soft veil to show what they'd get. */
  preview?: React.ReactNode;
}

const TIER_LABEL: Record<SubscriptionTier, string> = {
  starter: 'Starter',
  premium: 'Premium',
};

/** Shown in place of a tab the user's tier doesn't unlock. */
export function UpgradeTeaser({ blurb, requiredTier, preview }: UpgradeTeaserProps): JSX.Element {
  const navigate = useNavigate();
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-muted/30 p-6">
      {preview && (
        <div className="pointer-events-none absolute inset-0 opacity-25 blur-[2px]" aria-hidden>
          {preview}
        </div>
      )}
      <div className="relative z-10 flex flex-col items-center gap-3 py-8 text-center">
        <div className="grid h-11 w-11 place-items-center rounded-full bg-primary/15 text-primary">
          <Lock className="h-5 w-5" />
        </div>
        <p className="max-w-md text-sm text-muted-foreground">{blurb}</p>
        <button
          type="button"
          onClick={() => navigate('/pricing')}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
        >
          Unlock with {TIER_LABEL[requiredTier]}
        </button>
      </div>
    </div>
  );
}
