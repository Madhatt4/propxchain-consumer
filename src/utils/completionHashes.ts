// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The two SHA-256 anchors initiate_blockchain_completion takes: one over the
 * completion funds, one over the completion statement. Shared by the
 * exchange page and the completion stage so both write the same shapes.
 */

export interface CompletionHashInput {
  transactionId: string;
  propertyAddress: string;
  purchasePrice: number;
}

export interface CompletionHashes {
  fundsHash: string;
  completionHash: string;
}

// Placeholders the UI shows when the real address is unknown.
const PLACEHOLDER_ADDRESSES: ReadonlySet<string> = new Set(['', 'unknown property', 'address not available']);

/**
 * The hash input, or null when the agreed price or the address is missing.
 * An anchor over £0 or a placeholder address would record a fact that is
 * not true, so the caller must refuse to confirm rather than default.
 */
export function completionHashInputOf(
  transactionId: string | undefined,
  propertyAddress: string | undefined,
  purchasePrice: number | undefined,
): CompletionHashInput | null {
  const address = (propertyAddress ?? '').trim();
  if (!transactionId || PLACEHOLDER_ADDRESSES.has(address.toLowerCase())) return null;
  if (purchasePrice === undefined || !Number.isFinite(purchasePrice) || purchasePrice <= 0) return null;
  return { transactionId, propertyAddress: address, purchasePrice };
}

async function sha256Hex(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * `statementHash` is the SHA-256 of the completion statement file the
 * seller's conveyancer uploaded. When there is one it is the anchor; the
 * hash of the deal facts is only the fallback for a deal with no statement.
 */
export async function buildCompletionHashes(
  input: CompletionHashInput,
  now: Date = new Date(),
  statementHash: string | null = null,
): Promise<CompletionHashes> {
  const at = now.toISOString();
  const fundsHash = await sha256Hex({
    transactionId: input.transactionId,
    amount: input.purchasePrice,
    timestamp: at,
  });
  if (statementHash) return { fundsHash, completionHash: statementHash };
  const completionHash = await sha256Hex({
    transactionId: input.transactionId,
    propertyAddress: input.propertyAddress,
    completionDate: at,
    purchasePrice: input.purchasePrice,
  });
  return { fundsHash, completionHash };
}
