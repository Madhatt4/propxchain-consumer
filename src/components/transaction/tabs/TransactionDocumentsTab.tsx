// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * TransactionDocumentsTab — the "Documents" sub-tab of a deal's Transaction
 * Wallet (wallet spec 2026-08-18). Lists the PropXchain Wallet documents the
 * user has explicitly SENT to this deal (decision 1); each carries a share
 * switch per party, grouped your side / other side (decision 5); a sent
 * document is private until a switch is on (decision 11). Grants whose file
 * has left the wallet are listed separately so they can still be closed.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, QrCode, UserPlus } from 'lucide-react';
import type { TransactionTabProps } from './transactionTabs.config';
import { icpService } from '@/services/icp.service';
import { vaultDocumentService } from '@/services/vaultDocument.service';
import { sharePartyService, splitBySide, type ShareParty, type DealSide } from '@/services/shareParty.service';
import { documentShareService, type ShareGrant } from '@/services/documentShare.service';
import { transactionWalletService, type SentItem } from '@/services/transactionWallet.service';
import { walletProofService, type ProofLink } from '@/services/walletProof.service';
import { applyCompletionLifecycle, type CompletionLifecycle } from '@/services/walletCompletion';
import { loadBuyerPack } from '@/services/buyerPack.service';
import type { VaultDocument } from '@/types/vault.types';
import { logger } from '@/utils/logger';
import { TransactionDocCard } from './TransactionDocCard';
import { AddFromWalletPicker, EmptyDealWallet } from './AddFromWalletPicker';
import { ProofQrPanel } from './ProofQrPanel';
import { CompletionNotice } from './CompletionNotice';
import { OrphanGrantsList } from './OrphanGrantsList';
import { buildDocHistory } from './docHistory';
import { grantKey } from './grantKey';

interface Notice {
  kind: 'error' | 'warning';
  text: string;
}

export function TransactionDocumentsTab({ transactionId }: TransactionTabProps): JSX.Element {
  const [principal, setPrincipal] = useState('');
  const [walletDocs, setWalletDocs] = useState<VaultDocument[]>([]);
  const [sent, setSent] = useState<SentItem[]>([]);
  const [parties, setParties] = useState<ShareParty[]>([]);
  const [mySide, setMySide] = useState<DealSide | null>(null);
  const [buyerLender, setBuyerLender] = useState<string | undefined>(undefined);
  const [grants, setGrants] = useState<Map<string, ShareGrant>>(new Map());
  const [history, setHistory] = useState<ShareGrant[]>([]);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loading, setLoading] = useState(true);
  const [picking, setPicking] = useState(false);
  const [proving, setProving] = useState(false);
  const [proofs, setProofs] = useState<ProofLink[]>([]);
  const [completion, setCompletion] = useState<CompletionLifecycle | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        await icpService.initialize();
        const p = await icpService.getUserPrincipal();
        // Completion lifecycle first (decision 8): schedule/sweep before we read grants.
        const lifecycle = await applyCompletionLifecycle(transactionId);
        const [docs, items, roster, myGrants, allGrants, links] = await Promise.all([
          vaultDocumentService.listMyDocuments(),
          transactionWalletService.listSent(transactionId),
          sharePartyService.loadRoster(transactionId),
          documentShareService.listMyGrants(transactionId),
          documentShareService.listGrantHistory(transactionId),
          walletProofService.listAll(transactionId).catch((err: unknown) => {
            logger.warn('[txWalletDocs] proof links unavailable', err);
            return [] as ProofLink[];
          }),
        ]);
        if (!active) return;
        setPrincipal(p);
        setWalletDocs(docs);
        setSent(items);
        setParties(roster.parties);
        setMySide(roster.mySide);
        // The buyer's lender now lives in the Buyer Pack (spec 2026-09-05); a
        // missing pack is not an error for the wallet, just no placeholder row.
        if (roster.mySide === 'buyer') {
          loadBuyerPack(transactionId)
            .then((items) => {
              if (!active) return;
              const m = items.find((i) => i.item === 'mortgage')?.detail;
              setBuyerLender(m?.funding_type === 'mortgage' ? m.lender_name : undefined);
            })
            .catch((err: unknown) => logger.warn('[txWalletDocs] buyer pack unavailable', err));
        }
        setGrants(new Map(myGrants.map((g) => [grantKey(g.docHash, g.granteePrincipal), g])));
        setHistory(allGrants);
        setProofs(links);
        setCompletion(lifecycle);
      } catch (err) {
        logger.error('[txWalletDocs] failed to load', err);
        if (active) setNotice({ kind: 'error', text: 'Could not load this deal’s wallet. Refresh to retry.' });
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [transactionId]);

  const setKeyBusy = (key: string, isBusy: boolean): void =>
    setBusy((prev) => {
      const next = new Set(prev);
      if (isBusy) next.add(key);
      else next.delete(key);
      return next;
    });

  const dropGrant = (key: string): void =>
    setGrants((prev) => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });

  const handleToggle = async (item: SentItem, party: ShareParty): Promise<void> => {
    const key = grantKey(item.doc.fileHash, party.principal);
    if (busy.has(key)) return;
    setNotice(null);
    setKeyBusy(key, true);
    try {
      const existing = grants.get(key);
      if (existing) {
        const { auditLogged } = await documentShareService.revokeShare(existing);
        dropGrant(key);
        const revokedAt = new Date().toISOString();
        setHistory((prev) => prev.map((g) => (g.id === existing.id ? { ...g, status: 'revoked', revokedAt } : g)));
        if (!auditLogged) {
          setNotice({ kind: 'warning', text: 'Sharing was revoked, but the on-chain audit entry failed to record.' });
        }
      } else {
        const grant = await documentShareService.shareDocument(item.doc, transactionId, party.principal);
        setGrants((prev) => new Map(prev).set(key, grant));
        setHistory((prev) => [...prev, grant]);
      }
    } catch (err) {
      setNotice({ kind: 'error', text: err instanceof Error ? err.message : 'Sharing failed.' });
    } finally {
      setKeyBusy(key, false);
    }
  };

  const handleSend = async (doc: VaultDocument): Promise<void> => {
    setKeyBusy(doc.id, true);
    try {
      const item = await transactionWalletService.send(transactionId, doc);
      setSent((prev) => [item, ...prev.filter((s) => s.doc.id !== doc.id)]);
    } catch (err) {
      setNotice({ kind: 'error', text: err instanceof Error ? err.message : 'Could not send.' });
    } finally {
      setKeyBusy(doc.id, false);
    }
  };

  const handleRemove = async (item: SentItem): Promise<void> => {
    setKeyBusy(item.doc.id, true);
    try {
      const { revoked } = await transactionWalletService.unsend(transactionId, item.doc);
      setSent((prev) => prev.filter((s) => s.itemId !== item.itemId));
      setGrants((prev) => new Map([...prev].filter(([, g]) => g.docHash !== item.doc.fileHash)));
      if (revoked > 0) {
        setNotice({
          kind: 'warning',
          text: `Removed from this deal — sharing with ${revoked} ${revoked === 1 ? 'party' : 'parties'} was revoked.`,
        });
      }
    } catch (err) {
      setNotice({ kind: 'error', text: err instanceof Error ? err.message : 'Could not remove.' });
    } finally {
      setKeyBusy(item.doc.id, false);
    }
  };

  const revokeOrphan = async (grant: ShareGrant): Promise<void> => {
    const key = grantKey(grant.docHash, grant.granteePrincipal);
    setKeyBusy(key, true);
    try {
      await documentShareService.revokeShare(grant);
      dropGrant(key);
    } catch (err) {
      setNotice({ kind: 'error', text: err instanceof Error ? err.message : 'Revoke failed.' });
    } finally {
      setKeyBusy(key, false);
    }
  };

  if (loading) return <p className="p-6 text-sm text-muted-foreground">Loading this deal’s wallet…</p>;

  const { yours, others } = splitBySide(parties, mySide);
  const hasLenderParty = parties.some((p) => p.role === 'lender');
  const lenderPlaceholder = buyerLender && !hasLenderParty ? buyerLender : undefined;
  const labelFor = (p: string): string | undefined => parties.find((x) => x.principal === p)?.label;
  const sentIds = new Set(sent.map((s) => s.doc.id));
  const candidates = walletDocs.filter((d) => !sentIds.has(d.id));
  const orphanGrants = [...grants.values()].filter((g) => !sent.some((s) => s.doc.fileHash === g.docHash));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Documents you’ve sent from your PropXchain Wallet to this deal. Nothing is shared until you
          switch a party on.
        </p>
        <div className="flex gap-2">
          <Link
            to={`/transaction/${transactionId}/share`}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
          >
            <UserPlus className="h-3.5 w-3.5" /> Invite someone
          </Link>
          <button
            type="button"
            onClick={() => setProving((v) => !v)}
            disabled={sent.length === 0}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
          >
            <QrCode className="h-3.5 w-3.5" /> Show a proof
          </button>
          <button
            type="button"
            onClick={() => setPicking((v) => !v)}
            className="inline-flex items-center gap-1 rounded-md bg-teal-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-teal-700"
          >
            <Plus className="h-3.5 w-3.5" /> Add from wallet
          </button>
        </div>
      </div>

      {completion?.isCompleted && (
        <CompletionNotice accessEndsAt={completion.accessEndsAt} expiredNow={completion.expiredNow} />
      )}

      {notice && (
        <p
          role="alert"
          className={
            notice.kind === 'error'
              ? 'rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800'
              : 'rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800'
          }
        >
          {notice.text}
        </p>
      )}

      {picking && (
        <AddFromWalletPicker
          principal={principal}
          candidates={candidates}
          busyIds={busy}
          onSend={(d) => void handleSend(d)}
          onClose={() => setPicking(false)}
        />
      )}

      {proving && sent.length > 0 && (
        <ProofQrPanel
          transactionId={transactionId}
          principal={principal}
          sent={sent}
          active={proofs.filter((l) => l.status === 'active' && new Date(l.expiresAt) > new Date())}
          onCreated={(link) => setProofs((prev) => [...prev, link])}
          onRevoked={(link) =>
            setProofs((prev) => prev.map((l) => (l.id === link.id ? { ...l, status: 'revoked' } : l)))
          }
          onClose={() => setProving(false)}
        />
      )}

      {sent.length === 0 ? (
        <EmptyDealWallet walletIsEmpty={walletDocs.length === 0} />
      ) : (
        <div className="space-y-2">
          {sent.map((item) => (
            <TransactionDocCard
              key={item.itemId}
              item={item}
              principal={principal}
              yourSide={yours}
              otherSide={others}
              lenderPlaceholder={lenderPlaceholder}
              grants={grants}
              busy={busy}
              history={buildDocHistory(history, item.doc.fileHash, labelFor, proofs)}
              onToggle={(i, party) => void handleToggle(i, party)}
              onRemove={(i) => void handleRemove(i)}
            />
          ))}
        </div>
      )}

      <OrphanGrantsList
        grants={orphanGrants}
        principal={principal}
        busy={busy}
        labelFor={labelFor}
        onRevoke={(g) => void revokeOrphan(g)}
      />
    </div>
  );
}

export default TransactionDocumentsTab;
