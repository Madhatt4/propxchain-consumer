// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Pure presentation rules for the ID & AML panel. Kept out of the components
 * so the wording — which is fact-not-verdict by design — is unit-testable.
 *
 * The provider warrants the pipe, not the data, and the compliance decision
 * sits with the conveyancer. So a status says what has HAPPENED to the check
 * ("complete", "could not be completed"), never whether a person passed or
 * failed, and never that PropXchain has approved anyone.
 */
import type { AmlCheck, AmlProvider, AmlTier } from '@/services/aml.service';
import type { DealSide, ShareParty, ShareRoster } from '@/services/shareParty.service';

export interface AmlStatusView {
  label: string;
  detail: string;
  tone: 'idle' | 'busy' | 'done' | 'problem';
  /** True when the report has dropped into the Transaction Wallet. */
  showWalletLink: boolean;
  /** True when a new check may be started for this person. */
  canStart: boolean;
}

export const TIER_COPY: Record<AmlTier, { name: string; blurb: string }> = {
  standard: { name: 'Standard', blurb: 'Identity, address and PEP/sanctions screening.' },
  enhanced: { name: 'Enhanced', blurb: 'Standard plus open-banking source of funds — what conveyancers usually ask for.' },
};

/**
 * Provider display name comes from the check, not a constant — ADR 0015 §1
 * requires provider identity to be data-driven, and a second supplier must not
 * need a copy edit here.
 */
const PROVIDER_DISPLAY: Record<string, string> = { verify365: 'Verify 365' };

export function providerName(check: AmlCheck | null): string {
  if (!check) return 'our verification partner';
  return PROVIDER_DISPLAY[check.provider] ?? check.provider;
}

/**
 * The name the panel brands itself with. A check that exists names its own
 * provider (it may predate a supplier change); before any check, the worker's
 * `/pricing` declaration does; only a worker without one falls back to the
 * anonymous wording.
 */
export function panelProviderName(provider: AmlProvider | null, check: AmlCheck | null): string {
  if (check) return providerName(check);
  if (provider?.name) return provider.name;
  return providerName(null);
}

export function formatPence(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

/** The people a check can be about: buyers and sellers, never their advisers. */
export function checkableParties(parties: ShareParty[]): ShareParty[] {
  return parties.filter((p) => p.role === 'buyer' || p.role === 'seller');
}

const SIDE_LABEL: Record<DealSide, string> = { buyer: 'Buyer', seller: 'Seller' };

/**
 * The roster is everyone EXCEPT me — it exists for choosing share targets —
 * but ordering is self-only, so my own card is the one that matters here.
 * Rebuild it from my on-chain side. Without this the panel could only ever
 * show other people, and the self-start form was unreachable.
 */
export function withMe(roster: ShareRoster, me: string): ShareParty[] {
  const others = roster.parties.filter((p) => p.principal !== me);
  if (!roster.mySide) return others;
  return [{ principal: me, label: SIDE_LABEL[roster.mySide], role: roster.mySide, side: roster.mySide }, ...others];
}

/** The check that currently speaks for a person — the newest one. */
export function latestCheckFor(checks: AmlCheck[], principal: string): AmlCheck | null {
  const mine = checks.filter((c) => c.subjectPrincipal === principal);
  if (mine.length === 0) return null;
  return mine.reduce((a, b) => (a.createdAt >= b.createdAt ? a : b));
}

export function statusView(check: AmlCheck | null): AmlStatusView {
  if (!check) {
    return { label: 'Not started', detail: `No check has been ordered yet.`, tone: 'idle', showWalletLink: false, canStart: true };
  }
  switch (check.status) {
    case 'pending':
      return {
        label: check.paymentStatus === 'paid' ? 'Being placed' : 'Awaiting payment',
        detail:
          check.paymentStatus === 'paid'
            ? `Paid — the check is being placed with ${providerName(check)}.`
            : 'The order was created but payment did not complete. Start again to pay.',
        tone: check.paymentStatus === 'paid' ? 'busy' : 'idle',
        showWalletLink: false,
        canStart: check.paymentStatus !== 'paid',
      };
    case 'in_progress':
      return {
        label: 'In progress',
        detail: `${providerName(check)} will contact this person directly to complete their ID journey. The status updates here automatically.`,
        tone: 'busy',
        showWalletLink: false,
        canStart: false,
      };
    case 'complete':
      return {
        label: 'Check complete',
        detail: check.hasReport
          ? 'The report is in the Transaction Wallet, ready to share with a conveyancer.'
          : 'The report is on its way to the Transaction Wallet.',
        tone: 'done',
        showWalletLink: check.hasReport,
        canStart: false,
      };
    case 'failed':
      return {
        label: 'Could not be completed',
        detail: `${providerName(check)} could not complete this check. You can order a new one.`,
        tone: 'problem',
        showWalletLink: false,
        canStart: true,
      };
  }
}

/** Whether the panel should keep polling — only while something is moving. */
export function hasLiveCheck(checks: AmlCheck[]): boolean {
  return checks.some((c) => c.status === 'in_progress' || (c.status === 'pending' && c.paymentStatus === 'paid'));
}
