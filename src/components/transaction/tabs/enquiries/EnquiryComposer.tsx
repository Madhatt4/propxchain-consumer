// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Compose one enquiry. "Check the pack" runs the compose-time fact check and
 * shows what already covers, conflicts with, or is missing for the draft. If
 * something covers it, the raise button becomes "Raise anyway". The check is
 * guidance from this transaction's own facts; the wording never advises.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  ENQUIRY_CATEGORIES, EnquiryError, checkEnquiry, raiseEnquiry,
  type CheckResult, type Enquiry, type EnquiryCategory,
} from '@/services/enquiries.service';
import { categoryLabel } from './enquiryLabels';
import { CheckResultView } from './CheckResultView';

interface Props { transactionId: string; parentId?: string; onRaised: (e: Enquiry) => void }
type CheckState = { kind: 'idle' } | { kind: 'checking' } | { kind: 'done'; result: CheckResult } | { kind: 'premium' } | { kind: 'unavailable' };

function leadInFor(r: CheckResult): string {
  if (r.covered.length) return 'The pack already covers this:';
  if (r.conflicts.length) return 'The pack does not cover this, but it holds a fact that differs from what the enquiry assumes:';
  return 'Nothing in the pack covers this yet.';
}

export function EnquiryComposer({ transactionId, parentId, onRaised }: Props): JSX.Element {
  const [category, setCategory] = useState<EnquiryCategory>('other');
  const [question, setQuestion] = useState('');
  const [check, setCheck] = useState<CheckState>({ kind: 'idle' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmed = question.trim();
  const coveredCount = check.kind === 'done' ? check.result.covered.length : 0;

  const runCheck = async (): Promise<void> => {
    if (!trimmed) return;
    setCheck({ kind: 'checking' }); setError(null);
    try {
      const r = await checkEnquiry({ transactionId, category, question: trimmed });
      setCheck({ kind: 'done', result: r.check.result });
    } catch (e) {
      if (e instanceof EnquiryError && e.status === 402) setCheck({ kind: 'premium' });
      else setCheck({ kind: 'unavailable' });
    }
  };
  const raise = async (): Promise<void> => {
    if (!trimmed) return;
    setBusy(true); setError(null);
    try {
      const row = await raiseEnquiry({ transactionId, category, question: trimmed, ...(parentId ? { parentId } : {}) });
      setQuestion(''); setCheck({ kind: 'idle' }); onRaised(row);
    } catch (e) {
      setError(e instanceof EnquiryError ? (e.reason ?? e.code) : 'Could not raise the enquiry');
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="grid gap-3 sm:grid-cols-[220px_1fr]">
        <label className="text-sm">
          <span className="mb-1 block font-medium">Category</span>
          <select aria-label="Category" className="w-full rounded-md border bg-background p-2" value={category} onChange={(e) => setCategory(e.target.value as EnquiryCategory)}>
            {ENQUIRY_CATEGORIES.map((c) => <option key={c} value={c}>{categoryLabel(c)}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Enquiry</span>
          <textarea aria-label="Enquiry" className="min-h-[88px] w-full rounded-md border bg-background p-2" maxLength={4000} value={question}
            onChange={(e) => { setQuestion(e.target.value); if (check.kind !== 'idle') setCheck({ kind: 'idle' }); }} />
        </label>
      </div>
      {check.kind === 'done' && <CheckResultView result={check.result} leadIn={leadInFor(check.result)} />}
      {check.kind === 'premium' && <p className="text-sm text-muted-foreground">The pack check is part of the seller's Premium tier. You can still raise the enquiry.</p>}
      {check.kind === 'unavailable' && <p className="text-sm text-muted-foreground">The pack check is not available right now. You can still raise the enquiry.</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={!trimmed || check.kind === 'checking'} onClick={runCheck}>
          {check.kind === 'checking' ? 'Checking…' : 'Check the pack'}
        </Button>
        <Button type="button" disabled={!trimmed || busy} onClick={raise}>
          {busy ? 'Raising…' : coveredCount ? 'Raise anyway' : 'Raise enquiry'}
        </Button>
      </div>
    </div>
  );
}
