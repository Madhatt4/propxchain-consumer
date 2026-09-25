// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * OrphanGrantsList — grants whose file is no longer in this deal's wallet
 * (removed on another device, or before the send step existed). Listed so the
 * owner can still close them.
 */
import type { ShareGrant } from '@/services/documentShare.service';
import type { VaultSlotId } from '@/types/vault.types';
import { slotDisplayLabel } from '@/utils/vaultSlotLabel';
import { grantKey } from './grantKey';

interface OrphanGrantsListProps {
  grants: ShareGrant[];
  principal: string;
  busy: Set<string>;
  labelFor: (principal: string) => string | undefined;
  onRevoke: (grant: ShareGrant) => void;
}

export function OrphanGrantsList({
  grants,
  principal,
  busy,
  labelFor,
  onRevoke,
}: OrphanGrantsListProps): JSX.Element | null {
  if (grants.length === 0) return null;
  return (
    <div className="rounded-lg border border-dashed border-border p-4">
      <p className="text-xs font-medium text-muted-foreground">Shared files no longer in this deal’s wallet</p>
      <ul className="mt-2 space-y-1.5">
        {grants.map((g) => {
          const key = grantKey(g.docHash, g.granteePrincipal);
          const who = labelFor(g.granteePrincipal) ?? `${g.granteePrincipal.slice(0, 8)}…`;
          return (
            <li key={g.id} className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate text-foreground">
                {g.slotId ? slotDisplayLabel(g.slotId as VaultSlotId, principal) : 'Document'} · shared with {who}
              </span>
              <button
                type="button"
                disabled={busy.has(key)}
                onClick={() => onRevoke(g)}
                className="shrink-0 font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
              >
                Revoke
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
