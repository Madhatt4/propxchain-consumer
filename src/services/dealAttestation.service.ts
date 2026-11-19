// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Asks the `deal-attest` edge function to put a Supabase-held deal fact on the
 * deal's ledger. The browser cannot write the ledger itself (ledger_manager
 * only accepts registered canisters), so the server reads the row, builds the
 * event and writes it. The browser sends ids only: never notes, reasons or
 * hashes, because the server works those out from the row it reads.
 */

import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';

export const DEAL_ATTEST_FUNCTION = 'deal-attest';

export type DealAttestationRequest =
  | { kind: 'search_signoff'; signOffId: string }
  | { kind: 'search_signoff_revoked'; signOffId: string }
  | { kind: 'plot_claim'; transactionId: string };

export interface DealAttestationResult {
  recorded: true;
  eventId?: string;
  alreadyRecorded?: boolean;
}

export class DealAttestationError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string) {
    super(`${DEAL_ATTEST_FUNCTION} ${status}: ${code}`);
    this.name = 'DealAttestationError';
    this.status = status;
    this.code = code;
  }
}

interface FunctionsInvokeError {
  message: string;
  context?: { status?: number; json?: () => Promise<Record<string, unknown>> };
}

async function toAttestationError(error: FunctionsInvokeError): Promise<DealAttestationError> {
  const status = error.context?.status ?? 0;
  try {
    const body = (await error.context?.json?.()) as { error?: unknown } | undefined;
    return new DealAttestationError(status, typeof body?.error === 'string' ? body.error : error.message);
  } catch {
    return new DealAttestationError(status, error.message);
  }
}

/** Record one deal fact on the ledger. Throws DealAttestationError when the server refuses. */
export async function attestDealEvent(request: DealAttestationRequest): Promise<DealAttestationResult> {
  const { data, error } = await supabase.functions.invoke<DealAttestationResult>(DEAL_ATTEST_FUNCTION, {
    body: request,
  });
  if (error) throw await toAttestationError(error as FunctionsInvokeError);
  if (!data?.recorded) throw new DealAttestationError(0, 'empty response');
  return data;
}

/**
 * Fire-and-forget form for callers whose own action has already succeeded:
 * a failed audit write must never fail the user's action. Logs the kind and
 * the error code only.
 */
export function recordDealAttestation(request: DealAttestationRequest): void {
  void attestDealEvent(request).catch((err: unknown) => {
    const code = err instanceof DealAttestationError ? err.code : 'invoke_failed';
    logger.warn('[dealAttest] attestation not recorded', { kind: request.kind, code });
  });
}
