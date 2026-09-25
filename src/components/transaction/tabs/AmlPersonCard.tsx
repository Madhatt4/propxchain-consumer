// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * One buyer or seller on the ID & AML panel: who they are (a roster label,
 * never a stored name), what has happened to their check, and — when nothing
 * is in flight — the tier choice and the start button. Standard is the
 * default; Enhanced is the upgrade. Lite is deliberately not offered.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Clock, ShieldCheck, Wallet, AlertTriangle } from 'lucide-react';
import type { AmlCheck, AmlPersonalDetails, AmlTier, AmlTierPrice } from '@/services/aml.service';
import type { ShareParty } from '@/services/shareParty.service';
import { TIER_COPY, formatPence, statusView } from './amlStatus';

interface AmlPersonCardProps {
  party: ShareParty;
  isMe: boolean;
  check: AmlCheck | null;
  pricing: AmlTierPrice[];
  /** Who runs the check — named on the button and in the details note, never assumed. */
  providerLabel: string;
  busy: boolean;
  onStart: (party: ShareParty, tier: AmlTier, details: AmlPersonalDetails) => void;
}

const EMPTY_DETAILS: AmlPersonalDetails = { firstName: '', lastName: '', email: '', phone: '' };

const TONE_CLASS = {
  idle: 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-300',
  busy: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  done: 'bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300',
  problem: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300',
} as const;

const TONE_ICON = { idle: ShieldCheck, busy: Clock, done: CheckCircle2, problem: AlertTriangle } as const;

export function AmlPersonCard({ party, isMe, check, pricing, providerLabel, busy, onStart }: AmlPersonCardProps): JSX.Element {
  const [tier, setTier] = useState<AmlTier>('standard');
  const [details, setDetails] = useState<AmlPersonalDetails>(EMPTY_DETAILS);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const view = statusView(check);
  const Icon = TONE_ICON[view.tone];
  const price = pricing.find((p) => p.tier === tier);

  const submit = (): void => {
    if (!details.firstName.trim() || !details.lastName.trim() || !details.email.trim() || !details.phone.trim()) {
      setDetailsError(`We need your name, mobile and email — ${providerLabel} contacts you directly to complete the check.`);
      return;
    }
    setDetailsError(null);
    onStart(party, tier, details);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4" data-testid={`aml-card-${party.principal}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {party.label}
            {isMe && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(you)</span>}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{view.detail}</p>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${TONE_CLASS[view.tone]}`}>
          <Icon className="h-3 w-3" /> {view.label}
        </span>
      </div>

      {view.showWalletLink && (
        <Link to={{ search: '?tab=wallet' }} className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 hover:underline dark:text-teal-300">
          <Wallet className="h-3.5 w-3.5" /> Open in Transaction Wallet
        </Link>
      )}

      {view.canStart && !isMe && (
        <p className="mt-3 text-xs text-muted-foreground">
          {party.label.split(' ')[0]} can start this from their own account. Checks are personal, so only they can
          enter their own details.
        </p>
      )}

      {view.canStart && isMe && (
        <div className="mt-3 space-y-2">
          <fieldset className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <legend className="sr-only">Check tier</legend>
            {pricing.map((option) => {
              const copy = TIER_COPY[option.tier];
              const selected = option.tier === tier;
              return (
                <label
                  key={option.tier}
                  className={`cursor-pointer rounded-lg border p-2.5 text-xs ${
                    selected ? 'border-teal-500 bg-teal-50/60 dark:bg-teal-950/30' : 'border-border hover:border-teal-300'
                  }`}
                >
                  <input
                    type="radio"
                    name={`aml-tier-${party.principal}`}
                    value={option.tier}
                    checked={selected}
                    onChange={() => setTier(option.tier)}
                    className="sr-only"
                  />
                  <span className="flex items-center justify-between font-semibold text-foreground">
                    {copy.name}
                    <span className="font-geist-mono">{formatPence(option.retailPence)}</span>
                  </span>
                  <span className="mt-0.5 block text-muted-foreground">{copy.blurb}</span>
                </label>
              );
            })}
          </fieldset>

          <fieldset className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <legend className="sr-only">Your contact details</legend>
            <div>
              <label htmlFor={`aml-firstName-${party.principal}`} className="block text-[11px] font-medium text-muted-foreground">
                First name
              </label>
              <input
                id={`aml-firstName-${party.principal}`}
                type="text"
                value={details.firstName}
                onChange={(e) => setDetails((d) => ({ ...d, firstName: e.target.value }))}
                className="mt-0.5 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground"
              />
            </div>
            <div>
              <label htmlFor={`aml-lastName-${party.principal}`} className="block text-[11px] font-medium text-muted-foreground">
                Last name
              </label>
              <input
                id={`aml-lastName-${party.principal}`}
                type="text"
                value={details.lastName}
                onChange={(e) => setDetails((d) => ({ ...d, lastName: e.target.value }))}
                className="mt-0.5 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground"
              />
            </div>
            <div>
              <label htmlFor={`aml-phone-${party.principal}`} className="block text-[11px] font-medium text-muted-foreground">
                Mobile number
              </label>
              <input
                id={`aml-phone-${party.principal}`}
                type="tel"
                value={details.phone}
                onChange={(e) => setDetails((d) => ({ ...d, phone: e.target.value }))}
                className="mt-0.5 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground"
              />
            </div>
            <div>
              <label htmlFor={`aml-email-${party.principal}`} className="block text-[11px] font-medium text-muted-foreground">
                Email
              </label>
              <input
                id={`aml-email-${party.principal}`}
                type="email"
                value={details.email}
                onChange={(e) => setDetails((d) => ({ ...d, email: e.target.value }))}
                className="mt-0.5 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground"
              />
            </div>
          </fieldset>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            These details go to {providerLabel}, who will contact you directly to complete the check. PropXchain passes
            them on and deletes its own copy once the check is placed with {providerLabel}.
          </p>
          {detailsError && (
            <p role="alert" className="text-xs text-red-600 dark:text-red-400">
              {detailsError}
            </p>
          )}

          <button
            type="button"
            disabled={busy || !price}
            onClick={submit}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-teal-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-teal-700 disabled:opacity-50"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            {price
              ? `Start ${TIER_COPY[tier].name} check with ${providerLabel} — ${formatPence(price.retailPence)}`
              : `Start check with ${providerLabel}`}
          </button>
        </div>
      )}
    </div>
  );
}
