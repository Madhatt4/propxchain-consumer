// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * PaperworkFindings — under "Check my answers", what the consents scan found
 * on the seller's own TA6 attachments (5.2 paperwork and 6.1 guarantees).
 * Reads the stored findings; the files are not touched again. Renders
 * nothing when no attachment has anything to say, so a clean form shows no
 * empty box.
 *
 * Advisory by construction, like the panel above it: it gates nothing and
 * writes nothing.
 */
import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { FileSearch } from 'lucide-react';

import { loadPaperworkFindings } from '@/services/documentFindings.service';
import type { PaperworkSummary } from '@/services/documentFindings.service';

export interface PaperworkFindingsProps {
  transactionId: string;
}

export function PaperworkFindings({ transactionId }: PaperworkFindingsProps): ReactElement | null {
  const [documents, setDocuments] = useState<PaperworkSummary[]>([]);

  useEffect(() => {
    let cancelled = false;
    void loadPaperworkFindings(transactionId).then((found) => {
      if (!cancelled) setDocuments(found);
    });
    return () => {
      cancelled = true;
    };
  }, [transactionId]);

  if (documents.length === 0) return null;

  return (
    <section
      aria-label="Your paperwork"
      className="mt-2 space-y-2 rounded-lg border border-amber-200 bg-amber-50/40 p-3 dark:border-amber-800 dark:bg-amber-900/10"
    >
      <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
        <FileSearch className="h-3.5 w-3.5" aria-hidden="true" />
        Your paperwork
      </h4>
      <ul className="space-y-2">
        {documents.map((doc, index) => (
          <li key={`${doc.section}-${index}`} className="text-xs text-gray-700 dark:text-slate-200">
            <p className="font-medium">
              <span className="text-gray-500 dark:text-slate-400">§{doc.section} · </span>
              {doc.title}
            </p>
            <ul className="mt-0.5 list-disc space-y-0.5 pl-4">
              {doc.findings.map((finding) => (
                <li key={finding}>{finding}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-gray-500 dark:text-slate-400">
        How each attachment reads to us. Your conveyancer decides what it means.
      </p>
    </section>
  );
}

export default PaperworkFindings;
