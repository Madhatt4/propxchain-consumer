// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Enquiries on the conveyancer dashboard. Conveyancers work from this page,
 * not the transaction workspace, so the workspace's Enquiries section is
 * rendered here for the selected matter — taken from the same tab registry
 * and gated by the same unlock rule, so the two surfaces cannot drift.
 */
import { Link } from 'react-router-dom';
import { useIsTierAtLeast } from '@/hooks/useSubscription';
import { TRANSACTION_TABS, isTabUnlocked } from '@/components/transaction/tabs/transactionTabs.config';

interface Props {
  transactionId: string;
}

const ENQUIRIES_TAB = TRANSACTION_TABS.find((t) => t.id === 'enquiries');

export function ConveyancerEnquiriesSection({ transactionId }: Props): JSX.Element | null {
  const isPremium = useIsTierAtLeast('premium');
  if (!ENQUIRIES_TAB?.Component) return null;
  const Section = ENQUIRIES_TAB.Component;
  return (
    <section
      className="rounded-md border border-[#E5E7EB] bg-white p-6 dark:border-stone-700 dark:bg-stone-800"
      data-testid="conveyancer-enquiries"
    >
      <div className="mb-4 flex items-end justify-between gap-4">
        <h2 className="font-[Fraunces] text-lg font-semibold text-[#1A1A1A] dark:text-stone-100">{ENQUIRIES_TAB.label}</h2>
        <Link
          to={`/transaction/${encodeURIComponent(transactionId)}/flow?tab=${ENQUIRIES_TAB.id}`}
          className="font-[DM_Sans] text-sm text-[#0D9488] underline-offset-2 hover:underline"
        >
          Open in the transaction workspace
        </Link>
      </div>
      <Section
        transactionId={transactionId}
        locked={!isTabUnlocked(ENQUIRIES_TAB.minTier, isPremium)}
        requiredTier={ENQUIRIES_TAB.minTier}
      />
    </section>
  );
}
