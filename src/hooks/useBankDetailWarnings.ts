// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { useEffect, useRef } from 'react';
import { mentionsBankDetails } from '@/utils/bankDetailMentions';

interface Readable {
  id: string;
  sender: string;
  content: string;
}

/**
 * Which of these messages should carry the bank-detail warning for this
 * reader (never their own), and puts "warning shown" on the audit trail once
 * per message. The canister refuses repeats and non-recipients; the ref only
 * saves the round trip within this visit.
 */
export function useBankDetailWarnings(
  messages: Readable[],
  me: string | null | undefined,
  record: (messageId: string) => Promise<unknown>,
): (message: Readable) => boolean {
  const recorded = useRef(new Set<string>());
  const warns = (m: Readable) => m.sender !== me && mentionsBankDetails(m.content);

  useEffect(() => {
    for (const m of messages) {
      if (recorded.current.has(m.id) || !warns(m)) continue;
      recorded.current.add(m.id);
      void record(m.id);
    }
    // warns only reads `me`, which is a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, me, record]);

  return warns;
}
