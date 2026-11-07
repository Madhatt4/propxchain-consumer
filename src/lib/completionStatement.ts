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

/** A doc_registered event for a completion statement, with its uploader if it can be read. */
function statementEventOf(event: unknown): CompletionStatementRecord | null {
  if (!event || typeof event !== 'object') return null;
  const e = event as Record<string, unknown>;
  if (e.eventType !== DOC_REGISTERED) return null;
  const fields = metadataFields(e.metadata);
  if (fields.get('docType') !== COMPLETION_STATEMENT_DOC_TYPE) return null;
  const fileHash = (fields.get('docHash') ?? '').toLowerCase();
  if (!SHA256_HEX.test(fileHash)) return null;
  // Canister time is nanoseconds.
  const uploadedAt = new Date(Math.floor(Number(e.timestamp ?? 0) / 1e6));
  return { fileHash, uploadedAt, uploadedBy: statementUploaderOf(e.details) ?? '' };
}

/**
 * Every completion statement registered by the seller's conveyancer, oldest
 * first. Empty when no seller's conveyancer is on the deal or the uploader
 * cannot be read: a statement nobody can attribute to the seller's
 * conveyancer is not the seller's conveyancer's statement.
 */
export function completionStatementsFromEvents(
  events: unknown,
  sellerConveyancer: string | null | undefined,
): CompletionStatementRecord[] {
  if (!sellerConveyancer || !Array.isArray(events)) return [];
  return events
    .map(statementEventOf)
    .filter((s): s is CompletionStatementRecord => s !== null && s.uploadedBy === sellerConveyancer)
    .sort((a, b) => a.uploadedAt.getTime() - b.uploadedAt.getTime());
}

/** The latest of them, or null. */
export function completionStatementFromEvents(
  events: unknown,
  sellerConveyancer: string | null | undefined,
): CompletionStatementRecord | null {
  const statements = completionStatementsFromEvents(events, sellerConveyancer);
  return statements.length > 0 ? statements[statements.length - 1] : null;
}

/**
 * Which statement completion records. The first side's confirmation fixes it:
 * the latest statement uploaded at or before that moment. Both sides send
 * that one (the canister stores the completing side's hash), so a statement
 * uploaded later is never the recorded one. While nobody has confirmed, the
 * latest statement is the one that will be used.
 */
export interface StatementView {
  recorded: CompletionStatementRecord | null;
  /** The latest statement uploaded after the first confirmation, if any. */
  late: CompletionStatementRecord | null;
}

function lastOf(statements: CompletionStatementRecord[]): CompletionStatementRecord | null {
  return statements.length > 0 ? statements[statements.length - 1] : null;
}

export function statementView(statements: CompletionStatementRecord[], firstConfirmedAt: number | null): StatementView {
  if (firstConfirmedAt === null) return { recorded: lastOf(statements), late: null };
  return {
    recorded: lastOf(statements.filter((s) => s.uploadedAt.getTime() <= firstConfirmedAt)),
    late: lastOf(statements.filter((s) => s.uploadedAt.getTime() > firstConfirmedAt)),
  };
}

/** The earliest side confirmation, in ms, or null when nobody has confirmed. */
export function firstConfirmedAtMs(times: Array<number | null | undefined>): number | null {
  const known = times.filter((t): t is number => typeof t === 'number' && Number.isFinite(t));
  return known.length > 0 ? Math.min(...known) : null;
}

export const STATEMENT_UNREADABLE = 'Could not check for a completion statement. Please try again.';
export const STATEMENT_UNATTRIBUTED =
  "The seller's conveyancer on this deal could not be confirmed, so the completion statement cannot be checked. Please contact support.";
export const NO_STATEMENT_WARNING =
  "No completion statement has been uploaded. The deal details will be recorded instead, and a statement can't be added after this.";

/** Why completion cannot pick a statement hash; the message is shown as written. */
export class CompletionStatementCheckError extends Error {}

export interface CompletionContext {
  /** The seller solicitor slot's principal, if it could be read. */
  sellerConveyancer: string | null | undefined;
  /** The canister reports a verified conveyancer acting for the seller. */
  isSellerConveyancerActing: boolean;
  firstConfirmedAt: number | null;
}

/**
 * The statement hash completion must anchor, or null for the deal-facts
 * fallback. With no seller's conveyancer on the deal, statements are ignored.
 * Throws when one is acting but cannot be resolved, or the trail cannot be
 * read: both sides must anchor the same hash.
 */
export function statementHashForCompletion(events: unknown, context: CompletionContext): string | null {
  if (!context.sellerConveyancer) {
    if (context.isSellerConveyancerActing) throw new CompletionStatementCheckError(STATEMENT_UNATTRIBUTED);
    return null;
  }
  if (!Array.isArray(events)) throw new CompletionStatementCheckError(STATEMENT_UNREADABLE);
  const statements = completionStatementsFromEvents(events, context.sellerConveyancer);
  return statementView(statements, context.firstConfirmedAt).recorded?.fileHash ?? null;
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

/** Read the statements for display. Throws when the trail cannot be asked. */
export async function readCompletionStatements(
  transactionId: string,
  sellerConveyancer: string | null | undefined,
): Promise<CompletionStatementRecord[]> {
  if (!sellerConveyancer) return [];
  return completionStatementsFromEvents(await readEvents(transactionId), sellerConveyancer);
}

/** Read the trail at confirm time and pick the hash; throws CompletionStatementCheckError. */
export async function readStatementHashForCompletion(
  transactionId: string,
  context: CompletionContext,
): Promise<string | null> {
  if (!context.sellerConveyancer) return statementHashForCompletion([], context);
  return statementHashForCompletion(await readEvents(transactionId), context);
}

export function formatStatementDate(at: Date): string {
  return at.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** The client's read-only lines. */
export function completionStatementLines(view: StatementView, isConfirmed: boolean): string[] {
  const lines: string[] = [];
  if (view.recorded) {
    lines.push(`Completion statement: uploaded by the seller's conveyancer on ${formatStatementDate(view.recorded.uploadedAt)}. Its fingerprint is recorded on PropXchain.`);
  } else if (isConfirmed) {
    lines.push('Completion statement: none was uploaded before completion was confirmed, so the deal details were recorded instead.');
  } else {
    lines.push("Completion statement: not uploaded yet by the seller's conveyancer.");
  }
  if (view.late) {
    lines.push(`A statement uploaded on ${formatStatementDate(view.late.uploadedAt)}: uploaded after completion was confirmed — not the recorded statement.`);
  }
  return lines;
}
