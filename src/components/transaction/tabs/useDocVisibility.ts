// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * useDocVisibility — turns a "Who can see this" choice (a preset or one
 * Custom switch) into share and revoke calls on documentShareService. Any
 * change that ADDS a viewer waits for the owner to confirm the roles named
 * in a dialog, because personal data is about to leave their control;
 * a change that only removes viewers runs at once — revocation is never gated.
 */
import { useCallback, useState } from 'react';
import { documentShareService, type ShareGrant } from '@/services/documentShare.service';
import type { DealSide, ShareParty } from '@/services/shareParty.service';
import type { SentItem } from '@/services/transactionWallet.service';
import {
  planChange,
  presetTargets,
  roleLabelsFor,
  withSideConveyancers,
  type GrantPlan,
  type VisibilityPreset,
} from './visibilityPresets';

export interface VisibilityNotice {
  kind: 'error' | 'warning';
  text: string;
}

export interface PendingShare {
  item: SentItem;
  plan: GrantPlan;
  /** Role labels gaining access, for the confirm dialog. Never names. */
  roles: string[];
}

interface Deps {
  transactionId: string;
  parties: ShareParty[];
  mySide: DealSide | null;
  grants: Map<string, ShareGrant>;
  onGranted: (grant: ShareGrant) => void;
  onRevoked: (grant: ShareGrant) => void;
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

export function useDocVisibility(deps: Deps): DocVisibility {
  const { transactionId, parties, mySide, grants, onGranted, onRevoked, onNotice, setBusy } = deps;
  const [pending, setPending] = useState<PendingShare | null>(null);

  const grantsFor = useCallback(
    (docHash: string): ShareGrant[] => [...grants.values()].filter((g) => g.docHash === docHash),
    [grants],
  );

  // Grants first, revokes after: a revoke that drops the last grant erases the
  // shared copy, so revoking first would erase and then re-copy the same file.
  const apply = async (item: SentItem, plan: GrantPlan): Promise<void> => {
    const key = visibilityBusyKey(item.doc.fileHash);
    onNotice(null);
    setBusy(key, true);
    let auditMissed = false;
    try {
      for (const party of plan.toGrant) {
        onGranted(await documentShareService.shareDocument(item.doc, transactionId, party.principal));
      }
      for (const grant of plan.toRevoke) {
        const { auditLogged } = await documentShareService.revokeShare(grant);
        onRevoked(grant);
        if (!auditLogged) auditMissed = true;
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

  const request = (item: SentItem, plan: GrantPlan): void => {
    if (plan.toGrant.length === 0 && plan.toRevoke.length === 0) return;
    if (plan.toGrant.length === 0) {
      void apply(item, plan);
      return;
    }
    setPending({ item, plan, roles: roleLabelsFor(plan.toGrant.map((p) => p.principal), parties) });
  };

  const choosePreset = (item: SentItem, preset: VisibilityPreset): void => {
    if (preset === 'custom') return;
    const targets = presetTargets(preset, parties, mySide);
    if (!targets) return;
    request(item, planChange(grantsFor(item.doc.fileHash), targets));
  };

  const toggleParty = (item: SentItem, party: ShareParty): void => {
    const current = grantsFor(item.doc.fileHash);
    const existing = current.find((g) => g.granteePrincipal === party.principal);
    if (existing) {
      request(item, { toGrant: [], toRevoke: [existing] });
      return;
    }
    const have = new Set(current.map((g) => g.granteePrincipal));
    const toGrant = withSideConveyancers([party], parties).filter((p) => !have.has(p.principal));
    request(item, { toGrant, toRevoke: [] });
  };

  const confirm = (): void => {
    if (!pending) return;
    setPending(null);
    void apply(pending.item, pending.plan);
  };

  // Stable so the dialog's focus/Escape effect does not re-run every render.
  const cancel = useCallback((): void => setPending(null), []);

  return { pending, choosePreset, toggleParty, confirm, cancel };
}
