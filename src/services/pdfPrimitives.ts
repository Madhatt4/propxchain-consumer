// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Shared PDF primitives for the Law Society form exports (TA6/TA7/TA10).
 *
 * Holds the render-agnostic pieces the form-specific layout builders depend
 * on: the section/row shape, the value formatters, and the content
 * verification hash. Kept separate from formExportService so both the thin
 * TA7/TA10 builders and the extracted TA6 layout modules can import them
 * without a circular dependency (and to keep every file under the 300-line cap).
 */

// ============================================
// Section shape
// ============================================

/** One PDF section: a heading and its label/value rows. */
export interface PdfSection {
  title: string;
  rows: Array<[label: string, value: string]>;
}

// ============================================
// Value formatters
// ============================================

export function formatYesNo(v: boolean | null | undefined): string {
  if (v === null || v === undefined) return 'Not answered';
  return v ? 'Yes' : 'No';
}

export function formatText(v: string | null | undefined): string {
  if (!v) return '—';
  return String(v);
}

export function formatNumber(v: number | null | undefined, suffix: string = ''): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return `${v}${suffix}`;
}

export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return '—';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 2,
  }).format(amount);
}

// ============================================
// Verification hash
// ============================================

/**
 * Canonical JSON: sort keys recursively so the same object always
 * serialises the same way regardless of key insertion order.
 */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      sorted[key] = canonicalize(obj[key]);
    }
    return sorted;
  }
  return value;
}

function hexFromBytes(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** SHA-256 hash of the canonicalised JSON. Stable and portable. */
export async function generateVerificationHash(form: unknown): Promise<string> {
  const canonical = JSON.stringify(canonicalize(form));
  const encoded = new TextEncoder().encode(canonical);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return hexFromBytes(new Uint8Array(digest));
}

// ============================================
// Browser download
// ============================================

/**
 * Convenience: trigger a browser download for a generated Blob. Caller
 * provides the filename. No-op in non-browser environments.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  if (typeof window === 'undefined' || !window.URL || typeof document === 'undefined') return;
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Best-effort cleanup; browsers are lenient about timing
  window.URL.revokeObjectURL(url);
}
