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

async function sha256Hex(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function buildCompletionHashes(
  input: CompletionHashInput,
  now: Date = new Date(),
): Promise<CompletionHashes> {
  const at = now.toISOString();
  const fundsHash = await sha256Hex({
    transactionId: input.transactionId,
    amount: input.purchasePrice,
    timestamp: at,
  });
  const completionHash = await sha256Hex({
    transactionId: input.transactionId,
    propertyAddress: input.propertyAddress,
    completionDate: at,
    purchasePrice: input.purchasePrice,
  });
  return { fundsHash, completionHash };
}
