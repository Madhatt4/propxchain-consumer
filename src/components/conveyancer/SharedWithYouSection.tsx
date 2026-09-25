// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * SharedWithYouSection — conveyancer-portal delivery surface for Wallet docs
 * a party has shared with this conveyancer (share-wallet-docs Phase 3, #128).
 * Listing comes from the get_my_shared_docs RPC; the download itself is plain
 * Supabase storage gated by the shared_docs_require_grant RLS policy.
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { VAULT_SLOTS } from '@/types/vault.types';
import { logger } from '@/utils/logger';

const STORAGE_BUCKET: string = import.meta.env.VITE_HMLR_DOCUMENTS_BUCKET ?? 'propxchain-documents';

interface SharedDocRow {
  transaction_id: string;
  doc_hash: string;
  slot_id: string | null;
  object_path: string;
  created_at: string;
  expires_at?: string | null;
}

function accessEndsLabel(expiresAt: string | null | undefined): string {
  if (!expiresAt) return '';
  const days = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000));
  return ` · access ends ${new Date(expiresAt).toLocaleDateString('en-GB')} (${days} ${days === 1 ? 'day' : 'days'} left) — download your copy`;
}

function slotLabel(slotId: string | null): string {
  return VAULT_SLOTS.find((s) => s.id === slotId)?.label ?? 'Document';
}

export function SharedWithYouSection({ transactionId }: { transactionId: string }): JSX.Element {
  const [docs, setDocs] = useState<SharedDocRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data, error: rpcError } = await supabase.rpc('get_my_shared_docs', {
        p_transaction_id: transactionId,
      });
      if (!active) return;
      if (rpcError) {
        logger.error('[sharedWithYou] listing failed', rpcError);
        setError('Could not load shared documents.');
      } else {
        setDocs((data ?? []) as SharedDocRow[]);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [transactionId]);

  const handleDownload = async (row: SharedDocRow): Promise<void> => {
    setError(null);
    const { data, error: dlError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .download(row.object_path);
    if (dlError || !data) {
      logger.error('[sharedWithYou] download failed', dlError);
      setError('That document is no longer available — the share may have been revoked.');
      return;
    }
    const url = window.URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = row.object_path.split('/').pop() ?? 'document';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <section className="rounded-md border border-[#E5E7EB] bg-white p-6 dark:border-stone-700 dark:bg-stone-800">
      <div className="flex items-baseline justify-between">
        <h2 className="font-[Fraunces] text-lg font-semibold text-[#1A1A1A] dark:text-stone-100">
          Shared with you
        </h2>
        <span className="font-[DM_Sans] text-sm text-[#6B7280]">{docs.length}</span>
      </div>
      {error && <p className="mt-3 font-[DM_Sans] text-sm text-[#B45309]">{error}</p>}
      {loading ? (
        <p className="mt-3 font-[DM_Sans] text-sm text-[#6B7280]">Loading…</p>
      ) : docs.length === 0 ? (
        <p className="mt-3 font-[DM_Sans] text-sm text-[#6B7280]">
          No documents have been shared with you on this transaction yet.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-[#E5E7EB] dark:divide-stone-700">
          {docs.map((row) => (
            <li key={row.object_path} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-[DM_Sans] text-sm font-medium text-[#1A1A1A] dark:text-stone-100">
                  {slotLabel(row.slot_id)}
                </p>
                <p className="mt-0.5 font-[DM_Sans] text-xs text-[#6B7280]">
                  Shared {new Date(row.created_at).toLocaleDateString('en-GB')} · consent logged
                  on-chain{accessEndsLabel(row.expires_at)}
                </p>
              </div>
              <button
                onClick={() => void handleDownload(row)}
                className="flex-shrink-0 rounded-md border border-[#0D9488] px-3 py-1.5 font-[DM_Sans] text-sm font-medium text-[#0D9488] transition-colors hover:bg-[#0D9488] hover:text-white"
              >
                Download
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default SharedWithYouSection;
