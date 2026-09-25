// PropXchain - Open Source Blockchain Property Conveyancing Platform
// Copyright (C) 2026 PropXchain Contributors
// SPDX-License-Identifier: Proprietary

/**
 * Share controls for the sales pack (decision: Madhatt4/Propxchain#116).
 * One active link per transaction: create copies it, refresh republishes
 * today's pack state, revoke kills it (the dead URL then 404s and holds
 * no snapshot). The link auto-refreshes once whenever this card mounts,
 * so a shared pack tracks the seller's progress without manual pushes.
 *
 * The PDTF download lives here rather than on the public pack page because
 * the export runs server-side as a party to the deal and writes a ledger
 * event; an anonymous viewer has no standing to trigger either.
 */
import { useEffect, useState } from 'react';
import { FileJson, Link2, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import {
  createShareLink,
  getMyShareLink,
  refreshShareLink,
  revokeShareLink,
  shareUrlFor,
} from '@/services/packShare.service';
import { PdtfExportError, downloadPdtfFile, exportPdtf } from '@/services/pdtfExport.service';
import type { PackShareLink } from '@/types/packShare.types';

export function PackShareCard({ transactionId }: { transactionId: string }): JSX.Element {
  const [link, setLink] = useState<PackShareLink | null>(null);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setChecked(false);
    setLink(null);
    void getMyShareLink(transactionId)
      .then(async (found) => {
        if (!active) return;
        setLink(found);
        setChecked(true);
        if (found) {
          // Opportunistic republish keeps a shared link honest — see header.
          await refreshShareLink(found).catch(() => undefined);
        }
      })
      .catch(() => {
        if (active) setChecked(true);
      });
    return () => {
      active = false;
    };
  }, [transactionId]);

  const copy = async (token: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(shareUrlFor(token));
      setNotice('Link copied.');
    } catch {
      setNotice(shareUrlFor(token));
    }
  };

  const handleCreate = async (): Promise<void> => {
    setBusy(true);
    setNotice(null);
    try {
      const created = await createShareLink(transactionId);
      setLink(created);
      await copy(created.token);
    } catch {
      setNotice('Could not create the link — please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleRefresh = async (): Promise<void> => {
    if (!link) return;
    setBusy(true);
    setNotice(null);
    try {
      await refreshShareLink(link);
      setNotice('Shared pack updated to today’s state.');
    } catch {
      setNotice('Could not update the shared pack.');
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = async (): Promise<void> => {
    if (!link) return;
    setBusy(true);
    setNotice(null);
    try {
      await revokeShareLink(link);
      setLink(null);
      setNotice('Link revoked — it no longer opens for anyone.');
    } catch {
      setNotice('Could not revoke the link.');
    } finally {
      setBusy(false);
    }
  };

  const handlePdtf = async (): Promise<void> => {
    setBusy(true);
    setNotice(null);
    try {
      const exported = await exportPdtf(transactionId);
      downloadPdtfFile(exported);
      const gaps = exported.omissions.length;
      setNotice(
        exported.ledger.recorded
          ? `PDTF export downloaded and recorded on the audit trail${gaps ? ` (${gaps} answers could not be carried)` : ''}.`
          : 'PDTF export downloaded, but the audit-trail record failed.',
      );
    } catch (e) {
      const code = e instanceof PdtfExportError ? e.code : 'unknown';
      setNotice(
        code === 'forbidden'
          ? 'Only a party to this transaction can export it.'
          : code === 'rate_limited'
            ? 'Too many exports — try again in a while.'
            : 'Could not build the PDTF export — please try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-slate-700/60 dark:bg-white/[0.03]">
      <div className="flex items-center gap-2">
        <Link2 className="h-4 w-4 text-teal-600 dark:text-teal-400" aria-hidden="true" />
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Share this pack</p>
      </div>
      <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
        A read-only link for buyers and conveyancers before they join: searches,
        title summary, EPC, material information and your TA6/TA10 answers with
        all personal details removed. Your identity documents are never included.
        Revoke it any time and the link dies.
      </p>

      {checked && link && (
        <p className="mt-2 break-all rounded-lg bg-gray-50 px-3 py-2 font-mono text-xs text-gray-700 dark:bg-white/[0.04] dark:text-gray-300">
          {shareUrlFor(link.token)}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {checked && !link && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleCreate()}
            className="rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-700 disabled:opacity-50"
          >
            {busy ? 'Creating…' : 'Create share link'}
          </button>
        )}
        {link && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => void copy(link.token)}
              className="rounded-lg border border-teal-600/40 px-3 py-2 text-sm font-semibold text-teal-700 transition-colors hover:bg-teal-500/[0.08] disabled:opacity-50 dark:text-teal-300"
            >
              Copy link
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleRefresh()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-slate-600 dark:text-gray-300 dark:hover:bg-white/[0.04]"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Update shared copy
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleRevoke()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-50 disabled:opacity-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-900/20"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              Revoke
            </button>
          </>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => void handlePdtf()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-slate-600 dark:text-gray-300 dark:hover:bg-white/[0.04]"
        >
          <FileJson className="h-3.5 w-3.5" aria-hidden="true" />
          Download as PDTF JSON
        </button>
        {notice && <p className="text-xs text-gray-600 dark:text-gray-400">{notice}</p>}
      </div>

      <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-slate-500">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-teal-600 dark:text-teal-400" aria-hidden="true" />
        Viewers see each item&apos;s on-chain verification status alongside the content.
      </p>
    </div>
  );
}
