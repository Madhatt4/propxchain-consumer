// PropXchain - Open Source Blockchain Property Conveyancing Platform
// Copyright (C) 2026 PropXchain Contributors
// SPDX-License-Identifier: Proprietary

/**
 * PDTF export through the `pdtf-export` edge function (monorepo
 * supabase/functions/pdtf-export). The function is the one mapping layer
 * between PropXchain's transaction model and the Property Data Trust
 * Framework schema: it reads the transaction, forms, searches and shared
 * documents server-side, records a `pdtf_exported` ledger event carrying
 * the claim-set hash, and answers with the PDTF transaction plus verified
 * claims. The browser only downloads what comes back; nothing is mapped here.
 *
 * Only a party to the transaction may export (the function checks the
 * caller's role), so this is never offered on the anonymous pack view.
 */
import { supabase } from '../lib/supabase';

export const PDTF_EXPORT_FUNCTION = 'pdtf-export';
/** Written into the ledger event as the counterparty of a browser download. */
export const DOWNLOAD_COUNTERPARTY = 'propxchain-download';

export interface PdtfExportResponse {
  transaction: { propertyPack?: { address?: { postcode?: string } } } & Record<string, unknown>;
  claims: unknown[];
  claimSetHash: string;
  coverage: Record<string, boolean>;
  omissions: { path: string; reason: string; note?: string }[];
  validation: Record<string, unknown>;
  ledger: { recorded: boolean; error?: string };
  generator: Record<string, unknown>;
}

export class PdtfExportError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string) {
    super(`pdtf-export ${status}: ${code}`);
    this.name = 'PdtfExportError';
    this.status = status;
    this.code = code;
  }
}

interface FunctionsInvokeError {
  message: string;
  context?: { status?: number; json?: () => Promise<Record<string, unknown>> };
}

async function toExportError(error: FunctionsInvokeError): Promise<PdtfExportError> {
  const status = error.context?.status ?? 0;
  try {
    const body = (await error.context?.json?.()) as { error?: string } | undefined;
    return new PdtfExportError(status, typeof body?.error === 'string' ? body.error : error.message);
  } catch {
    return new PdtfExportError(status, error.message);
  }
}

/** One export of the transaction, as a party to it. Throws PdtfExportError on refusal. */
export async function exportPdtf(transactionId: string): Promise<PdtfExportResponse> {
  const { data, error } = await supabase.functions.invoke<PdtfExportResponse>(PDTF_EXPORT_FUNCTION, {
    body: { transactionId, counterparty: DOWNLOAD_COUNTERPARTY },
  });
  if (error) throw await toExportError(error as FunctionsInvokeError);
  if (!data) throw new PdtfExportError(0, 'empty response');
  return data;
}

/** `pdtf-<postcode>-<hash8>.json`, so two exports of the same deal never overwrite each other. */
export function pdtfFileName(response: PdtfExportResponse): string {
  const postcode = response.transaction.propertyPack?.address?.postcode?.replace(/\s+/g, '') || 'property';
  return `pdtf-${postcode}-${response.claimSetHash.slice(0, 8)}.json`;
}

/** Hands the export to the browser as a file download. */
export function downloadPdtfFile(response: PdtfExportResponse): void {
  const blob = new Blob([JSON.stringify(response, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = pdtfFileName(response);
  a.click();
  URL.revokeObjectURL(url);
}
