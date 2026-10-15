// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import React, { useState } from 'react';
import { Check, X } from 'lucide-react';

import { factLabel } from '../../../../services/documentFacts.service';
import type { DocFact, FactDecision, FactDecisionResult } from '../../../../services/documentFacts.service';

export interface FactSuggestionsProps {
  refCode: string;
  facts: DocFact[];
  decide: (factId: string, decision: FactDecision) => Promise<FactDecisionResult>;
}

type RowState =
  | { kind: 'pending' }
  | { kind: 'saving' }
  | { kind: 'decided'; decision: FactDecision; anchored: boolean }
  | { kind: 'error'; message: string };

const DECIDED_TEXT: Readonly<Record<FactDecision, string>> = {
  confirmed: 'Confirmed',
  rejected: 'Marked not right',
};

/**
 * "We read this as ..." for a certificate upload: one line per suggested
 * fact with Confirm / Not right, on the upload row itself (decision Q17).
 * Nothing counts until the seller confirms it.
 */
export const FactSuggestions: React.FC<FactSuggestionsProps> = ({ refCode, facts, decide }) => {
  const [rows, setRows] = useState<Record<string, RowState>>({});
  if (facts.length === 0) return null;

  const stateOf = (id: string): RowState => rows[id] ?? { kind: 'pending' };
  const setRow = (id: string, state: RowState): void => setRows((prev) => ({ ...prev, [id]: state }));

  const handle = async (fact: DocFact, decision: FactDecision): Promise<void> => {
    setRow(fact.id, { kind: 'saving' });
    try {
      const result = await decide(fact.id, decision);
      setRow(fact.id, { kind: 'decided', decision: result.decision, anchored: result.anchored });
    } catch (err) {
      setRow(fact.id, { kind: 'error', message: err instanceof Error ? err.message : 'That did not save.' });
    }
  };

  return (
    <div className="basis-full space-y-1.5" aria-label={`${refCode} suggested facts`}>
      <p className="text-xs font-medium text-gray-600 dark:text-slate-300">We read this as:</p>
      <ul className="space-y-1.5">
        {facts.map((fact) => {
          const state = stateOf(fact.id);
          const label = factLabel(fact);
          return (
            <li key={fact.id} className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-gray-800 dark:text-slate-100">{label}</span>
              {(state.kind === 'pending' || state.kind === 'error') && (
                <>
                  <button
                    type="button"
                    onClick={() => void handle(fact, 'confirmed')}
                    aria-label={`Confirm: ${label}`}
                    className="inline-flex items-center gap-1 rounded-full bg-teal-600 px-2.5 py-0.5 font-semibold text-white hover:bg-teal-700"
                  >
                    <Check className="h-3 w-3" aria-hidden="true" />
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => void handle(fact, 'rejected')}
                    aria-label={`Not right: ${label}`}
                    className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 font-semibold text-gray-700 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-200"
                  >
                    <X className="h-3 w-3" aria-hidden="true" />
                    Not right
                  </button>
                </>
              )}
              {state.kind === 'saving' && <span className="text-gray-500">Saving...</span>}
              {state.kind === 'decided' && (
                <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                  {DECIDED_TEXT[state.decision]}
                  {!state.anchored && ' (saved; audit trail entry pending)'}
                </span>
              )}
              {state.kind === 'error' && <span className="text-red-600">{state.message}</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
};
