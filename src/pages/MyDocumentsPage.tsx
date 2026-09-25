// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * MyDocumentsPage — the user's PropXchain Wallet (holding wallet). Six
 * principal-scoped slots (4 pinned: AML/SoF, identity, mortgage offer, proof of
 * ownership; 2 user-named custom), each holding many files. Files live in
 * owner-only account storage so the wallet follows the user across devices;
 * only each file's SHA-256 hash is anchored on-chain.
 */
import { useEffect, useState } from 'react';
import { Wallet } from 'lucide-react';
import AppTopBar from '@/components/navigation/AppTopBar';
import { WalletDocumentUpload } from '../components/wallet/WalletDocumentUpload';
import { WalletMigrationBanner } from '../components/wallet/WalletMigrationBanner';
import { vaultDocumentService } from '../services/vaultDocument.service';
import { icpService } from '../services/icp.service';
import {
  VAULT_SLOTS,
  VAULT_SLOT_IDS,
  type VaultDocument,
  type VaultSlotId,
} from '../types/vault.types';
import { useSubscription } from '../hooks/useSubscription';
import { vaultFilesPerSlot, vaultTotalBytes } from '../constants/subscriptionFeatures';
import { logger } from '@/utils/logger';

const emptyBySlot = (): Record<VaultSlotId, VaultDocument[]> => {
  const out = {} as Record<VaultSlotId, VaultDocument[]>;
  for (const id of VAULT_SLOT_IDS) out[id] = [];
  return out;
};

export default function MyDocumentsPage(): JSX.Element {
  const [bySlot, setBySlot] = useState<Record<VaultSlotId, VaultDocument[]>>(emptyBySlot);
  const [principal, setPrincipal] = useState('');
  const [loading, setLoading] = useState(true);
  const { tier } = useSubscription();
  const caps = { maxFilesPerSlot: vaultFilesPerSlot(tier), maxTotalBytes: vaultTotalBytes(tier) };

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        await icpService.initialize();
        const p = await icpService.getUserPrincipal();
        const docs = await vaultDocumentService.listMyDocuments();
        if (!active) return;
        setPrincipal(p);
        const next = emptyBySlot();
        for (const d of docs) next[d.slotId].push(d);
        setBySlot(next);
      } catch (err) {
        logger.error('[vault] failed to load documents', err);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleStored = (doc: VaultDocument): void =>
    setBySlot((prev) => ({ ...prev, [doc.slotId]: [doc, ...prev[doc.slotId]] }));
  const handleRelabelled = (doc: VaultDocument): void =>
    setBySlot((prev) => ({
      ...prev,
      [doc.slotId]: prev[doc.slotId].map((d) => (d.id === doc.id ? doc : d)),
    }));
  const handleRemoved = (slotId: VaultSlotId, id: string): void =>
    setBySlot((prev) => ({
      ...prev,
      [slotId]: prev[slotId].filter((d) => d.id !== id),
    }));

  return (
    <div className="min-h-screen bg-background">
      <AppTopBar title="PropXchain Wallet" backTo="/dashboard" backLabel="Back to dashboard" />
      <main className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Wallet className="h-7 w-7" /> PropXchain Wallet
            </h2>
            <p className="text-muted-foreground mt-1">
              Upload the documents you reuse across deals. They&apos;re stored privately in your
              account, so your wallet follows you to any device — only a tamper-proof hash is
              written to the blockchain as your audit trail.
            </p>
          </div>

          <WalletMigrationBanner
            principal={principal}
            onMigrated={(docs) => docs.forEach(handleStored)}
          />

          <h3 className="mb-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Your documents
          </h3>
          <div className="space-y-2">
            {VAULT_SLOTS.map((slot) => (
              <WalletDocumentUpload
                key={slot.id}
                slot={slot}
                docs={bySlot[slot.id]}
                principal={principal}
                caps={caps}
                onStored={handleStored}
                onRemoved={handleRemoved}
                onRelabelled={handleRelabelled}
              />
            ))}
          </div>

          {loading && (
            <p className="text-sm text-muted-foreground">Loading your documents…</p>
          )}
        </div>
      </main>
    </div>
  );
}
