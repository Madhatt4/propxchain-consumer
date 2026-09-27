// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Who has signed off this deal's searches. Every party sees the status; the
 * buyer and the buyer's conveyancer each get their own sign-off, and can
 * revoke it with a reason. The server decides who may sign (see
 * searchSignOff.service); `myRole` only chooses which controls to show.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { SearchSignOffRecord, SignOffRole } from '@/services/searchSignOff.service';

const ROLE_LABEL: Record<SignOffRole, string> = {
  buyer: 'Buyer',
  conveyancer: "Buyer's conveyancer",
};

export interface SearchSignOffCardProps {
  signOffs: SearchSignOffRecord[];
  myRole: SignOffRole | null;
  myUserId: string | null;
  resultsBack: number;
  onSignOff: (notes: string) => Promise<void>;
  onRevoke: (signOffId: string, reason: string) => Promise<void>;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function LiveSignOff({ record, canRevoke, onRevoke }: {
  record: SearchSignOffRecord;
  canRevoke: boolean;
  onRevoke: (reason: string) => Promise<void>;
}): JSX.Element {
  const [reason, setReason] = useState('');
  const [isRevoking, setIsRevoking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (): Promise<void> => {
    setError(null);
    setIsRevoking(true);
    try {
      await onRevoke(reason);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not revoke');
    } finally {
      setIsRevoking(false);
    }
  };

  return (
    <div className="space-y-1">
      <p className="text-sm">
        Signed off {formatDate(record.signedAt)} · {record.searchOrderIds.length} search
        {record.searchOrderIds.length === 1 ? '' : 'es'}
      </p>
      {record.notes && <p className="text-sm text-muted-foreground">“{record.notes}”</p>}
      <p className="font-mono text-xs text-muted-foreground" title={record.recordHash}>
        On the audit trail · {record.recordHash.slice(0, 12)}…
      </p>
      {canRevoke && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <input
            aria-label="Reason for revoking"
            className="min-w-0 flex-1 rounded-md border bg-background px-2 py-1 text-sm"
            placeholder="Reason for revoking"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <Button type="button" variant="outline" size="sm" disabled={isRevoking || !reason.trim()} onClick={() => void submit()}>
            {isRevoking ? 'Revoking…' : 'Revoke'}
          </Button>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

function SignOffForm({ resultsBack, onSignOff }: { resultsBack: number; onSignOff: (notes: string) => Promise<void> }): JSX.Element {
  const [notes, setNotes] = useState('');
  const [isSigning, setIsSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (): Promise<void> => {
    setError(null);
    setIsSigning(true);
    try {
      await onSignOff(notes);
      setNotes('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign off');
    } finally {
      setIsSigning(false);
    }
  };

  if (resultsBack === 0) {
    return <p className="text-sm text-muted-foreground">You can sign off once search results are back.</p>;
  }
  return (
    <div className="space-y-2">
      <textarea
        aria-label="Sign-off notes"
        className="w-full rounded-md border bg-background px-2 py-1 text-sm"
        rows={2}
        maxLength={2000}
        placeholder="Notes (optional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <Button type="button" size="sm" disabled={isSigning} onClick={() => void submit()}>
        {isSigning ? 'Signing off…' : `Sign off ${resultsBack} search${resultsBack === 1 ? '' : 'es'}`}
      </Button>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

export function SearchSignOffCard({ signOffs, myRole, myUserId, resultsBack, onSignOff, onRevoke }: SearchSignOffCardProps): JSX.Element {
  const live = signOffs.filter((s) => s.revokedAt === null);
  const revoked = signOffs.filter((s) => s.revokedAt !== null);
  const iHaveLive = live.some((s) => s.signerUserId === myUserId);

  return (
    <section className="space-y-3 rounded-lg border p-4">
      <h4 className="text-sm font-semibold">Search sign-off</h4>
      {(['buyer', 'conveyancer'] as const).map((role) => {
        const forRole = live.filter((s) => s.signerRole === role);
        return (
          <div key={role} className="space-y-1 border-t pt-3 first-of-type:border-t-0 first-of-type:pt-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{ROLE_LABEL[role]}</p>
            {forRole.length === 0 && <p className="text-sm text-muted-foreground">Not signed off</p>}
            {forRole.map((record) => (
              <LiveSignOff
                key={record.id}
                record={record}
                canRevoke={record.signerUserId === myUserId}
                onRevoke={(reason) => onRevoke(record.id, reason)}
              />
            ))}
            {myRole === role && !iHaveLive && <SignOffForm resultsBack={resultsBack} onSignOff={onSignOff} />}
          </div>
        );
      })}
      {revoked.length > 0 && (
        <details className="border-t pt-3 text-sm">
          <summary className="cursor-pointer text-muted-foreground">Revoked sign-offs ({revoked.length})</summary>
          <ul className="mt-2 space-y-1">
            {revoked.map((r) => (
              <li key={r.id} className="text-muted-foreground">
                {ROLE_LABEL[r.signerRole]} · signed {formatDate(r.signedAt)}, revoked {formatDate(r.revokedAt as string)}: {r.revokeReason}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
