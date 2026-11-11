// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * "Can't see it?" block for every place we tell someone a confirmation email
 * is on its way: the check-your-email step of each sign-up page, and the
 * sign-in error when the account is not confirmed yet.
 *
 * Why it exists: real sign-ups were stuck unconfirmed because the first email
 * went to spam and there was no way to ask for another. The sender name in the
 * copy must match auth-email-hook (monorepo `_shared/email/layout.ts` sends as
 * "PropXchain <noreply@propxchain.com>"), or people search their inbox for the
 * wrong thing.
 */
import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

import {
  classifyResendError,
  RESEND_COOLDOWN_SECONDS,
  RESEND_NETWORK_MESSAGE,
  RESEND_RATE_LIMITED_MESSAGE,
  RESEND_SENT_MESSAGE,
  SENDER_ADDRESS,
  type ResendOutcome,
} from '../../lib/resendConfirmation';
import { supabaseAuthService } from '../../services/supabase.auth.service';

interface ResendState {
  isSending: boolean;
  secondsLeft: number;
  outcome: ResendOutcome | null;
  send: () => Promise<void>;
}

function useResendConfirmation(email: string): ResendState {
  const [isSending, setIsSending] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [outcome, setOutcome] = useState<ResendOutcome | null>(null);

  useEffect(() => {
    if (secondsLeft <= 0) return undefined;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const send = async (): Promise<void> => {
    if (isSending || secondsLeft > 0 || !email) return;
    setIsSending(true);
    setOutcome(null);
    try {
      const { error } = await supabaseAuthService.resendSignupConfirmation(email);
      setOutcome(classifyResendError(error));
    } catch {
      setOutcome('network');
    } finally {
      setIsSending(false);
      // Every attempt starts the cooldown, a refused one included: the limit
      // is on the server, so hammering the button only extends it.
      setSecondsLeft(RESEND_COOLDOWN_SECONDS);
    }
  };

  return { isSending, secondsLeft, outcome, send };
}

const OUTCOME_COPY: Record<ResendOutcome, string> = {
  sent: RESEND_SENT_MESSAGE,
  rate_limited: RESEND_RATE_LIMITED_MESSAGE,
  network: RESEND_NETWORK_MESSAGE,
};

interface ResendConfirmationProps {
  /** The address the confirmation was (or should be) sent to. */
  email: string;
  /** Centre the block on pages whose check-email step is centred. */
  align?: 'left' | 'center';
}

const ResendConfirmation: React.FC<ResendConfirmationProps> = ({ email, align = 'left' }) => {
  const { isSending, secondsLeft, outcome, send } = useResendConfirmation(email);
  const isCoolingDown = secondsLeft > 0;

  return (
    <div className={`mt-6 font-dm-sans text-sm text-[#6B7280] ${align === 'center' ? 'text-center' : ''}`}>
      <p>
        Can&apos;t see it? Check your junk or spam folder. It comes from PropXchain ({SENDER_ADDRESS}).
      </p>
      <button
        type="button"
        onClick={() => void send()}
        disabled={isSending || isCoolingDown || !email}
        className="mt-2 inline-flex min-h-11 items-center gap-2 font-medium text-[#0D9488] underline underline-offset-2 transition-colors hover:text-[#0F766E] disabled:cursor-not-allowed disabled:text-[#9CA3AF] disabled:no-underline"
      >
        {isSending && <Loader2 className="h-4 w-4 animate-spin" />}
        {isCoolingDown ? `Send it again in ${secondsLeft}s` : 'Send it again'}
      </button>
      {outcome && (
        <p role="status" className={outcome === 'sent' ? 'mt-1 text-[#1A1A1A]' : 'mt-1 text-[#9A3412]'}>
          {OUTCOME_COPY[outcome]}
        </p>
      )}
    </div>
  );
};

export default ResendConfirmation;
