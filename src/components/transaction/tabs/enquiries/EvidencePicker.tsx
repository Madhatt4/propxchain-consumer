// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Pick the evidence an answer points at: facts the check already cited (one
 * click), documents sent into this deal's Transaction Wallet, or a manual
 * reference. Returns [{kind, ref, label}] capped at 20.
 */
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { transactionWalletService } from '@/services/transactionWallet.service';
import { EVIDENCE_KINDS, type CheckResult, type Evidence, type EvidenceKind } from '@/services/enquiries.service';
import { kindLabel } from './enquiryLabels';

interface Props { transactionId: string; check: CheckResult | null; value: Evidence[]; onChange: (v: Evidence[]) => void }
const MAX = 20;

export function EvidencePicker({ transactionId, check, value, onChange }: Props): JSX.Element {
  const [docs, setDocs] = useState<{ ref: string; label: string }[]>([]);
  const [manual, setManual] = useState<{ kind: EvidenceKind; ref: string; label: string }>({ kind: 'document', ref: '', label: '' });
  useEffect(() => {
    let live = true;
    transactionWalletService.listSent(transactionId)
      .then((items) => { if (live) setDocs(items.map((i) => ({ ref: i.doc.id, label: i.doc.label ?? i.doc.slotId }))); })
      .catch(() => { if (live) setDocs([]); });
    return () => { live = false; };
  }, [transactionId]);

  const has = (e: Evidence) => value.some((v) => v.kind === e.kind && v.ref === e.ref);
  const add = (e: Evidence) => { if (!has(e) && value.length < MAX) onChange([...value, e]); };
  const remove = (e: Evidence) => onChange(value.filter((v) => !(v.kind === e.kind && v.ref === e.ref)));
  const cited: Evidence[] = check ? [...check.covered, ...check.conflicts].map((c) => ({ kind: c.kind, ref: c.ref, label: c.label })) : [];

  return (
    <div className="space-y-2 text-sm">
      <div className="font-medium">Evidence</div>
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1">
          {value.map((e) => (
            <li key={`${e.kind}:${e.ref}`} className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
              <span>{kindLabel(e.kind)} · {e.label}</span>
              <button type="button" aria-label={`Remove ${e.label}`} className="text-muted-foreground" onClick={() => remove(e)}>×</button>
            </li>
          ))}
        </ul>
      )}
      {cited.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {cited.filter((c) => !has(c)).map((c) => (
            <Button key={`${c.kind}:${c.ref}`} type="button" size="sm" variant="outline" onClick={() => add(c)}>+ {c.label}</Button>
          ))}
        </div>
      )}
      {docs.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {docs.filter((d) => !has({ kind: 'document', ref: d.ref, label: d.label })).map((d) => (
            <Button key={d.ref} type="button" size="sm" variant="outline" onClick={() => add({ kind: 'document', ref: d.ref, label: d.label })}>+ {d.label}</Button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <select aria-label="Evidence kind" className="rounded-md border bg-background p-2" value={manual.kind} onChange={(e) => setManual({ ...manual, kind: e.target.value as EvidenceKind })}>
          {EVIDENCE_KINDS.map((k) => <option key={k} value={k}>{kindLabel(k)}</option>)}
        </select>
        <Input aria-label="Evidence reference" placeholder="Reference (e.g. TA6 5.4)" className="w-44" value={manual.ref} onChange={(e) => setManual({ ...manual, ref: e.target.value })} />
        <Input aria-label="Evidence label" placeholder="Label" className="w-56" value={manual.label} onChange={(e) => setManual({ ...manual, label: e.target.value })} />
        <Button type="button" size="sm" variant="secondary" disabled={!manual.ref.trim() || !manual.label.trim()}
          onClick={() => { add({ kind: manual.kind, ref: manual.ref.trim(), label: manual.label.trim() }); setManual({ ...manual, ref: '', label: '' }); }}>
          Add
        </Button>
      </div>
    </div>
  );
}
