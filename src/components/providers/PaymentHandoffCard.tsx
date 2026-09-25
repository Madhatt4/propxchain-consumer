// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The hand-over of a search payment to the client (spec
 * docs/plans/2026-09-06-agent-crm-spec.md, I3): the agent set the order up,
 * the client pays, either on this screen passed across the desk or from the
 * link in their own inbox. Card details are never shown or taken here.
 */
import type { DealSide } from '@/services/shareParty.service';

export interface PaymentHandoffCardProps {
  side: DealSide;
  providerLabel: string;
  totalPence: number;
  /** The masked address the link went to, once it has. */
  sentTo: string | null;
  busy: 'sending' | 'checking' | null;
  error: string | null;
  /** What the last payment check found. */
  note: string | null;
  onHandOver: () => void;
  onEmailLink: () => void;
  onCheckPayment: () => void;
}

function formatPence(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

const PRIMARY = 'rounded-lg bg-[#0D9488] px-4 py-2 font-dm-sans text-sm font-medium text-white hover:bg-[#0F766E] disabled:opacity-60';
const SECONDARY =
  'rounded-lg border border-[#0D9488] px-4 py-2 font-dm-sans text-sm font-medium text-[#0F766E] hover:bg-[#CCFBF1]/60 disabled:opacity-60 dark:text-[#5EEAD4]';

export function PaymentHandoffCard(props: PaymentHandoffCardProps): JSX.Element {
  const { side, providerLabel, totalPence, sentTo, busy, error, note, onHandOver, onEmailLink, onCheckPayment } = props;
  return (
    <section
      data-testid="payment-handoff"
      aria-labelledby="payment-handoff-heading"
      className="rounded-xl border border-[#0D9488]/40 bg-[#CCFBF1]/30 p-5 dark:border-[#14B8A6]/30 dark:bg-[#14B8A6]/5"
    >
      <h3 id="payment-handoff-heading" className="font-fraunces text-lg font-semibold text-gray-900 dark:text-gray-100">
        Payment in the {side}&rsquo;s name
      </h3>
      <p className="mt-1 font-dm-sans text-sm text-gray-700 dark:text-gray-300">
        <span className="font-geist-mono tabular-nums">{formatPence(totalPence)}</span> to {providerLabel}. The card must be the {side}&rsquo;s
        own. Stripe emails the receipt to them, and the searches are ordered once it is paid.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" onClick={onHandOver} disabled={busy !== null} className={PRIMARY}>
          Hand the screen over
        </button>
        <button type="button" onClick={onEmailLink} disabled={busy !== null} className={SECONDARY}>
          {busy === 'sending' ? 'Sending…' : sentTo ? 'Send the link again' : `Email the link to the ${side}`}
        </button>
      </div>
      {sentTo && (
        <div className="mt-4 rounded-lg bg-white/70 p-3 dark:bg-black/20">
          <p className="font-dm-sans text-sm text-gray-700 dark:text-gray-300">
            Sent to <span className="font-geist-mono">{sentTo}</span>. When they have paid, check here and the order goes through.
          </p>
          <button type="button" onClick={onCheckPayment} disabled={busy !== null} className={`mt-2 ${SECONDARY}`}>
            {busy === 'checking' ? 'Checking…' : 'Check payment'}
          </button>
          {note && (
            <p role="status" className="mt-2 font-dm-sans text-sm text-gray-600 dark:text-gray-400">
              {note}
            </p>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 font-dm-sans text-sm text-[#9A3412] dark:text-[#FDBA74]">
          {error}
        </p>
      )}
    </section>
  );
}
