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

const DOC_REGISTERED = 'doc_registered';
const SHA256_HEX = /^[0-9a-f]{64}$/;

/**
 * Who registered a completion statement, from the audit event's details.
 * The event carries no structured uploader: its caller is transaction_manager
 * and its metadata holds only docHash and docType, so the sentence is the only
 * source every party may read. It is written by
 * packages/core/src/transaction_manager/audit_text.mo, docRegistered:
 *   "Document " # safe(docType) # " registered by " # uploadedBy,
 * Anything that is not exactly that sentence, with a principal at the end,
 * reads as unknown, so a change of wording finds no statement (fail closed).
 */
const REGISTERED_BY = /^Document completion_statement registered by ([a-z0-9]{5}(?:-[a-z0-9]{1,5})+)$/;

export function statementUploaderOf(details: unknown): string | null {
  return typeof details === 'string' ? (REGISTERED_BY.exec(details)?.[1] ?? null) : null;
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

/** A doc_registered event for a completion statement: its hash and time, uploader not yet checked. */
function statementEventOf(event: unknown): { fileHash: string; uploadedAt: Date; details: unknown } | null {
  if (!event || typeof event !== 'object') return null;
  const e = event as Record<string, unknown>;
  if (e.eventType !== DOC_REGISTERED) return null;
  const fields = metadataFields(e.metadata);
  if (fields.get('docType') !== COMPLETION_STATEMENT_DOC_TYPE) return null;
  const fileHash = (fields.get('docHash') ?? '').toLowerCase();
  if (!SHA256_HEX.test(fileHash)) return null;
  // Canister time is nanoseconds.
  return { fileHash, uploadedAt: new Date(Math.floor(Number(e.timestamp ?? 0) / 1e6)), details: e.details };
}

/**
 * The latest completion statement registered by the seller's conveyancer.
 * Null when there is none, when no seller's conveyancer is on the deal, or
 * when the uploader cannot be read: a statement nobody can attribute to the
 * seller's conveyancer is not the seller's conveyancer's statement.
 */
export function completionStatementFromEvents(
  events: unknown,
  sellerConveyancer: string | null | undefined,
): CompletionStatementRecord | null {
  if (!sellerConveyancer || !Array.isArray(events)) return null;
  let latest: CompletionStatementRecord | null = null;
  for (const event of events) {
    const found = statementEventOf(event);
    if (!found || statementUploaderOf(found.details) !== sellerConveyancer) continue;
    if (!latest || found.uploadedAt.getTime() >= latest.uploadedAt.getTime()) {
      latest = { fileHash: found.fileHash, uploadedAt: found.uploadedAt, uploadedBy: sellerConveyancer };
    }
  }
  return latest;
}

export const STATEMENT_UNREADABLE = 'Could not check for a completion statement. Please try again.';
export const STATEMENT_UNATTRIBUTED =
  "A completion statement has been uploaded, but the seller's conveyancer on this deal could not be confirmed, so completion cannot go ahead yet. Please contact support.";

/** Why completion cannot pick a statement hash; the message is shown as written. */
export class CompletionStatementCheckError extends Error {}

/**
 * The statement hash completion must anchor, or null for the deal-facts
 * fallback. Both sides must anchor the same hash, so this throws rather than
 * fall back when the trail cannot be read, or when a statement exists but the
 * seller's conveyancer cannot be determined.
 */
export function statementHashForCompletion(events: unknown, sellerConveyancer: string | null | undefined): string | null {
  if (!Array.isArray(events)) throw new CompletionStatementCheckError(STATEMENT_UNREADABLE);
  if (!sellerConveyancer) {
    if (events.some((e) => statementEventOf(e) !== null)) throw new CompletionStatementCheckError(STATEMENT_UNATTRIBUTED);
    return null;
  }
  return completionStatementFromEvents(events, sellerConveyancer)?.fileHash ?? null;
}

async function readEvents(transactionId: string): Promise<unknown> {
  const ledger = icpService.ledgerManager;
  if (!ledger) throw new CompletionStatementCheckError(STATEMENT_UNREADABLE);
  try {
    return await ledger.getEventsByTransaction(transactionId);
  } catch {
    throw new CompletionStatementCheckError(STATEMENT_UNREADABLE);
  }
}

/** Read the statement for display. Throws when the trail cannot be asked. */
export async function readCompletionStatement(
  transactionId: string,
  sellerConveyancer: string | null | undefined,
): Promise<CompletionStatementRecord | null> {
  if (!sellerConveyancer) return null;
  return completionStatementFromEvents(await readEvents(transactionId), sellerConveyancer);
}

/** Read the trail at confirm time and pick the hash; throws CompletionStatementCheckError. */
export async function readStatementHashForCompletion(
  transactionId: string,
  sellerConveyancer: string | null | undefined,
): Promise<string | null> {
  return statementHashForCompletion(await readEvents(transactionId), sellerConveyancer);
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
