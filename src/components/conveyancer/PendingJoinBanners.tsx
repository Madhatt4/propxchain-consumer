// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Finishes a conveyancer's estimate-accept activation on the shared dashboard
 * and the conveyancer workspace.
 *
 * A winning firm arrives with a join code saved by /pro/conveyancer/join/:code
 * (when it signed up before its ICP principal existed). This asks before
 * redeeming it: "Join <firm> on <property>?" with an explicit button, never
 * on its own (card 5de4b8d4), because the saved code would otherwise bind
 * itself to whichever account next signed in on that browser. Then it says
 * what happened: a first-run banner on success, an alert on failure. Never
 * silent: the firm has been told by email that it won the work (2026-07-27
 * defect). Renders nothing for anyone without a saved code or a ?joined= arrival.
 */

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { conveyancerJoinService, joinOfferText, type JoinPreview } from '@/services/conveyancerJoin.service';
import { useAuthStore } from '@/stores/authStore';

interface JoinedFirm {
  firmName?: string;
  clcId?: string;
}
interface JoinFailure {
  reason: string;
  retryable: boolean;
}
interface PendingOffer {
  code: string;
  preview: JoinPreview;
}

const DEAD_CODE_ERRORS = new Set(['invalid_code', 'already_redeemed', 'expired']);

export const PendingJoinBanners: React.FC<{ onJoined?: () => void }> = ({ onJoined }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const principalId = useAuthStore((s) => s.principalId);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [joinedFirm, setJoinedFirm] = useState<JoinedFirm | null>(null);
  const [joinFailure, setJoinFailure] = useState<JoinFailure | null>(null);
  const [offer, setOffer] = useState<PendingOffer | null>(null);
  const [isJoining, setIsJoining] = useState(false);

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

  // A saved code is only previewed here; joining waits for the click.
  useEffect(() => {
    if (!principalId || !isAuthenticated) return;
    const pendingCode = conveyancerJoinService.readPendingJoinCode();
    if (!pendingCode) return;
    let cancelled = false;
    void (async () => {
      const result = await conveyancerJoinService.previewJoinCode(pendingCode);
      if (cancelled) return;
      if (result.preview) {
        setOffer({ code: pendingCode, preview: result.preview });
      } else if (result.error && DEAD_CODE_ERRORS.has(result.error)) {
        // Dead code: stop offering it on every visit.
        conveyancerJoinService.clearPendingJoinCode();
        setJoinFailure({ reason: result.error, retryable: false });
      }
      // A network failure keeps the code for the next visit and shows nothing.
    })();
    return () => {
      cancelled = true;
    };
  }, [principalId, isAuthenticated]);

  const join = async (): Promise<void> => {
    if (!offer || isJoining) return;
    setIsJoining(true);
    const redeem = await conveyancerJoinService.redeemJoinCode(offer.code);
    setIsJoining(false);
    if (redeem.success) {
      conveyancerJoinService.clearPendingJoinCode();
      setOffer(null);
      setJoinedFirm({ firmName: redeem.firmName, clcId: redeem.clcId });
      setJoinFailure(null);
      onJoined?.();
    } else if (redeem.error && DEAD_CODE_ERRORS.has(redeem.error)) {
      conveyancerJoinService.clearPendingJoinCode();
      setOffer(null);
      setJoinFailure({ reason: redeem.detail ?? redeem.error, retryable: false });
    } else {
      // Transient: keep the offer up so the firm can try again.
      setJoinFailure({ reason: redeem.detail ?? redeem.error ?? 'Activation failed', retryable: true });
    }
  };

  const decline = (): void => {
    conveyancerJoinService.clearPendingJoinCode();
    setOffer(null);
  };

  return (
    <>
      {offer && (
        <div className="mb-6 rounded-lg border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3">
          <p className="text-sm font-medium text-stone-900 dark:text-slate-100">{joinOfferText(offer.preview)}</p>
          <p className="mt-1 text-xs text-stone-600 dark:text-slate-400">
            You opened this invitation on this browser. Joining puts this account on the transaction as the firm&rsquo;s conveyancer.
          </p>
          <div className="mt-3 flex items-center gap-4">
            <button
              type="button"
              onClick={() => void join()}
              disabled={isJoining}
              className="rounded-md bg-[#0D9488] px-4 py-2 text-sm font-medium text-white hover:bg-[#0F766E] disabled:opacity-60"
            >
              {isJoining ? 'Joining…' : 'Join'}
            </button>
            <button type="button" onClick={decline} className="text-sm text-stone-600 underline dark:text-slate-400">
              Don&rsquo;t join
            </button>
          </div>
        </div>
      )}
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
              ? 'Please try again. If it keeps happening, email '
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
