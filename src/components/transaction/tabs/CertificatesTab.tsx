// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Certificates tab — what the seller's certificates say, in plain words, for
 * every party on the deal (decision Q23, 2026-10-15): gas safety, EICR,
 * FENSA, EPC and building regulations completion. Each line is a fact the
 * seller confirmed from an upload, with the date they confirmed it, so the
 * buyer and both conveyancers need not open the file. Suggestions the seller
 * has not confirmed are not shown here (Q13). Reads document_facts_current(),
 * which the table's party-read policy fences.
 */
import { useEffect, useState } from 'react';
import { FileCheck2 } from 'lucide-react';

import { factLabel, loadCurrentFacts } from '@/services/documentFacts.service';
import type { CurrentFact } from '@/services/documentFacts.service';
import type { TransactionTabProps } from './transactionTabs.config';

/** Certificate groups in display order, keyed by fact-key prefix. */
const GROUPS: readonly { prefix: string; title: string }[] = [
  { prefix: 'gas_safety', title: 'Gas safety record' },
  { prefix: 'eicr', title: 'Electrical installation condition report (EICR)' },
  { prefix: 'epc', title: 'Energy Performance Certificate (EPC)' },
  { prefix: 'fensa', title: 'Windows and doors (FENSA)' },
  { prefix: 'building_regs', title: 'Building regulations' },
];

const DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

function confirmedOn(fact: CurrentFact): string {
  return fact.decidedAt ? `confirmed ${DATE.format(new Date(fact.decidedAt))}` : 'confirmed';
}

/** A photo's in-date is a judgement on the day it was checked, so the line says which day. */
function lineFor(fact: CurrentFact): string {
  const label = factLabel({ ...fact, method: 'code' });
  if (fact.method === 'jev' && fact.factKey.endsWith('.in_date')) {
    return `${label} (as of ${DATE.format(new Date(fact.checkedAt))})`;
  }
  return label;
}

export function CertificatesTab({ transactionId }: TransactionTabProps): JSX.Element {
  const [facts, setFacts] = useState<CurrentFact[] | null>(null);

  useEffect(() => {
    let active = true;
    void loadCurrentFacts(transactionId).then((loaded) => {
      if (active) setFacts(loaded.filter((f) => f.status === 'confirmed'));
    });
    return () => {
      active = false;
    };
  }, [transactionId]);

  if (facts === null) {
    return <p className="text-sm text-gray-500 dark:text-slate-400">Loading certificates...</p>;
  }
  const groups = GROUPS.map((g) => ({ ...g, facts: facts.filter((f) => f.factKey.startsWith(`${g.prefix}.`)) })).filter(
    (g) => g.facts.length > 0,
  );
  if (groups.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-slate-400">
        No certificates confirmed yet. When the seller uploads a gas safety record, EICR, EPC, FENSA or building
        regulations certificate and confirms what it says, it appears here.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <section
          key={group.prefix}
          aria-label={group.title}
          className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-slate-100">
            <FileCheck2 className="h-4 w-4 text-teal-600" aria-hidden="true" />
            {group.title}
          </h3>
          <ul className="mt-2 space-y-1">
            {group.facts.map((fact) => (
              <li key={fact.factKey} className="flex flex-wrap justify-between gap-2 text-sm">
                <span className="text-gray-800 dark:text-slate-200">{lineFor(fact)}</span>
                <span className="text-xs text-gray-500 dark:text-slate-400">{confirmedOn(fact)}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="text-xs text-gray-500 dark:text-slate-400">
        Read from the seller&apos;s uploads and confirmed by the seller. Each confirmation is recorded on the audit
        trail with the file&apos;s fingerprint.
      </p>
    </div>
  );
}

export default CertificatesTab;
