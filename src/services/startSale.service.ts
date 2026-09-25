// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * startSale saga — creates the on-chain transaction for a listing, links the
 * listing to it, records the agent's role, moves the listing to
 * under_offer, and invites the seller. Mirrors reservation.service.ts's
 * per-step saga shape, except step 4 (email) is best-effort: its failure is
 * reported but does not throw, so the caller still gets a usable result and
 * can offer a re-send.
 *
 * Retry resumes, it does not restart (#251). Step 1 mints an on-chain
 * transaction, so re-running it after a later step failed would create a
 * second one and leave the first with no listing link and no party roles.
 * The caller passes back the ids step 1 reported and the saga picks up from
 * step 2; both step-2 writes are idempotent (an upsert and an update to the
 * same value), so replaying a half-done step 2 is safe.
 *
 * Link-before-role is load-bearing, not stylistic: transaction_party_roles'
 * RLS policy only permits the insert when the caller already has a provable
 * link to the transaction (an invite they received, an invite they sent, or
 * their org owning the linked listing). Recording the role before linking
 * the listing would insert with none of those proofs true and be denied.
 */

import { Principal } from '@propxchain/core-client';
import { listingWithMaterialInfo } from '@/utils/materialInfo';
import { icpService } from '@/services/icp.service';
import { partyRoleService } from '@/services/partyRole.service';
import { estateAgentListingsService } from '@/services/estateAgentListings.service';
import { partyInviteService } from '@/services/partyInvite.service';
import type { AgentListingRow } from '@/types/estateAgentListing.types';

export interface StartSaleInput {
  listing: AgentListingRow;
  agentPrincipal: string;
  sellerName: string;
  sellerEmail: string;
  /** The ids a previous attempt's step 1 already minted. Present on a retry: step 1 is skipped rather than run again (#251). */
  resume?: StartSaleResult;
}

export interface StartSaleProgress {
  step: 1 | 2 | 3 | 4;
  status: 'pending' | 'success' | 'failed';
  error?: string;
  /** On step 1's success only: the ids to hand back as `resume` if a later step fails. */
  created?: StartSaleResult;
}

export interface StartSaleResult {
  transactionId: string;
  inviteCode: string;
}

/** Tenure -> the 'freehold' | 'leasehold' | '' arg createTransactionWithInvite expects, as CreateTransactionPage derives it. */
function tenureToPropertyTypeArg(tenure: AgentListingRow['listing']['tenure']): 'freehold' | 'leasehold' | '' {
  if (tenure === 'freehold') return 'freehold';
  if (tenure === 'leasehold') return 'leasehold';
  return '';
}

/** Step 1: create the on-chain transaction + invite for this listing. */
async function createOnChain(input: StartSaleInput): Promise<{ transactionId: string; inviteCode: string }> {
  const { listing, agentPrincipal } = input;
  const tm = await icpService.requireTransactionManager();
  const result = await tm.createTransactionWithInvite(
    'listing_' + listing.id,
    listing.listing.address,
    listing.listing.postcode,
    // Agent listings have no title-number field (unlike the manual
    // CreateTransactionPage form) — same '' placeholder either way.
    '',
    Principal.fromText(agentPrincipal),
    '',
    BigInt(listing.listing.price),
    'sale',
    'estate_agent',
    tenureToPropertyTypeArg(listing.listing.tenure),
    'residential',
    'agent',
    BigInt(0),
    BigInt(0),
    '',
  );

  if ('err' in result) {
    throw new Error(result.err);
  }

  const [transactionId, inviteCode] = result.ok;
  return { transactionId, inviteCode };
}

/**
 * Step 2: link the listing to the transaction, then record the agent's role.
 * The link must land first — it's the fact (agent_listings.transaction_id)
 * that gives the caller's org a provable relationship to the transaction,
 * which transaction_party_roles' RLS policy requires before it allows the
 * role insert. The link goes through the link-listing-transaction edge
 * function (the browser cannot write that column): it checks on-chain that
 * this agent's step 1 created the deal. Role-recording retries once on failure.
 */
async function linkAndRecordAgentRole(
  listing: AgentListingRow,
  transactionId: string,
  agentPrincipal: string,
): Promise<void> {
  // The transaction's listing record, on chain, before anything else: the
  // seller's Stage 1, the sales pack and the TA forms all read it, and the
  // agent's material information (council tax band, lease figures) rides
  // along so nobody types it twice. The creator always has access, so the
  // agent can write it; on resume this simply rewrites the same JSON.
  await icpService.setListingData(
    transactionId,
    listingWithMaterialInfo(listing.listing, listing.material_info) as unknown as Record<string, unknown>,
  );
  await estateAgentListingsService.linkTransaction(listing.id, transactionId);

  const roleInput = {
    transactionId,
    principal: agentPrincipal,
    role: 'estate_agent' as const,
    side: 'seller' as const,
    invitedBy: null,
  };
  let ok = await partyRoleService.recordMyRole(roleInput);
  if (!ok) {
    ok = await partyRoleService.recordMyRole(roleInput);
  }
  if (!ok) {
    throw new Error('Could not record agent role for this transaction');
  }
}

/** Step 3: move the listing to under_offer, now that it's linked and the deal has a role recorded. */
async function markUnderOffer(listing: AgentListingRow): Promise<void> {
  await estateAgentListingsService.setStatus(listing.id, 'under_offer');
}

/** Step 4: email the seller their invite. Best-effort — never throws. */
async function inviteSeller(
  input: StartSaleInput,
  transactionId: string,
  inviteCode: string,
): Promise<{ ok: boolean; error: string | null }> {
  return partyInviteService.send({
    transactionId,
    inviteCode,
    role: 'seller',
    side: 'seller',
    recipientName: input.sellerName,
    recipientEmail: input.sellerEmail,
    listingId: input.listing.id,
    propertyAddress: input.listing.listing.address,
  });
}

/**
 * Step 1, or the memory of it. Given `resume` the transaction already exists,
 * so it is reported as done and nothing is minted: running it twice is what
 * orphaned a transaction in #251. Reports the ids on success either way, so
 * the caller can hand them back if a later step fails.
 */
async function createStep(input: StartSaleInput, onProgress: (p: StartSaleProgress) => void): Promise<StartSaleResult> {
  if (input.resume) {
    onProgress({ step: 1, status: 'success', created: input.resume });
    return input.resume;
  }
  onProgress({ step: 1, status: 'pending' });
  try {
    const created = await createOnChain(input);
    onProgress({ step: 1, status: 'success', created });
    return created;
  } catch (err) {
    onProgress({ step: 1, status: 'failed', error: err instanceof Error ? err.message : 'Unknown error' });
    throw err;
  }
}

/** Run one step: report pending/success/failed and rethrow on failure. */
async function runStep<T>(step: 2 | 3, onProgress: (p: StartSaleProgress) => void, fn: () => Promise<T>): Promise<T> {
  onProgress({ step, status: 'pending' });
  try {
    const result = await fn();
    onProgress({ step, status: 'success' });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    onProgress({ step, status: 'failed', error: message });
    throw err;
  }
}

export const startSaleService = {
  /**
   * Run the start-sale saga. Calls onProgress after each step. Steps 1-3
   * are fatal on failure; step 4 (email) is best-effort and still returns
   * the transaction/invite ids so the UI can offer a re-send.
   *
   * Pass `input.resume` to continue an attempt whose step 1 succeeded: the
   * transaction is not minted again (#251).
   */
  async startSale(input: StartSaleInput, onProgress: (progress: StartSaleProgress) => void): Promise<StartSaleResult> {
    const { transactionId, inviteCode } = await createStep(input, onProgress);

    await runStep(2, onProgress, () => linkAndRecordAgentRole(input.listing, transactionId, input.agentPrincipal));

    await runStep(3, onProgress, () => markUnderOffer(input.listing));

    onProgress({ step: 4, status: 'pending' });
    const emailResult = await inviteSeller(input, transactionId, inviteCode);
    if (emailResult.ok) {
      onProgress({ step: 4, status: 'success' });
    } else {
      onProgress({ step: 4, status: 'failed', error: emailResult.error ?? 'Invite could not be sent' });
    }

    return { transactionId, inviteCode };
  },
};
