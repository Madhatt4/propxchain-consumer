// PropXchain - Open Source Blockchain Property Conveyancing Platform
// Copyright (C) 2026 PropXchain Contributors
// SPDX-License-Identifier: Proprietary

/**
 * Sales-pack share links (decision: Madhatt4/Propxchain#116).
 *
 * Assembly happens HERE, in the seller's authenticated browser — the
 * canister form reads are principal-gated, so a server function could
 * never build the pack. The redacted snapshot is published to
 * `pack_share_links` (owner-only RLS); the anonymous viewer reaches it
 * through the `pack-view` edge function by unguessable token. Revoking
 * sets status and empties the snapshot, so a dead link holds nothing.
 */
import { supabase } from '../lib/supabase';
import {
  computePackReadiness,
  loadPackReadinessInputs,
} from './salesPackReadiness';
import { hmlrTitleService } from './hmlrTitle.service';
import { fetchReturnedOneSearchResults } from './onesearchResults';
import { icpService } from './icp.service';
import { web2DocumentService } from './web2-document.service';
import { isPackDocument, packDocLabel } from '@/lib/packDocKinds';
import { redactTa6ForSharing, redactTa10ForSharing } from '@/utils/packRedaction';
import type {
  PackShareLink,
  PackSnapshot,
  PackSnapshotItem,
  PackTitleSummary,
} from '@/types/packShare.types';

async function swallow<T>(work: Promise<T>, fallback: T): Promise<T> {
  try {
    return await work;
  } catch {
    return fallback;
  }
}

function newToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Title summary for strangers — proprietors deliberately never copied. */
function toTitleSummary(
  register: Awaited<ReturnType<typeof hmlrTitleService.getStoredRegisterForTransaction>>,
): PackTitleSummary | null {
  if (!register) return null;
  return {
    titleNumber: register.titleNumber,
    classOfTitle: register.classOfTitle,
    tenure: register.tenure,
    editionDate: register.editionDate,
    hasCharges: register.hasCharges,
    hasRestrictions: register.hasRestrictions,
  };
}

export async function assemblePackSnapshot(transactionId: string): Promise<PackSnapshot> {
  const inputs = await loadPackReadinessInputs(transactionId);
  const readiness = computePackReadiness(inputs);

  const [register, returned, ta6Raw, ta10Raw, storedDocs] = await Promise.all([
    swallow(hmlrTitleService.getStoredRegisterForTransaction(transactionId), null),
    swallow(fetchReturnedOneSearchResults(transactionId), []),
    swallow(icpService.getTA6(transactionId), null),
    swallow(icpService.getTA10(transactionId), null),
    swallow(web2DocumentService.getDocumentsByTransaction(transactionId), []),
  ]);

  const listing = inputs.listing;
  const anchorNote = 'Record held on the Internet Computer';
  const items: PackSnapshotItem[] = readiness.items.map((item) => {
    switch (item.id) {
      case 'titlePulled':
        return item.done
          ? { ...item, verification: { verified: true, note: 'Official Copy hash anchored on the Internet Computer' } }
          : item;
      case 'ta6':
        return item.done && ta6Raw
          ? { ...item, verification: { verified: true, anchoredAt: (ta6Raw as { lastModifiedAt?: string }).lastModifiedAt, note: anchorNote } }
          : item;
      case 'ta10':
        return item.done && ta10Raw
          ? { ...item, verification: { verified: true, anchoredAt: (ta10Raw as { lastModifiedAt?: string }).lastModifiedAt, note: anchorNote } }
          : item;
      case 'materialInfo':
      case 'epc':
        return item.done && listing
          ? { ...item, verification: { verified: true, note: 'Listing recorded on-chain with per-field provenance' } }
          : item;
      default:
        return item;
    }
  });

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    property: listing
      ? {
          address: listing.address,
          postcode: listing.postcode,
          price: listing.price,
          tenure: listing.tenure,
          propertyType: listing.propertyType,
          epcRating: listing.epcRating,
          councilTaxBand: listing.councilTaxBand,
          uprn: listing.uprn,
          leaseYearsRemaining: listing.leaseYearsRemaining,
          groundRentPerYear: listing.groundRentPerYear,
          serviceChargePerYear: listing.serviceChargePerYear,
        }
      : null,
    items,
    titleSummary: toTitleSummary(register),
    searches: {
      ordered: inputs.searchesOrdered,
      back: inputs.searchesBack,
      returnedAt: returned[0]?.returnedAt,
      productCodes: returned.flatMap((r) => r.productCodes),
    },
    ta6: ta6Raw ? redactTa6ForSharing(ta6Raw) : null,
    ta10: ta10Raw ? redactTa10ForSharing(ta10Raw) : null,
    extraDocuments: storedDocs
      .filter((d) => isPackDocument(d.documentType))
      .map((d) => ({ fileName: d.fileName, kind: packDocLabel(d.documentType) })),
  };
}

interface ShareLinkRow {
  id: string;
  transaction_id: string;
  token: string;
  status: 'active' | 'revoked';
  created_at: string;
  updated_at: string;
}

function toLink(row: ShareLinkRow): PackShareLink {
  return {
    id: row.id,
    transactionId: row.transaction_id,
    token: row.token,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getMyShareLink(transactionId: string): Promise<PackShareLink | null> {
  const { data, error } = await supabase
    .from('pack_share_links')
    .select('id, transaction_id, token, status, created_at, updated_at')
    .eq('transaction_id', transactionId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Failed to load share link: ${error.message}`);
  return data ? toLink(data as ShareLinkRow) : null;
}

export async function createShareLink(transactionId: string): Promise<PackShareLink> {
  const snapshot = await assemblePackSnapshot(transactionId);
  const { data, error } = await supabase
    .from('pack_share_links')
    .insert({
      transaction_id: transactionId,
      token: newToken(),
      status: 'active',
      snapshot,
    })
    .select('id, transaction_id, token, status, created_at, updated_at')
    .single();
  if (error) throw new Error(`Failed to create share link: ${error.message}`);
  return toLink(data as ShareLinkRow);
}

/** Re-publish the current pack state onto an existing active link. */
export async function refreshShareLink(link: PackShareLink): Promise<void> {
  const snapshot = await assemblePackSnapshot(link.transactionId);
  const { error } = await supabase
    .from('pack_share_links')
    .update({ snapshot, updated_at: new Date().toISOString() })
    .eq('id', link.id)
    .eq('status', 'active');
  if (error) throw new Error(`Failed to refresh share link: ${error.message}`);
}

/** Revoke: the row keeps its audit shell, the snapshot is emptied. */
export async function revokeShareLink(link: PackShareLink): Promise<void> {
  const { error } = await supabase
    .from('pack_share_links')
    .update({
      status: 'revoked',
      snapshot: null,
      revoked_at: new Date().toISOString(),
    })
    .eq('id', link.id);
  if (error) throw new Error(`Failed to revoke share link: ${error.message}`);
}

export function shareUrlFor(token: string): string {
  return `${window.location.origin}/pack/${token}`;
}

/** Anonymous viewer fetch, via the pack-view edge function. */
export async function fetchSharedPack(
  token: string,
): Promise<{ snapshot: PackSnapshot; updatedAt: string } | null> {
  const { data, error } = await supabase.functions.invoke('pack-view', {
    body: { token },
  });
  if (error) return null;
  const payload = data as { snapshot?: PackSnapshot; updatedAt?: string } | null;
  if (!payload?.snapshot) return null;
  return { snapshot: payload.snapshot, updatedAt: payload.updatedAt ?? '' };
}
