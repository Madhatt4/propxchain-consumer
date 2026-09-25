// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * shareParty.service — the per-transaction share-target roster.
 * Parties = the on-chain transaction record (via messaging's stakeholder
 * enumerator) minus the current user. accessList members carry no on-chain
 * role, so role + side come off-chain from get_share_party_sides (conveyancers
 * via the proven principal binding + accepted quote; everyone else via
 * transaction_party_roles written at join — wallet spec decision 15).
 */
import { supabase } from '../lib/supabase';
import { messageService } from './message.service';
import { getStorePrincipalId } from '../stores/authStore';
import { logger } from '@/utils/logger';

export type PartyRole =
  | 'buyer'
  | 'seller'
  | 'conveyancer'
  | 'estate_agent'
  | 'mortgage_broker'
  | 'lender'
  | 'other';

export type DealSide = 'buyer' | 'seller';

export interface ShareParty {
  principal: string;
  label: string;
  role: PartyRole;
  /** Which side of the deal they act for; null when unknown. */
  side: DealSide | null;
}

export interface ShareRoster {
  /** The current user's own side, when they are the buyer or seller. */
  mySide: DealSide | null;
  parties: ShareParty[];
}

interface PartySideRow {
  icp_principal: string;
  party_role: string;
  firm_name: string | null;
  side: string | null;
}

export const ROLE_DISPLAY: Record<PartyRole, string> = {
  buyer: 'Buyer',
  seller: 'Seller',
  conveyancer: 'Conveyancer',
  estate_agent: 'Estate agent',
  mortgage_broker: 'Mortgage broker',
  lender: 'Lender',
  other: 'Participant',
};

const KNOWN_ROLES: readonly PartyRole[] = ['buyer', 'seller', 'conveyancer', 'estate_agent', 'mortgage_broker', 'lender', 'other'];
const asRole = (r: string): PartyRole => (KNOWN_ROLES as readonly string[]).includes(r) ? (r as PartyRole) : 'other';
const asSide = (s: string | null): DealSide | null => (s === 'buyer' || s === 'seller' ? s : null);

class SharePartyService {
  async loadRoster(transactionId: string): Promise<ShareRoster> {
    const roster = await messageService.getChaseableStakeholders(transactionId);
    const me = getStorePrincipalId();
    const mine = roster.find((r) => r.principal === me);
    const mySide: DealSide | null = mine?.role === 'buyer' || mine?.role === 'seller' ? mine.role : null;
    const others = roster.filter((r) => r.principal !== me);

    const offChain = new Map<string, PartySideRow>();
    const unlabelled = others.filter((p) => p.role === 'other').map((p) => p.principal);
    if (unlabelled.length > 0) {
      const { data, error } = await supabase.rpc('get_share_party_sides', {
        p_transaction_id: transactionId,
        p_principals: unlabelled,
      });
      if (error) {
        logger.warn('[shareParty] side lookup failed — using roster labels', error);
      } else {
        for (const row of (data ?? []) as PartySideRow[]) offChain.set(row.icp_principal, row);
      }
    }

    const parties = others.map((p): ShareParty => {
      if (p.role === 'buyer' || p.role === 'seller') {
        return { principal: p.principal, label: `${p.roleDisplay} — ${p.name}`, role: p.role, side: p.role };
      }
      if (p.role === 'solicitor') {
        return { principal: p.principal, label: `Conveyancer — ${p.name}`, role: 'conveyancer', side: null };
      }
      const row = offChain.get(p.principal);
      if (!row) {
        return { principal: p.principal, label: `${p.roleDisplay} — ${p.name}`, role: 'other', side: null };
      }
      const role = asRole(row.party_role);
      const who = row.firm_name ?? p.name;
      return { principal: p.principal, label: `${ROLE_DISPLAY[role]} — ${who}`, role, side: asSide(row.side) };
    });

    return { mySide, parties };
  }

  /** Back-compat: just the parties. */
  async listShareableParties(transactionId: string): Promise<ShareParty[]> {
    return (await this.loadRoster(transactionId)).parties;
  }
}

/** Your side = same side as me; everything else (incl. unknown) is the other side. */
export function splitBySide(parties: ShareParty[], mySide: DealSide | null): { yours: ShareParty[]; others: ShareParty[] } {
  if (!mySide) return { yours: [], others: parties };
  return {
    yours: parties.filter((p) => p.side === mySide),
    others: parties.filter((p) => p.side !== mySide),
  };
}

export const sharePartyService = new SharePartyService();
