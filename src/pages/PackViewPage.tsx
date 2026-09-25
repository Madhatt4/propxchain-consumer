// PropXchain - Open Source Blockchain Property Conveyancing Platform
// Copyright (C) 2026 PropXchain Contributors
// SPDX-License-Identifier: Proprietary

/**
 * Public sales-pack view — /pack/:token (decision: Madhatt4/Propxchain#116).
 *
 * Anonymous, read-only, noindex. Renders whatever the pack-view edge
 * function returns for the token; a revoked or unknown token shows one
 * neutral "not available" state (the function 404s both identically).
 * The snapshot arrives pre-redacted — this page adds no filtering and
 * must never fetch anything beyond the one edge-function call.
 */
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Circle, Package, ShieldCheck } from 'lucide-react';
import { fetchSharedPack } from '@/services/packShare.service';
import type { PackSnapshot } from '@/types/packShare.types';

function poundsFrom(price: number): string {
  return `£${price.toLocaleString('en-GB')}`;
}

function Fact({ label, value }: { label: string; value: string | null | undefined }): JSX.Element | null {
  if (value == null || value === '') return null;
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-500">{label}</dt>
      <dd className="text-sm font-semibold text-gray-900 dark:text-gray-100">{value}</dd>
    </div>
  );
}

/** Generic, read-only rendering of a redacted form section's fields. */
function SectionDump({ data }: { data: unknown }): JSX.Element {
  return (
    <pre className="overflow-x-auto rounded-lg bg-gray-50 p-3 text-xs leading-relaxed text-gray-700 dark:bg-white/[0.04] dark:text-gray-300">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

export default function PackViewPage(): JSX.Element {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<'loading' | 'missing' | 'ready'>('loading');
  const [snapshot, setSnapshot] = useState<PackSnapshot | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string>('');

  useEffect(() => {
    // Shared links are private by intent — keep them out of search indexes.
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex';
    document.head.appendChild(meta);
    return () => {
      document.head.removeChild(meta);
    };
  }, []);

  useEffect(() => {
    let active = true;
    setState('loading');
    if (!token) {
      setState('missing');
      return;
    }
    void fetchSharedPack(token).then((result) => {
      if (!active) return;
      if (!result) {
        setState('missing');
        return;
      }
      setSnapshot(result.snapshot);
      setUpdatedAt(result.updatedAt);
      setState('ready');
    });
    return () => {
      active = false;
    };
  }, [token]);

  if (state === 'loading') {
    return (
      <main className="mx-auto max-w-3xl px-5 py-16 text-center text-sm text-gray-500 dark:text-gray-400">
        Opening the sales pack…
      </main>
    );
  }

  if (state === 'missing' || !snapshot) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-16 text-center">
        <Package className="mx-auto h-8 w-8 text-gray-300 dark:text-slate-600" aria-hidden="true" />
        <h1 className="mt-3 text-lg font-bold text-gray-900 dark:text-gray-100">
          This sales pack isn&apos;t available
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          The link may have been revoked by the seller, or the address was
          mistyped. Ask the seller for a fresh link.
        </p>
      </main>
    );
  }

  const p = snapshot.property;
  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <header className="rounded-xl border border-gray-200 bg-white p-5 dark:border-slate-700/60 dark:bg-white/[0.03]">
        <div className="flex items-center gap-2.5">
          <Package className="h-5 w-5 text-teal-600 dark:text-teal-400" aria-hidden="true" />
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Sales pack</h1>
        </div>
        {p && (
          <>
            <p className="mt-1 text-base font-semibold text-gray-900 dark:text-gray-100">
              {p.address}
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Fact label="Asking price" value={poundsFrom(p.price)} />
              <Fact label="Tenure" value={p.tenure} />
              <Fact label="EPC" value={p.epcRating} />
              <Fact label="Council tax" value={p.councilTaxBand} />
              <Fact label="Type" value={p.propertyType} />
              <Fact label="UPRN" value={p.uprn} />
              {p.tenure === 'leasehold' && (
                <>
                  <Fact label="Lease years left" value={p.leaseYearsRemaining?.toString()} />
                  <Fact label="Ground rent" value={p.groundRentPerYear != null ? `£${p.groundRentPerYear}/yr` : null} />
                  <Fact label="Service charge" value={p.serviceChargePerYear != null ? `£${p.serviceChargePerYear}/yr` : null} />
                </>
              )}
            </dl>
          </>
        )}
        <p className="mt-3 text-[11px] text-gray-500 dark:text-slate-500">
          Shared read-only by the seller via PropXchain
          {updatedAt && ` · updated ${new Date(updatedAt).toLocaleDateString('en-GB')}`}.
          Personal details are removed before sharing.
        </p>
        {/* No PDTF download here: the export runs server-side as a party to
            the deal (pdtf-export), and this page is anonymous. Sellers export
            from the share card on their Sales Pack tab. */}
      </header>

      <section className="mt-4 rounded-xl border border-gray-200 bg-white p-5 dark:border-slate-700/60 dark:bg-white/[0.03]">
        <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">What&apos;s in the pack</h2>
        <ul className="mt-2 divide-y divide-gray-100 dark:divide-slate-700/40">
          {snapshot.items.map((item) => (
            <li key={item.id} className="flex items-start gap-3 py-2.5">
              {item.done ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-teal-600 dark:text-teal-400" aria-hidden="true" />
              ) : (
                <Circle className="mt-0.5 h-5 w-5 shrink-0 text-gray-300 dark:text-slate-600" aria-hidden="true" />
              )}
              <div className="min-w-0">
                <p className="text-sm text-gray-900 dark:text-gray-100">{item.label}</p>
                {item.verification?.verified && (
                  <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-teal-700 dark:text-teal-300">
                    <ShieldCheck className="h-3 w-3 shrink-0" aria-hidden="true" />
                    {item.verification.note ?? 'Verified on-chain'}
                    {item.verification.anchoredAt &&
                      ` · ${new Date(item.verification.anchoredAt).toLocaleDateString('en-GB')}`}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {snapshot.titleSummary && (
        <section className="mt-4 rounded-xl border border-gray-200 bg-white p-5 dark:border-slate-700/60 dark:bg-white/[0.03]">
          <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">Title register summary</h2>
          <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Fact label="Title number" value={snapshot.titleSummary.titleNumber} />
            <Fact label="Class of title" value={snapshot.titleSummary.classOfTitle} />
            <Fact label="Tenure" value={snapshot.titleSummary.tenure} />
            <Fact label="Edition date" value={snapshot.titleSummary.editionDate} />
            <Fact label="Charges" value={snapshot.titleSummary.hasCharges == null ? null : snapshot.titleSummary.hasCharges ? 'Yes' : 'None'} />
            <Fact label="Restrictions" value={snapshot.titleSummary.hasRestrictions == null ? null : snapshot.titleSummary.hasRestrictions ? 'Yes' : 'None'} />
          </dl>
        </section>
      )}

      <section className="mt-4 rounded-xl border border-gray-200 bg-white p-5 dark:border-slate-700/60 dark:bg-white/[0.03]">
        <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">Property searches</h2>
        <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
          {snapshot.searches.back
            ? `Results received${snapshot.searches.returnedAt ? ` on ${new Date(snapshot.searches.returnedAt).toLocaleDateString('en-GB')}` : ''}${snapshot.searches.productCodes?.length ? ` (${snapshot.searches.productCodes.join(', ')})` : ''}.`
            : snapshot.searches.ordered
              ? 'Ordered — results pending.'
              : 'Not ordered yet.'}
        </p>
      </section>

      {snapshot.ta6 && (
        <section className="mt-4 rounded-xl border border-gray-200 bg-white p-5 dark:border-slate-700/60 dark:bg-white/[0.03]">
          <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">
            TA6 property information (personal details removed)
          </h2>
          <details className="mt-2">
            <summary className="cursor-pointer text-sm font-semibold text-teal-700 dark:text-teal-300">
              View the seller&apos;s answers
            </summary>
            <div className="mt-2">
              <SectionDump data={snapshot.ta6} />
            </div>
          </details>
        </section>
      )}

      {snapshot.ta10 && (
        <section className="mt-4 rounded-xl border border-gray-200 bg-white p-5 dark:border-slate-700/60 dark:bg-white/[0.03]">
          <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">
            TA10 fittings &amp; contents
          </h2>
          <details className="mt-2">
            <summary className="cursor-pointer text-sm font-semibold text-teal-700 dark:text-teal-300">
              View what&apos;s included in the sale
            </summary>
            <div className="mt-2">
              <SectionDump data={snapshot.ta10} />
            </div>
          </details>
        </section>
      )}

      {snapshot.extraDocuments.length > 0 && (
        <section className="mt-4 rounded-xl border border-gray-200 bg-white p-5 dark:border-slate-700/60 dark:bg-white/[0.03]">
          <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">Other documents held</h2>
          <ul className="mt-2 list-inside list-disc text-sm text-gray-700 dark:text-gray-300">
            {snapshot.extraDocuments.map((d) => (
              <li key={d.fileName}>
                {d.kind && <span className="font-semibold">{d.kind}: </span>}
                {d.fileName}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[11px] text-gray-500 dark:text-slate-500">
            Held by the seller — ask them or their conveyancer for copies.
          </p>
        </section>
      )}
    </main>
  );
}
