// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { icpService } from '@/services/icp.service';

/**
 * The completion statement the seller's conveyancer uploaded, as the audit
 * trail records it. The file itself stays with the firm (hash-only storage);
 * PropXchain holds its SHA-256 fingerprint, which completion anchors on-chain
 * as completionStatementHash.
 *
 * Read from the audit trail rather than the document list because the
 * document list hides a conveyancer's transfer documents from the other
 * side's conveyancer, while every member of the deal may read the trail.
 * transaction_manager writes the doc_registered event itself when
 * document_storage registers a file, so a client cannot forge one.
 */
export interface CompletionStatementRecord {
  fileHash: string;
  uploadedAt: Date;
  uploadedBy: string;
}

export const COMPLETION_STATEMENT_DOC_TYPE = 'completion_statement';

const DOC_REGISTERED = 'doc_registered';
const SHA256_HEX = /^[0-9a-f]{64}$/;
const REGISTERED_BY = /registered by (\S+)\s*$/;

/** Candid principals arrive as objects with toText(); tests pass strings. */
function principalText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'toText' in value) {
    return String((value as { toText: () => string }).toText());
  }
  return '';
}

/** The seller's conveyancer from a solicitor slot: a record, a Candid opt, or nothing. */
export function sellerConveyancerOf(slot: unknown): string | null {
  const record: unknown = Array.isArray(slot) ? slot[0] : slot;
  if (!record || typeof record !== 'object' || !('principal' in record)) return null;
  return principalText((record as { principal: unknown }).principal) || null;
}

/** "docHash=…;docType=…; bot=…" to a key/value map. */
function metadataFields(metadata: unknown): Map<string, string> {
  const raw = Array.isArray(metadata) ? metadata[0] : metadata;
  const fields = new Map<string, string>();
  if (typeof raw !== 'string') return fields;
  for (const part of raw.split(';')) {
    const at = part.indexOf('=');
    if (at > 0) fields.set(part.slice(0, at).trim(), part.slice(at + 1).trim());
  }
  return fields;
}

/** Canister time is nanoseconds. */
function toDate(timestamp: unknown): Date {
  return new Date(Math.floor(Number(timestamp ?? 0) / 1e6));
}

function statementOf(event: unknown): CompletionStatementRecord | null {
  if (!event || typeof event !== 'object') return null;
  const e = event as Record<string, unknown>;
  if (e.eventType !== DOC_REGISTERED) return null;
  const fields = metadataFields(e.metadata);
  if (fields.get('docType') !== COMPLETION_STATEMENT_DOC_TYPE) return null;
  const fileHash = (fields.get('docHash') ?? '').toLowerCase();
  if (!SHA256_HEX.test(fileHash)) return null;
  const uploadedBy = REGISTERED_BY.exec(String(e.details ?? ''))?.[1] ?? '';
  return { fileHash, uploadedAt: toDate(e.timestamp), uploadedBy };
}

/**
 * The latest completion statement registered by the seller's conveyancer.
 * Null when there is none, or when no seller's conveyancer is on the deal:
 * a statement from anyone else is not the seller's conveyancer's statement.
 */
export function completionStatementFromEvents(
  events: unknown,
  sellerConveyancer: string | null | undefined,
): CompletionStatementRecord | null {
  if (!sellerConveyancer || !Array.isArray(events)) return null;
  let latest: CompletionStatementRecord | null = null;
  for (const event of events) {
    const statement = statementOf(event);
    if (!statement || statement.uploadedBy !== sellerConveyancer) continue;
    if (!latest || statement.uploadedAt.getTime() >= latest.uploadedAt.getTime()) latest = statement;
  }
  return latest;
}

/**
 * Read the statement from the audit trail. Throws when the trail cannot be
 * asked, because "could not ask" must not read as "no statement": completion
 * would then anchor the fallback hash for good.
 */
export async function readCompletionStatement(
  transactionId: string,
  sellerConveyancer: string | null | undefined,
): Promise<CompletionStatementRecord | null> {
  if (!sellerConveyancer) return null;
  const ledger = icpService.ledgerManager;
  if (!ledger) throw new Error('The audit trail is not available.');
  return completionStatementFromEvents(await ledger.getEventsByTransaction(transactionId), sellerConveyancer);
}

function formatDate(at: Date): string {
  return at.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** The client's read-only line. */
export function completionStatementText(statement: CompletionStatementRecord | null): string {
  return statement
    ? `Completion statement: uploaded by the seller's conveyancer on ${formatDate(statement.uploadedAt)}. Its fingerprint is recorded on PropXchain.`
    : "Completion statement: not uploaded yet by the seller's conveyancer.";
}
