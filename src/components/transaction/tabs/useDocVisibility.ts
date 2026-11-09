// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * useDocVisibility — turns a "Who can see this" choice (a preset or one
 * Custom switch) into share and revoke calls on documentShareService.
 *
 * Personal data fails CLOSED (security review of PR #180):
 * - any change that ADDS a viewer waits for the owner to confirm the roles
 *   named in a dialog; only those confirmed principals can ever be granted;
 * - at apply time the grants and roster are re-read and the plan rebuilt, so
 *   a plan computed when the dropdown changed is never applied stale;
 * - revokes run first, each on its own, and any revoke failure stops the
 *   grants — dropping access never depends on adding access succeeding.
 */
import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { documentShareService, type ShareGrant } from '@/services/documentShare.service';
import { sharePartyService, type DealSide, type ShareParty, type ShareRoster } from '@/services/shareParty.service';
import type { SentItem } from '@/services/transactionWallet.service';
import { grantKey } from './grantKey';
import {
  computePlan,
  roleLabelsFor,
  type GrantPlan,
  type VisibilityIntent,
  type VisibilityPreset,
} from './visibilityPresets';

export interface VisibilityNotice {
  kind: 'error' | 'warning';
  text: string;
}

export interface PendingShare {
  item: SentItem;
  intent: VisibilityIntent;
  /** Role labels gaining access, for the confirm dialog. Never names. */
  roles: string[];
  /** The only principals this confirmation may grant to. */
  confirmed: Set<string>;
}

interface Deps {
  transactionId: string;
  parties: ShareParty[];
  mySide: DealSide | null;
  grants: Map<string, ShareGrant>;
  setGrants: Dispatch<SetStateAction<Map<string, ShareGrant>>>;
  setHistory: Dispatch<SetStateAction<ShareGrant[]>>;
  onRoster: (roster: ShareRoster) => void;
  onNotice: (notice: VisibilityNotice | null) => void;
  setBusy: (key: string, isBusy: boolean) => void;
}

export interface DocVisibility {
  pending: PendingShare | null;
  choosePreset: (item: SentItem, preset: VisibilityPreset) => void;
  toggleParty: (item: SentItem, party: ShareParty) => void;
  confirm: () => void;
  cancel: () => void;
}

/** Busy key for a whole document while its visibility is being changed. */
export const visibilityBusyKey = (docHash: string): string => `vis:${docHash}`;

const isEmptyPlan = (plan: GrantPlan): boolean => plan.toGrant.length === 0 && plan.toRevoke.length === 0;

export function useDocVisibility(deps: Deps): DocVisibility {
  const { transactionId, parties, mySide, grants, setGrants, setHistory, onRoster, onNotice, setBusy } = deps;
  const [pending, setPending] = useState<PendingShare | null>(null);
  // Latest setBusy without making cancel change identity every render.
  const setBusyRef = useRef(setBusy);
  setBusyRef.current = setBusy;

  const recordGranted = (grant: ShareGrant): void => {
    setGrants((prev) => new Map(prev).set(grantKey(grant.docHash, grant.granteePrincipal), grant));
    setHistory((prev) => [...prev, grant]);
  };

  const recordRevoked = (grant: ShareGrant): void => {
    setGrants((prev) => {
      const next = new Map(prev);
      next.delete(grantKey(grant.docHash, grant.granteePrincipal));
      return next;
    });
    const revokedAt = new Date().toISOString();
    setHistory((prev) => prev.map((g) => (g.id === grant.id ? { ...g, status: 'revoked', revokedAt } : g)));
  };

  /** Fresh grants + roster; on failure, the local copy with granting disabled. */
  const refresh = async (): Promise<{ all: ShareGrant[]; roster: ShareRoster; canGrant: boolean }> => {
    try {
      const [all, roster] = await Promise.all([
        documentShareService.listMyGrants(transactionId),
        sharePartyService.loadRoster(transactionId),
      ]);
      setGrants(new Map(all.map((g) => [grantKey(g.docHash, g.granteePrincipal), g])));
      onRoster(roster);
      return { all, roster, canGrant: true };
    } catch {
      return { all: [...grants.values()], roster: { mySide, parties }, canGrant: false };
    }
  };

  /** Every revoke gets its own attempt; reports how many failed and whether an audit entry was missed. */
  const revokeEach = async (toRevoke: ShareGrant[]): Promise<{ failed: number; auditMissed: boolean }> => {
    let failed = 0;
    let auditMissed = false;
    for (const grant of toRevoke) {
      try {
        const { auditLogged } = await documentShareService.revokeShare(grant);
        recordRevoked(grant);
        if (!auditLogged) auditMissed = true;
      } catch {
        failed += 1;
      }
    }
    return { failed, auditMissed };
  };

  const run = async (item: SentItem, intent: VisibilityIntent, confirmed: Set<string>): Promise<void> => {
    const key = visibilityBusyKey(item.doc.fileHash);
    onNotice(null);
    setBusy(key, true);
    try {
      const { all, roster, canGrant } = await refresh();
      const docGrants = all.filter((g) => g.docHash === item.doc.fileHash);
      const plan = computePlan(intent, docGrants, roster.parties, roster.mySide);
      const { failed, auditMissed } = await revokeEach(plan.toRevoke);
      if (failed > 0) {
        const who = `${failed} ${failed === 1 ? 'party' : 'parties'}`;
        onNotice({ kind: 'error', text: `Could not stop sharing with ${who}, so nothing new was shared. Try again.` });
        return;
      }
      const toGrant = plan.toGrant.filter((p) => confirmed.has(p.principal));
      if (!canGrant && toGrant.length > 0) {
        onNotice({ kind: 'error', text: 'Could not check who is on this deal, so nothing new was shared. Try again.' });
        return;
      }
      for (const party of toGrant) {
        recordGranted(await documentShareService.shareDocument(item.doc, transactionId, party.principal));
      }
      if (auditMissed) {
        onNotice({ kind: 'warning', text: 'Sharing was revoked, but the on-chain audit entry failed to record.' });
      }
    } catch (err) {
      onNotice({ kind: 'error', text: err instanceof Error ? err.message : 'Sharing failed.' });
    } finally {
      setBusy(key, false);
    }
  };

  const request = (item: SentItem, intent: VisibilityIntent): void => {
    const docGrants = [...grants.values()].filter((g) => g.docHash === item.doc.fileHash);
    const plan = computePlan(intent, docGrants, parties, mySide);
    if (isEmptyPlan(plan)) return;
    if (plan.toGrant.length === 0) {
      void run(item, intent, new Set());
      return;
    }
    const principals = plan.toGrant.map((p) => p.principal);
    // Lock the document's chooser and switches while the dialog is open.
    setBusy(visibilityBusyKey(item.doc.fileHash), true);
    setPending({ item, intent, roles: roleLabelsFor(principals, parties), confirmed: new Set(principals) });
  };

  const choosePreset = (item: SentItem, preset: VisibilityPreset): void => {
    if (preset !== 'custom') request(item, { kind: 'preset', preset });
  };

  const toggleParty = (item: SentItem, party: ShareParty): void => {
    const isOn = grants.has(grantKey(item.doc.fileHash, party.principal));
    request(item, { kind: isOn ? 'remove' : 'add', principal: party.principal });
  };

  const confirm = (): void => {
    if (!pending) return;
    setPending(null);
    void run(pending.item, pending.intent, pending.confirmed);
  };

  const cancel = useCallback((): void => {
    if (pending) setBusyRef.current(visibilityBusyKey(pending.item.doc.fileHash), false);
    setPending(null);
  }, [pending]);

  return { pending, choosePreset, toggleParty, confirm, cancel };
}
