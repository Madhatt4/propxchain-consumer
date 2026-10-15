// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

// Loads the transaction's confirmed certificate facts once and lets them fill
// blank TA6 answers (factsPrefill.ts), once. The filled sections are marked
// dirty so the seller sees and saves them; nothing is saved on their behalf.

import { useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

import { prefillTa6FromFacts, SUGGESTED_EICR, SUGGESTED_WINDOWS } from './factsPrefill';
import { loadCurrentFacts } from '../../../services/documentFacts.service';
import type { CurrentFact } from '../../../services/documentFacts.service';
import type { TA6PropertyInformation } from '../../../types/ta6.types';

const STEP_FOR_SUGGESTION: Readonly<Record<string, number>> = {
  [SUGGESTED_EICR]: 11,
  [SUGGESTED_WINDOWS]: 5,
};

export interface FactsPrefillState {
  form: TA6PropertyInformation;
  setForm: Dispatch<SetStateAction<TA6PropertyInformation>>;
  setDirtySteps: Dispatch<SetStateAction<ReadonlySet<number>>>;
}

/** The answers filled from facts, for the "suggested from your upload" badge. */
export function useFactsPrefill(
  transactionId: string,
  readOnly: boolean,
  { form, setForm, setDirtySteps }: FactsPrefillState,
): ReadonlySet<string> {
  const [facts, setFacts] = useState<CurrentFact[] | null>(null);
  const [suggested, setSuggested] = useState<ReadonlySet<string>>(new Set());
  const applied = useRef(false);

  useEffect(() => {
    if (readOnly) return undefined;
    let active = true;
    void loadCurrentFacts(transactionId).then((loaded) => {
      if (active) setFacts(loaded);
    });
    return () => {
      active = false;
    };
  }, [transactionId, readOnly]);

  useEffect(() => {
    if (!facts || applied.current) return;
    applied.current = true;
    const result = prefillTa6FromFacts(form, facts);
    if (result.suggested.length === 0) return;
    setForm(result.form);
    setSuggested(new Set(result.suggested));
    setDirtySteps((prev) => {
      const next = new Set(prev);
      for (const ref of result.suggested) next.add(STEP_FOR_SUGGESTION[ref]);
      return next;
    });
  }, [facts, form, setForm, setDirtySteps]);

  return suggested;
}
