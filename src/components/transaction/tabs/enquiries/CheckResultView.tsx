// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Renders a fact-check result exactly as the server returned it: covered
 * facts with their quotes, conflicts with the premise they contradict, and
 * the document types that would answer. No added judgement.
 */
import type { CheckResult } from '@/services/enquiries.service';
import { kindLabel } from './enquiryLabels';

interface Props { result: CheckResult; leadIn?: string }

export function CheckResultView({ result, leadIn }: Props): JSX.Element {
  const empty = !result.covered.length && !result.conflicts.length && !result.missing.length;
  return (
    <div className="space-y-2 rounded-md bg-muted/40 p-3 text-sm" data-testid="check-result">
      {leadIn && <p className="font-medium">{leadIn}</p>}
      {empty && <p className="text-muted-foreground">No facts in the pack relate to this.</p>}
      {result.covered.map((c) => (
        <div key={`c-${c.ref}`} className="rounded border-l-4 border-emerald-400 bg-background p-2">
          <div className="text-xs text-muted-foreground">{kindLabel(c.kind)} · {c.label}</div>
          <blockquote className="mt-1 border-l-2 pl-2 italic">{c.quote}</blockquote>
        </div>
      ))}
      {result.conflicts.map((c) => (
        <div key={`x-${c.ref}`} className="rounded border-l-4 border-amber-400 bg-background p-2">
          <div className="text-xs text-muted-foreground">{kindLabel(c.kind)} · {c.label} · differs from: {c.premise}</div>
          <blockquote className="mt-1 border-l-2 pl-2 italic">{c.quote}</blockquote>
        </div>
      ))}
      {result.missing.length > 0 && (
        <div className="rounded border-l-4 border-slate-300 bg-background p-2">
          <div className="text-xs text-muted-foreground">Would be answered by</div>
          <ul className="mt-1 list-disc pl-5">{result.missing.map((m) => <li key={m.docType}>{m.label}</li>)}</ul>
        </div>
      )}
    </div>
  );
}
