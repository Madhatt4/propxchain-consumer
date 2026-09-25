// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * "From the buyer" on the conveyancer dashboard (Buyer Pack spec, decision 6):
 * the same Buyer Pack section the workspace shows, read-only for a
 * conveyancer, beside "From the seller". Documents switched on for this
 * conveyancer are already in "Shared with you" above.
 */
import { Link } from 'react-router-dom';
import { useIsTierAtLeast } from '@/hooks/useSubscription';
import { TRANSACTION_TABS, isTabUnlocked } from '@/components/transaction/tabs/transactionTabs.config';

interface Props {
  transactionId: string;
}

const BUYER_PACK_TAB = TRANSACTION_TABS.find((t) => t.id === 'buyer-pack');

export function ConveyancerBuyerPackSection({ transactionId }: Props): JSX.Element | null {
  const isPremium = useIsTierAtLeast('premium');
  if (!BUYER_PACK_TAB?.Component) return null;
  const Section = BUYER_PACK_TAB.Component;
  return (
    <section
      className="rounded-md border border-[#E5E7EB] bg-white p-6 dark:border-stone-700 dark:bg-stone-800"
      data-testid="conveyancer-buyer-pack"
    >
      <div className="mb-4 flex items-end justify-between gap-4">
        <h2 className="font-[Fraunces] text-lg font-semibold text-[#1A1A1A] dark:text-stone-100">From the buyer</h2>
        <Link
          to={`/transaction/${encodeURIComponent(transactionId)}/flow?tab=${BUYER_PACK_TAB.id}`}
          className="font-[DM_Sans] text-sm text-[#0D9488] underline-offset-2 hover:underline"
        >
          Open in the transaction workspace
        </Link>
      </div>
      <Section
        transactionId={transactionId}
        locked={!isTabUnlocked(BUYER_PACK_TAB.minTier, isPremium)}
        requiredTier={BUYER_PACK_TAB.minTier}
      />
    </section>
  );
}
