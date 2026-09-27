// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Sends a "book a demo" request to the `demo-request` edge function, which
 * emails it to the PropXchain inbox. Nothing is stored.
 */

import { supabase } from '@/lib/supabase';

export interface DemoRequestInput {
  company: string;
  name: string;
  email: string;
  /** Honeypot. Always empty for a person; the edge function drops the request if set. */
  website: string;
}

export async function requestDemo(input: DemoRequestInput): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke<{ success?: boolean }>('demo-request', {
      body: input,
    });
    return !error && data?.success === true;
  } catch {
    // invoke can throw on a network failure rather than returning an error.
    return false;
  }
}
