// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Labels and one-line descriptions for the five Buyer Pack items. The server
 * sends enums; every word a person reads comes from here.
 */
import type { BuyerPackItem, BuyerPackItemId, BuyerPackStatus, ChainPosition } from '@/services/buyerPack.service';
import type { VaultSlotId } from '@/types/vault.types';

export const ITEM_LABELS: Record<BuyerPackItemId, string> = {
  id_aml: 'ID and AML verified',
  proof_of_funds: 'Proof of funds',
  mortgage: 'Mortgage position',
  chain: 'Chain position',
  survey: 'Survey',
};

/** What the buyer has to do. Shown only in the buyer's own view. */
export const ITEM_HELP: Record<BuyerPackItemId, string> = {
  id_aml: 'Run through the ID & AML tab. Only the result reaches this pack, never the documents.',
  proof_of_funds: 'Send a source-of-funds document from your PropXchain Wallet to this deal.',
  mortgage: 'Say whether you are a cash buyer or need a mortgage, and send the decision in principle or the offer from your wallet.',
  chain: 'Say whether this purchase depends on selling another property.',
  survey: 'Booked through the platform, then tick when the report arrives.',
};

/** Slots whose sent document makes the mortgage item ready (spec item states). */
export const MORTGAGE_SLOTS: readonly VaultSlotId[] = ['decisionInPrinciple', 'mortgageOffer'];
/** The slot whose sent document makes proof of funds ready. */
export const PROOF_OF_FUNDS_SLOTS: readonly VaultSlotId[] = ['amlSourceOfFunds'];

export function statusLabel(status: BuyerPackStatus): string {
  return status === 'ready' ? 'Ready' : status === 'in_progress' ? 'In progress' : 'Not started';
}

export const CHAIN_COPY: Record<ChainPosition, string> = {
  none: 'No chain',
  first_time_buyer: 'First-time buyer, no chain',
  selling_linked: 'Selling a linked property',
};

function describeAml(i: BuyerPackItem): string {
  switch (i.detail.aml_state) {
    case 'complete': return 'Verified';
    case 'failed': return 'The last check failed. Start again from the ID & AML tab';
    case 'pending':
    case 'in_progress': return 'Check in progress';
    default: return 'No check yet';
  }
}

function describeMortgage(i: BuyerPackItem): string {
  const d = i.detail;
  if (d.funding_type === 'cash') return i.status === 'ready' ? 'Cash · funds evidenced' : 'Cash · proof of funds still needed';
  if (d.funding_type === 'mortgage') {
    const stage = d.mortgage_stage === 'offer' ? 'Offer held' : d.mortgage_stage === 'dip' ? 'DIP held' : 'No DIP or offer sent yet';
    return ['Mortgage', stage, d.lender_name].filter(Boolean).join(' · ');
  }
  return 'Not declared';
}

/** The sentence the other side reads under each tick. */
export function describeItem(i: BuyerPackItem): string {
  switch (i.item) {
    case 'id_aml': return describeAml(i);
    case 'proof_of_funds': return i.status === 'ready' ? 'Funds evidenced' : 'Nothing sent yet';
    case 'mortgage': return describeMortgage(i);
    case 'chain': return i.detail.chain_position ? `${CHAIN_COPY[i.detail.chain_position]} (buyer’s declaration)` : 'Not declared';
    case 'survey': return i.detail.survey_state === 'received' ? 'Report received' : i.detail.survey_state === 'booked' ? 'Booked' : 'Not booked';
  }
}
