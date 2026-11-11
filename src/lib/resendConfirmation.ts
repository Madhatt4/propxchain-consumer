// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Copy and error mapping for the sign-up confirmation resend
 * (components/auth/ResendConfirmation). Kept out of the component file so it
 * stays a components-only module for fast refresh.
 */
import type { AuthError } from '@supabase/supabase-js';

/** Seconds the button stays disabled after each send. Supabase rate-limits resends. */
export const RESEND_COOLDOWN_SECONDS = 60;

export const SENDER_ADDRESS = 'noreply@propxchain.com';

export const RESEND_SENT_MESSAGE = 'Sent. Check your inbox and your junk/spam folder.';

export const RESEND_RATE_LIMITED_MESSAGE =
  "We've sent a few already. Please wait a minute, then try again.";

export const RESEND_NETWORK_MESSAGE =
  "We couldn't reach PropXchain. Check your connection and try again.";

export type ResendOutcome = 'sent' | 'rate_limited' | 'network';

/**
 * Map a resend result to what we show. Anything that is not a rate limit or a
 * dropped connection is reported as sent, so the page never reveals whether
 * an address has an account (no account, already confirmed, and so on).
 */
export function classifyResendError(error: AuthError | null): ResendOutcome {
  if (!error) return 'sent';
  const message = (error.message || '').toLowerCase();
  if (
    error.status === 429 ||
    error.code === 'over_email_send_rate_limit' ||
    error.code === 'over_request_rate_limit' ||
    message.includes('rate limit') ||
    message.includes('only request this after')
  ) {
    return 'rate_limited';
  }
  if (error.name === 'AuthRetryableFetchError' || error.status === 0) return 'network';
  return 'sent';
}
