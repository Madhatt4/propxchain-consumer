// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Sends a partner, sales or support enquiry to the `enquiry` edge function,
 * which emails it to the PropXchain inbox. Nothing is stored, and nothing
 * reaches a canister: these are a visitor's name and email, which must stay
 * off-chain where they can be erased.
 */

import { supabase } from '@/lib/supabase';

export type EnquiryKind = 'partner' | 'sales' | 'support';

export interface EnquiryInput {
  kind: EnquiryKind;
  name: string;
  email: string;
  /** Form-specific fields. The edge function keeps only the keys it knows for `kind`. */
  fields: Record<string, string>;
  /** Honeypot. Always empty for a person; the edge function drops the enquiry if set. */
  fax: string;
}

/** Resolves when the enquiry was emailed; throws otherwise so forms can show their fallback. */
export async function sendEnquiry(input: EnquiryInput): Promise<void> {
  const { data, error } = await supabase.functions.invoke<{ success?: boolean }>('enquiry', {
    body: input,
  });
  if (error || data?.success !== true) {
    throw new Error(`Enquiry not sent: ${error?.message ?? 'email failed'}`);
  }
}
