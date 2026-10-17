// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

// Loads the transaction's confirmed certificate facts and lets them fill blank
// TA6 answers (factsPrefill.ts): on load, and again when the seller confirms a
// fact on an upload in this session, so 11.3 answers itself the moment the
// EICR is confirmed. The filled sections are marked dirty so the seller sees
// and saves them; nothing is saved on their behalf.

import { useCallback, useEffect, useRef, useState } from 'react';
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
  /** When the stored form was last edited; null when it has never been saved. */
  savedAt: string | null;
}

export interface FactsPrefill {
  /** The answers filled from facts, for the "suggested from your upload" badge. */
  suggested: ReadonlySet<string>;
  /** Reload the facts and fill again; call after the seller confirms one. */
  refresh: () => void;
}

export function useFactsPrefill(
  transactionId: string,
  readOnly: boolean,
  { form, setForm, setDirtySteps, savedAt }: FactsPrefillState,
): FactsPrefill {
  const [facts, setFacts] = useState<CurrentFact[] | null>(null);
  const [suggested, setSuggested] = useState<ReadonlySet<string>>(new Set());
  const [loads, setLoads] = useState(0);
  // The form as it is now, read when facts land rather than re-filling on every edit.
  const latestForm = useRef(form);
  latestForm.current = form;

  useEffect(() => {
    if (readOnly) return undefined;
    let active = true;
    void loadCurrentFacts(transactionId).then((loaded) => {
      if (active) setFacts(loaded);
    });
    return () => {
      active = false;
    };
  }, [transactionId, readOnly, loads]);

  // Each load fills once. Only blanks are filled, so a later load cannot undo
  // an answer the seller has given since.
  useEffect(() => {
    if (!facts) return;
    const result = prefillTa6FromFacts(latestForm.current, facts, savedAt);
    if (result.suggested.length === 0) return;
    setForm(result.form);
    setSuggested((prev) => new Set([...prev, ...result.suggested]));
    setDirtySteps((prev) => {
      const next = new Set(prev);
      for (const ref of result.suggested) next.add(STEP_FOR_SUGGESTION[ref]);
      return next;
    });
  }, [facts, savedAt, setForm, setDirtySteps]);

  const refresh = useCallback(() => setLoads((n) => n + 1), []);

  return { suggested, refresh };
}
