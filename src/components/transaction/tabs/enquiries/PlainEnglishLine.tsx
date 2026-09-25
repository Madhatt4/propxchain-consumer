// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The plain-English line under an enquiry (agent CRM spec I1, R2.3): what
 * the conveyancers are asking each other, in everyday words, for every party.
 * Served from the cache the platform filled when the enquiry was raised; a
 * first look at an older enquiry asks the platform to write it once.
 */
import { useEffect, useState } from 'react';
import { explainEnquiry, getEnquiryExplanation } from '@/services/enquiries.service';

interface Props { enquiryId: string }

type State = { kind: 'loading' } | { kind: 'ready'; text: string } | { kind: 'none' };

export function PlainEnglishLine({ enquiryId }: Props): JSX.Element | null {
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let live = true;
    setState({ kind: 'loading' });
    (async () => {
      const cached = await getEnquiryExplanation(enquiryId).catch(() => null);
      if (cached) return cached.plain_english;
      const fresh = await explainEnquiry(enquiryId).catch(() => null);
      return fresh?.plain_english ?? null;
    })().then((text) => {
      if (live) setState(text ? { kind: 'ready', text } : { kind: 'none' });
    });
    return () => {
      live = false;
    };
  }, [enquiryId]);

  if (state.kind === 'none') return null;
  return (
    <p data-testid="plain-english" className="rounded-md border-l-2 border-[#0D9488] bg-[#CCFBF1]/30 px-3 py-2 text-sm text-gray-800 dark:bg-[#14B8A6]/10 dark:text-gray-200">
      <span className="font-medium text-[#0F766E] dark:text-[#5EEAD4]">In plain English: </span>
      {state.kind === 'loading' ? <span className="text-muted-foreground">working out what this means…</span> : state.text}
    </p>
  );
}
