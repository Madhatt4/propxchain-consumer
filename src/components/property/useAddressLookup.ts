// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { useRef, useState } from 'react';

import { listPostcodeAddresses, type PostcodeAddress } from '@/services/epc.service';

/**
 * idle     — no lookup yet for the postcode in the box
 * loading  — asking the EPC register for the homes on it
 * listed   — homes found; the visitor picks one (or says theirs is missing)
 * unlisted — none found or the lookup failed; the visitor types the house
 */
export type LookupStatus = 'idle' | 'loading' | 'listed' | 'unlisted';

export interface AddressLookup {
  status: LookupStatus;
  addresses: PostcodeAddress[];
  /** The postcode the current list belongs to. */
  lookedUp: string | null;
  find: (postcode: string) => Promise<void>;
  reset: () => void;
}

export function useAddressLookup(): AddressLookup {
  const [status, setStatus] = useState<LookupStatus>('idle');
  const [addresses, setAddresses] = useState<PostcodeAddress[]>([]);
  const [lookedUp, setLookedUp] = useState<string | null>(null);
  // Only the newest lookup may write state, so a slow answer for an old
  // postcode cannot replace the list for the one now in the box.
  const latest = useRef(0);

  const find = async (postcode: string): Promise<void> => {
    const id = ++latest.current;
    setStatus('loading');
    setLookedUp(postcode);
    const found = await listPostcodeAddresses(postcode);
    if (id !== latest.current) return;
    setAddresses(found ?? []);
    setStatus(found && found.length > 0 ? 'listed' : 'unlisted');
  };

  const reset = (): void => {
    latest.current += 1;
    setStatus('idle');
    setAddresses([]);
    setLookedUp(null);
  };

  return { status, addresses, lookedUp, find, reset };
}
