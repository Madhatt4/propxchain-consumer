// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * HMLR Register Extract — printable HTML view (Tier 1).
 *
 * Pure rendering component. Takes the structured register data returned
 * by hmlrTitleService and presents it as a printable, dashboard-embedded
 * document.
 *
 * Print: browser-native `window.print()`. `@media print` rules hide the
 * dashboard chrome (nav, sidebar, page controls) so the user gets a
 * clean register document on paper or PDF.
 *
 * Download: serialises this component's HTML to a self-contained file
 * the user can save offline.
 *
 * No PII handling beyond display — the canonical store is Supabase; this
 * component is a view layer.
 */

import { useCallback, useMemo } from 'react';
import type {
  HmlrRegisterExtract,
  HmlrProprietor,
  HmlrCharge,
} from '@/services/hmlrTitle.service';

// ============================================
// PROPS
// ============================================

export interface HMLRRegisterViewProps {
  register: HmlrRegisterExtract;
  /** SHA-256 of the canonical response — shown in the audit footer */
  responseHash: string;
  /** document_storage canister doc id — shown in the audit footer; null if write failed */
  canisterDocId: number | null;
  /** When the pull happened. Defaults to now. */
  pulledAt?: Date;
  /** When set, render in compact dashboard mode (no header chrome). Default false = full document. */
  embedded?: boolean;
}

// ============================================
// FORMATTERS
// ============================================

function formatDateIso(value: string | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function formatDateTime(value: string | Date | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function truncateHash(hash: string): string {
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 8)}…${hash.slice(-8)}`;
}

// ============================================
// SUB-COMPONENTS
// ============================================

function ProprietorsTable({ rows }: { rows: HmlrProprietor[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm italic text-gray-500">
        No proprietors recorded.
      </p>
    );
  }
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b-2 border-gray-800 text-left">
          <th className="px-2 py-2 font-semibold">#</th>
          <th className="px-2 py-2 font-semibold">Name</th>
          <th className="px-2 py-2 font-semibold">Address</th>
          <th className="px-2 py-2 font-semibold">Aliases</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((proprietor, index) => (
          <tr
            key={`${proprietor.name}-${index}`}
            className="border-b border-gray-200 align-top"
          >
            <td className="px-2 py-2 font-mono text-gray-600">{index + 1}</td>
            <td className="px-2 py-2 font-medium">{proprietor.name}</td>
            <td className="px-2 py-2">
              {proprietor.addresses.length > 0
                ? proprietor.addresses.join(', ')
                : '—'}
            </td>
            <td className="px-2 py-2 text-gray-600">
              {proprietor.aliases.length > 0
                ? proprietor.aliases.join('; ')
                : '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ChargesTable({ rows }: { rows: HmlrCharge[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm italic text-gray-500">No charges recorded.</p>
    );
  }
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b-2 border-gray-800 text-left">
          <th className="px-2 py-2 font-semibold">#</th>
          <th className="px-2 py-2 font-semibold">Date</th>
          <th className="px-2 py-2 font-semibold">Chargee</th>
          <th className="px-2 py-2 font-semibold">Description</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((charge) => (
          <tr
            key={charge.chargeId}
            className="border-b border-gray-200 align-top"
          >
            <td className="px-2 py-2 font-mono text-gray-600">
              {charge.chargeId}
            </td>
            <td className="px-2 py-2">{formatDateIso(charge.chargeDate)}</td>
            <td className="px-2 py-2 font-medium">{charge.chargee}</td>
            <td className="px-2 py-2">{charge.description}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function FlagsList({
  register,
}: {
  register: HmlrRegisterExtract;
}) {
  const items: Array<{ label: string; value: string; emphasis: boolean }> = [
    {
      label: 'Restrictions',
      value: register.hasRestrictions ? 'Present' : 'None',
      emphasis: register.hasRestrictions,
    },
    {
      label: 'Cautions',
      value: register.hasCautions ? 'Present' : 'None',
      emphasis: register.hasCautions,
    },
    {
      label: 'Notices',
      value: register.hasNotices ? 'Present' : 'None',
      emphasis: register.hasNotices,
    },
    {
      label: 'Leases',
      value: String(register.leaseCount),
      emphasis: register.leaseCount > 0,
    },
  ];
  return (
    <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="border-l-4 border-gray-300 pl-3">
          <dt className="text-xs uppercase tracking-wide text-gray-500">
            {item.label}
          </dt>
          <dd
            className={
              item.emphasis
                ? 'text-base font-semibold text-amber-700'
                : 'text-base text-gray-800'
            }
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

// ============================================
// MAIN VIEW
// ============================================

/**
 * The app's own compiled CSS, so the downloaded register keeps its styling
 * offline. It used to load cdn.tailwindcss.com, an unpinned third-party
 * script with no SRI running inside a saved legal document (security scan L9).
 * Cross-origin sheets throw on cssRules and are skipped.
 */
function pageCss(): string {
  return Array.from(document.styleSheets)
    .flatMap((sheet) => {
      try {
        return Array.from(sheet.cssRules, (rule) => rule.cssText);
      } catch {
        return [];
      }
    })
    .join('\n')
    // A stray </style in a rule would end the style block early.
    .replace(/<\/style/gi, '<\\/style');
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);
}

export default function HMLRRegisterView({
  register,
  responseHash,
  canisterDocId,
  pulledAt,
  embedded = false,
}: HMLRRegisterViewProps) {
  const generatedAt = pulledAt ?? new Date();

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const handleDownload = useCallback(() => {
    const html = document.getElementById('hmlr-register-doc')?.outerHTML;
    if (!html) return;
    const blob = new Blob(
      [
        '<!doctype html><html><head><meta charset="utf-8">' +
          `<title>HMLR Register — ${escapeHtml(register.titleNumber)}</title>` +
          `<style>${pageCss()}</style>` +
          '</head><body class="bg-white p-8">' +
          html +
          '</body></html>',
      ],
      { type: 'text/html;charset=utf-8' },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hmlr-register-${register.titleNumber}-${register.messageId}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }, [register.titleNumber, register.messageId]);

  const addressLine = useMemo(() => {
    if (register.registeredAddress) return register.registeredAddress;
    if (register.addressLines.length > 0) {
      return register.addressLines.join(', ');
    }
    return '—';
  }, [register.registeredAddress, register.addressLines]);

  return (
    <>
      {/* Print-time styling — hides dashboard chrome on print */}
      <style>{`
        @media print {
          @page { margin: 16mm; }
          body * { visibility: hidden; }
          #hmlr-register-doc, #hmlr-register-doc * { visibility: visible; }
          #hmlr-register-doc { position: absolute; top: 0; left: 0; width: 100%; }
          .hmlr-no-print { display: none !important; }
        }
      `}</style>

      {/* Action bar — hidden in print */}
      {!embedded && (
        <div className="hmlr-no-print mb-4 flex items-center justify-end gap-2">
          <button
            onClick={handleDownload}
            type="button"
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Download HTML
          </button>
          <button
            onClick={handlePrint}
            type="button"
            className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800"
          >
            Print / Save as PDF
          </button>
        </div>
      )}

      {/* The document itself */}
      <article
        id="hmlr-register-doc"
        className="mx-auto max-w-4xl bg-white p-8 font-serif text-gray-900 shadow-sm ring-1 ring-gray-200 print:shadow-none print:ring-0"
      >
        <header className="border-b-4 border-gray-900 pb-4">
          <p className="text-xs uppercase tracking-widest text-gray-500">
            HM Land Registry — Official Copy with Summary
          </p>
          <h1 className="mt-1 font-sans text-3xl font-bold tracking-tight">
            Title Number {register.titleNumber}
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Issued via PropXchain · Official Copy date{' '}
            {formatDateTime(register.officialCopyDateTime) ||
              formatDateTime(generatedAt)}
          </p>
        </header>

        <section className="mt-6 grid grid-cols-2 gap-x-8 gap-y-3 font-sans text-sm sm:grid-cols-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">
              Class of title
            </p>
            <p className="text-base font-medium">{register.classOfTitle}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">
              Tenure
            </p>
            <p className="text-base font-medium">{register.tenure}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">
              Edition date
            </p>
            <p className="text-base font-medium">
              {formatDateIso(register.editionDate)}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">
              Message ID
            </p>
            <p className="text-base font-mono">{register.messageId}</p>
          </div>
        </section>

        <section className="mt-8 font-sans">
          <h2 className="border-b border-gray-300 pb-1 text-sm font-semibold uppercase tracking-wide text-gray-700">
            A. Property
          </h2>
          <p className="mt-3 text-base leading-relaxed">{addressLine}</p>
        </section>

        <section className="mt-8 font-sans">
          <h2 className="border-b border-gray-300 pb-1 text-sm font-semibold uppercase tracking-wide text-gray-700">
            B. Proprietorship
          </h2>
          <div className="mt-3">
            <ProprietorsTable rows={register.proprietors} />
          </div>
        </section>

        <section className="mt-8 font-sans">
          <h2 className="border-b border-gray-300 pb-1 text-sm font-semibold uppercase tracking-wide text-gray-700">
            C. Charges
          </h2>
          <div className="mt-3">
            <ChargesTable rows={register.charges} />
          </div>
        </section>

        <section className="mt-8 font-sans">
          <h2 className="border-b border-gray-300 pb-1 text-sm font-semibold uppercase tracking-wide text-gray-700">
            D. Restrictions, cautions and notices
          </h2>
          <div className="mt-3">
            <FlagsList register={register} />
          </div>
        </section>

        {register.titlePlanZipBase64 && (
          <section className="mt-8 font-sans">
            <h2 className="border-b border-gray-300 pb-1 text-sm font-semibold uppercase tracking-wide text-gray-700">
              E. Title plan
            </h2>
            <p className="mt-3 text-sm text-gray-600">
              Title plan archive included with this pull. Open from the
              transaction document list to view the plan PDF.
            </p>
          </section>
        )}

        <footer className="mt-12 border-t-2 border-gray-300 pt-4 font-sans text-xs text-gray-500">
          <p className="mb-2 font-medium text-gray-700">
            Tamper-proof audit anchor
          </p>
          <dl className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            <div>
              <dt className="inline font-medium">Response hash:</dt>{' '}
              <dd className="inline font-mono" title={responseHash}>
                {truncateHash(responseHash)}
              </dd>
            </div>
            <div>
              <dt className="inline font-medium">Canister doc id:</dt>{' '}
              <dd className="inline font-mono">
                {canisterDocId !== null
                  ? `#${canisterDocId}`
                  : 'pending — see warnings'}
              </dd>
            </div>
            <div>
              <dt className="inline font-medium">Pulled at:</dt>{' '}
              <dd className="inline">{formatDateTime(generatedAt)}</dd>
            </div>
            <div>
              <dt className="inline font-medium">Source:</dt>{' '}
              <dd className="inline">HMLR Business Gateway via PropXchain</dd>
            </div>
          </dl>
          <p className="mt-3 italic">
            This document is a rendered view of the canonical HMLR response.
            The response hash above is recorded on the Internet Computer
            blockchain — any modification to the underlying data would
            invalidate the hash and be detectable on-chain.
          </p>
        </footer>
      </article>
    </>
  );
}
