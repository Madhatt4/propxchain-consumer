// PropXchain - Open Source Blockchain Property Conveyancing Platform
// Copyright (C) 2026 PropXchain Contributors
// SPDX-License-Identifier: Proprietary

/**
 * AI-scan contract types (v1) — the single shared output shape every scan
 * emits, mirrored from the deployed edge functions and the contract doc
 * (docs/plans/2026-07-18-ai-scan-contract.md in the monorepo).
 *
 * The three scans (hmlr / search / survey) all normalise to `ScanResult` so the
 * renderer is pure glue: it reads findings, an explainer, and a separate
 * conveyancer-only flags list — it never re-derives anything.
 */

export type Confidence = 'high' | 'medium' | 'low';

/** HMLR-only per-finding severity, carried through so the badge can show it. */
export type FindingSeverity = 'info' | 'attention' | 'action';

/** The contract finding. `personal_data` is the GDPR routing flag. */
export interface ScanFinding {
  key: string;
  label: string;
  value: string;
  /** GDPR flag — when true the value must NEVER be rendered in plain view. */
  personal_data: boolean;
  confidence: Confidence;
  provenance: string;
  /** Present only for HMLR-derived findings (info/attention/action). */
  severity?: FindingSeverity;
}

export type ScanType = 'property_data' | 'hmlr' | 'search' | 'survey';

/** The unified scan-output contract — the acceptance gate for every scan. */
export interface ScanResult {
  scan_type: ScanType;
  source_ref: string;
  findings: ScanFinding[];
  explainer: string;
  flags_for_conveyancer: string[];
}

/** Terminal status of a search/survey run — drives the "unsupported" UI state. */
export type ScanStatus = 'complete' | 'unsupported';

/** What the service invokers return: a terminal status + the result, or null. */
export interface ScanRunResult {
  status: ScanStatus;
  result: ScanResult;
}

// --- HMLR scan (the odd one out — a DIFFERENT shape we normalise) -------------

export type HmlrFindingCategory =
  | 'tenure'
  | 'charge'
  | 'restriction'
  | 'caution'
  | 'notice'
  | 'lease'
  | 'address'
  | 'general';

export interface HmlrScanFinding {
  category: HmlrFindingCategory;
  severity: FindingSeverity;
  title: string;
  detail: string;
}

export interface HmlrScanEnrichment {
  classOfTitle: string;
  tenure: string;
  chargesCount: number;
  hasRestrictions: boolean;
  leaseCount: number;
}

/** The `hmlr-scan` edge function's cached artifact (schemaVersion 1). */
export interface HmlrScanResult {
  titleNumber: string;
  editionDate: string;
  scannedAt: string;
  model: string;
  schemaVersion: 1;
  enrichment: HmlrScanEnrichment;
  findings: HmlrScanFinding[];
  sellerSummary: string;
  headlineFlags: string[];
}

/** HMLR severity → contract confidence (attention/action read more strongly). */
const SEVERITY_TO_CONFIDENCE: Record<FindingSeverity, Confidence> = {
  info: 'low',
  attention: 'medium',
  action: 'high',
};

/**
 * Map the HMLR scan's bespoke shape onto the unified contract:
 *   category → key, title → label, detail → value, severity → confidence
 *   (+ retained severity badge), sellerSummary → explainer,
 *   headlineFlags → flags_for_conveyancer.
 *
 * The HMLR scan is guaranteed non-PII server-side (proprietor names are stripped
 * before the LLM call and asserted out of the output), so every finding is
 * `personal_data: false`. Pure + exported for unit testing.
 */
export function normalizeHmlrToContract(hmlr: HmlrScanResult): ScanResult {
  return {
    scan_type: 'hmlr',
    // A pointer to the underlying register edition — not the register itself.
    source_ref: `hmlr:${hmlr.titleNumber}@${hmlr.editionDate}`,
    findings: hmlr.findings.map((f) => ({
      key: f.category,
      label: f.title,
      value: f.detail,
      personal_data: false,
      confidence: SEVERITY_TO_CONFIDENCE[f.severity] ?? 'low',
      provenance: `HM Land Registry title register (${hmlr.titleNumber})`,
      severity: f.severity,
    })),
    explainer: hmlr.sellerSummary,
    flags_for_conveyancer: hmlr.headlineFlags,
  };
}
