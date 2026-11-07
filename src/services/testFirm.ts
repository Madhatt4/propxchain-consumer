// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import { supabase } from '../lib/supabase';

// Test conveyancer firms (conveyancer_panel.is_test) exist for PropXchain's own
// end-to-end tests. The database already hides them from everyone except test
// accounts; this repeats the rule in the app, and also keeps test accounts to
// test firms only, so a test run never contacts a real conveyancer.
//
// A test account carries app_metadata.propxchain_test_account = true, which
// only the server can set (users can edit user_metadata, not app_metadata).

interface FirmFlag {
  is_test?: boolean | null;
}

/** Whether the signed-in user is a test account. False when signed out or on any error. */
export async function currentUserIsTestAccount(): Promise<boolean> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user?.app_metadata?.propxchain_test_account === true;
  } catch {
    return false;
  }
}

/** Keeps the firms this user may see: real firms for clients, test firms for test accounts. */
export function keepFirmsFor<T extends FirmFlag>(rows: T[], isTestAccount: boolean): T[] {
  return rows.filter((r) => (r.is_test === true) === isTestAccount);
}
