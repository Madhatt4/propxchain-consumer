// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Copy shared by every surface that hands out the deal's invite code
 * (lib/buyerInvite): who the code is for, where everyone else is invited
 * from, and the one line shown instead of the code when it can't be shared.
 */
import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import type { BuyerInviteView } from '@/hooks/useBuyerInviteState';

const LINE = 'text-sm text-[var(--text-muted)]';

export function BuyerOnlyNote({ transactionId }: { transactionId: string }): ReactElement {
  return (
    <p data-testid="buyer-only-note" className={LINE}>
      This code is for your buyer only. Whoever uses it joins the deal as the buyer, and then it is used up.
      {' '}To add your estate agent, use &ldquo;Add your estate agent&rdquo; on the{' '}
      <Link to={`/transaction/${encodeURIComponent(transactionId)}/flow`} className="underline">deal page</Link>.
      {' '}Conveyancers join when you accept their estimate.
    </p>
  );
}

const UNSHAREABLE_TEXT: Readonly<Record<Exclude<BuyerInviteView, 'share'>, string>> = {
  loading: 'Checking this deal…',
  buyerJoined: 'Your buyer has already joined this deal, so the invite code has been used.',
  notSellerSide: 'The invite code is for the seller side to give to their buyer.',
  unavailable: 'We couldn’t check this deal just now. Refresh the page to try again.',
};

/** The line shown in place of the code. */
export function BuyerInviteUnavailable({ state }: { state: Exclude<BuyerInviteView, 'share'> }): ReactElement {
  return (
    <p data-testid="buyer-invite-unavailable" role={state === 'unavailable' ? 'alert' : undefined} className={LINE}>
      {UNSHAREABLE_TEXT[state]}
    </p>
  );
}
