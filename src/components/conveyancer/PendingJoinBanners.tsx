// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Finishes a conveyancer's quote-accept activation on the shared dashboard.
 *
 * A winning firm arrives with a join code stashed by /conveyancer/join/:code
 * (when it signed up before its ICP principal existed). This redeems it on the
 * dashboard, which is where every role now lands, and says what happened:
 * a first-run banner on success, an alert on failure. Never silent: the firm
 * has been told by email that it won the work (2026-07-27 defect).
 * Renders nothing for anyone without a pending code or a ?joined= arrival.
 */

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { conveyancerJoinService } from '@/services/conveyancerJoin.service';
import { useAuthStore } from '@/stores/authStore';

interface JoinedFirm {
  firmName?: string;
  clcId?: string;
}
interface JoinFailure {
  reason: string;
  retryable: boolean;
}

export const PendingJoinBanners: React.FC<{ onJoined?: () => void }> = ({ onJoined }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const principalId = useAuthStore((s) => s.principalId);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [joinedFirm, setJoinedFirm] = useState<JoinedFirm | null>(null);
  const [joinFailure, setJoinFailure] = useState<JoinFailure | null>(null);

  // Arrival from JoinConveyancerPage's success screen: show the first-run
  // banner, then strip the params so a refresh doesn't repeat it.
  useEffect(() => {
    if (searchParams.get('joined') === null) return;
    setJoinedFirm({
      firmName: searchParams.get('firm') ?? undefined,
      clcId: searchParams.get('clc') ?? undefined,
    });
    setSearchParams({}, { replace: true });
    // Params only exist on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!principalId || !isAuthenticated) return;
    const pendingCode = conveyancerJoinService.readPendingJoinCode();
    if (!pendingCode) return;
    let cancelled = false;
    void (async () => {
      const redeem = await conveyancerJoinService.redeemJoinCode(pendingCode);
      if (cancelled) return;
      if (redeem.success) {
        conveyancerJoinService.clearPendingJoinCode();
        setJoinedFirm({ firmName: redeem.firmName, clcId: redeem.clcId });
        setJoinFailure(null);
        onJoined?.();
      } else if (
        redeem.error === 'invalid_code' ||
        redeem.error === 'already_redeemed' ||
        redeem.error === 'expired'
      ) {
        // Dead code: stop retrying it on every visit.
        conveyancerJoinService.clearPendingJoinCode();
        setJoinFailure({ reason: redeem.detail ?? redeem.error, retryable: false });
      } else {
        // Transient: keep the code stashed for the next visit, but say so.
        setJoinFailure({ reason: redeem.detail ?? redeem.error ?? 'Activation failed', retryable: true });
      }
    })();
    return () => {
      cancelled = true;
    };
    // onJoined is a refresh callback; re-running redemption on its identity would double-redeem.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [principalId, isAuthenticated]);

  return (
    <>
      {joinFailure && (
        <div
          role="alert"
          className="mb-6 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-4 py-3"
        >
          <p className="text-sm font-medium text-amber-900 dark:text-amber-300">
            We couldn&rsquo;t finish connecting you to the transaction.
          </p>
          <p className="mt-1 text-xs text-amber-800 dark:text-amber-400">{joinFailure.reason}</p>
          <p className="mt-2 text-xs text-amber-800 dark:text-amber-400">
            {joinFailure.retryable
              ? 'We’ll try again next time you open this page. If it keeps happening, email '
              : 'This activation link can no longer be used. Please email '}
            <a className="underline" href="mailto:support@propxchain.com">support@propxchain.com</a>
            {' '}and we&rsquo;ll sort it out.
          </p>
        </div>
      )}
      {joinedFirm && (
        <div className="mb-6 rounded-lg border border-teal-300 dark:border-teal-700 bg-teal-50 dark:bg-teal-900/20 px-4 py-3">
          <p className="text-sm font-medium text-teal-800 dark:text-teal-300">
            You&rsquo;re on the transaction{joinedFirm.firmName ? ` as ${joinedFirm.firmName}` : ''}
            {joinedFirm.clcId ? ` (CLC ${joinedFirm.clcId})` : ''}.
          </p>
          <p className="mt-1 text-xs text-teal-700 dark:text-teal-400">
            Your firm details were pre-filled from the CLC register. Please check them and
            email <a className="underline" href="mailto:support@propxchain.com">support@propxchain.com</a> if
            anything needs correcting.
          </p>
        </div>
      )}
    </>
  );
};

export default PendingJoinBanners;
