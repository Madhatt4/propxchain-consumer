// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * AI-scan service — thin client over the three deployed scan edge functions
 * (`hmlr-scan`, `search-scan`, `survey-scan`). Mirrors companies-house.service:
 * `supabase.functions.invoke` auto-attaches the user's JWT, and every call
 * returns its result or `null` on any error rather than throwing.
 *
 * The scan documents (search/survey PDFs) contain potential PII, so nothing in
 * this module ever logs scan content.
 */

import { supabase } from '../lib/supabase';
import type { HmlrRegisterExtract } from './hmlrTitle.service';
import type { OneSearchScanBundle } from './onesearchResults';
import type {
  HmlrScanResult,
  ScanResult,
  ScanRunResult,
  ScanStatus,
} from '../types/scan.types';

// --- Edge-function response envelopes ----------------------------------------

interface SearchScanEnvelope {
  cached?: boolean;
  status?: string;
  scan?: ScanResult;
}

interface HmlrScanEnvelope {
  cached?: boolean;
  status?: string;
  scan?: HmlrScanResult;
}

// --- Groundsure single-document bundle (B1 option a) -------------------------
// The consumer has only ONE manually-uploaded search PDF (provider ordering is
// disabled). The deployed `search-scan` normalises a Groundsure bundle to one
// document when given `reports: [{ contentBase64, ... }]`, so we wrap the manual
// PDF as the smallest supported bundle that returns real findings.

const PDF_MEDIA_TYPE = 'application/pdf' as const;

interface GroundsureReport {
  productType: string;
  contentBase64: string;
  filename?: string;
  mimeType: string;
}

export interface SearchScanBundle {
  reports: GroundsureReport[];
}

/**
 * Build the smallest Groundsure bundle that normalises to exactly one document.
 * Pure + exported for unit testing. `productType` labels the doc for the model
 * (LLC1/CON29 content lives in one uploaded search PDF).
 */
export function buildManualSearchBundle(
  contentBase64: string,
  filename?: string,
  productType = 'LLC1CON29',
): SearchScanBundle {
  return {
    reports: [
      {
        productType,
        contentBase64,
        mimeType: PDF_MEDIA_TYPE,
        ...(filename ? { filename } : {}),
      },
    ],
  };
}

// --- Base64 helpers ----------------------------------------------------------

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000; // avoid call-stack limits on large PDFs
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/** Read a freshly-selected File as a bare base64 string (no data-URL prefix). */
export async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  return bytesToBase64(new Uint8Array(buffer));
}

/**
 * Download a stored PDF from Supabase storage and return it as bare base64.
 * Returns null on any error (missing object, RLS denial, network).
 */
export async function storedDocToBase64(
  bucket: string,
  path: string,
): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage.from(bucket).download(path);
    if (error || !data) return null;
    const buffer = await data.arrayBuffer();
    return bytesToBase64(new Uint8Array(buffer));
  } catch {
    return null;
  }
}

// --- Scan invokers -----------------------------------------------------------

function toRunResult(status: string | undefined, scan: ScanResult): ScanRunResult {
  const terminal: ScanStatus = status === 'unsupported' ? 'unsupported' : 'complete';
  return { status: terminal, result: scan };
}

interface RunSearchScanCommon {
  sourceRef: string;
  propertyRef?: string;
  transactionId?: string;
}

/** A single PDF the user picked off their own machine. */
export interface RunManualSearchScanInput extends RunSearchScanCommon {
  contentBase64: string;
  filename?: string;
  productType?: string;
}

/**
 * A bundle assembled from a provider's own returned results — currently
 * OneSearch, read out of `onesearch_orders` by `onesearchResults.ts`. This
 * takes the provider's real normaliser server-side (`normalizeOneSearch`),
 * which keeps multi-product bundles intact and labels each document with its
 * true PISCES product code instead of flattening everything through the
 * single-PDF manual path.
 */
export interface RunProviderSearchScanInput extends RunSearchScanCommon {
  provider: 'onesearch';
  bundle: OneSearchScanBundle;
}

export type RunSearchScanInput = RunManualSearchScanInput | RunProviderSearchScanInput;

function isProviderBundleInput(
  input: RunSearchScanInput,
): input is RunProviderSearchScanInput {
  return 'bundle' in input;
}

export async function runSearchScan(
  input: RunSearchScanInput,
): Promise<ScanRunResult | null> {
  try {
    // A manual upload stays on the groundsure normaliser: it accepts a bare
    // PDF list, which is exactly what one hand-picked file is.
    const { provider, bundle } = isProviderBundleInput(input)
      ? { provider: input.provider, bundle: input.bundle as unknown }
      : {
          provider: 'groundsure',
          bundle: buildManualSearchBundle(
            input.contentBase64,
            input.filename,
            input.productType,
          ) as unknown,
        };
    const { data, error } = await supabase.functions.invoke<SearchScanEnvelope>(
      'search-scan',
      {
        body: {
          provider,
          sourceRef: input.sourceRef,
          ...(input.propertyRef ? { propertyRef: input.propertyRef } : {}),
          ...(input.transactionId ? { transactionId: input.transactionId } : {}),
          bundle,
        },
      },
    );
    if (error || !data?.scan) return null;
    return toRunResult(data.status, data.scan);
  } catch {
    return null;
  }
}

export interface RunSurveyScanInput {
  sourceRef: string;
  contentBase64: string;
  propertyRef?: string;
  transactionId?: string;
  filename?: string;
  ricsLevel?: number | string;
}

export async function runSurveyScan(
  input: RunSurveyScanInput,
): Promise<ScanRunResult | null> {
  try {
    const { data, error } = await supabase.functions.invoke<SearchScanEnvelope>(
      'survey-scan',
      {
        body: {
          sourceRef: input.sourceRef,
          contentBase64: input.contentBase64,
          mediaType: PDF_MEDIA_TYPE,
          ...(input.propertyRef ? { propertyRef: input.propertyRef } : {}),
          ...(input.transactionId ? { transactionId: input.transactionId } : {}),
          ...(input.filename ? { filename: input.filename } : {}),
          ...(input.ricsLevel !== undefined ? { ricsLevel: input.ricsLevel } : {}),
        },
      },
    );
    if (error || !data?.scan) return null;
    return toRunResult(data.status, data.scan);
  } catch {
    return null;
  }
}

/**
 * Read the AI HMLR scan for an already-pulled register. The scan is warmed
 * fire-and-forget at pull time and cached server-side on (titleNumber,
 * editionDate), so this is normally a cache read — it never re-charges.
 * Returns null on error or a non-renderable register (no scan data).
 */
export async function getHmlrScan(
  register: HmlrRegisterExtract,
  transactionId?: string,
): Promise<HmlrScanResult | null> {
  try {
    const { data, error } = await supabase.functions.invoke<HmlrScanEnvelope>(
      'hmlr-scan',
      {
        body: {
          register,
          ...(transactionId ? { transactionId } : {}),
        },
      },
    );
    if (error || !data?.scan) return null;
    return data.scan;
  } catch {
    return null;
  }
}
