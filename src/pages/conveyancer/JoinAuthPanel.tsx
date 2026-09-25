/**
 * JoinAuthPanel — the sign-up / sign-in / reset form on the conveyancer
 * activation page.
 *
 * Extracted from JoinConveyancerPage so both files stay inside the 300-line
 * rule once the login and reset paths landed.
 *
 * WHY ALL THREE MODES LIVE HERE, not on /login:
 *
 * The activation code is in the URL. Navigating away to sign in means the
 * code has to survive the round trip in localStorage and be picked up later
 * by the dashboard — which works, but every hop is a chance to lose it, and
 * Marc lost it twice in testing. Signing in on this page keeps the code in
 * the URL where it started: authenticate, then redeem, same mount.
 *
 * The bug this fixes: an existing firm hit "Create account", got
 * "An account with this email already exists. Try signing in, or use
 * 'Forgot password' to reset." — and the page offered neither. The copy
 * named two exits that were not on the screen. The only way out was a small
 * link in the header, which is exactly the class of problem the UX audit
 * flagged. See docs/2026-07-28-consumer-ux-audit.md (P1).
 */
import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabaseAuthService } from '../../services/supabase.auth.service';
import { conveyancerJoinService } from '../../services/conveyancerJoin.service';
import { useAuthStore } from '../../stores/authStore';

export type JoinAuthMode = 'signup' | 'login' | 'reset';

interface JoinAuthPanelProps {
  /** Activation code from the URL. Stashed before any navigation away. */
  code: string;
  /** Firm name from the invitation preview, used as the account name. */
  firmName?: string | null;
  /** Signed up successfully — parent shows "check your email". */
  onAwaitingVerification: (email: string) => void;
  /** Signed in successfully — parent starts redeeming immediately. */
  onAuthenticated: () => void;
}

const inputClasses =
  'mt-2 w-full rounded-md border border-[#E5E7EB] bg-white px-4 py-3 font-[DM_Sans] text-base text-[#1A1A1A] focus:border-[#0D9488] focus:outline-none focus:ring-1 focus:ring-[#0D9488] dark:border-gray-600 dark:bg-gray-800 dark:text-white';

const primaryButtonClasses =
  'inline-flex min-h-12 w-full items-center justify-center rounded-md bg-[#0D9488] px-8 py-3 font-[DM_Sans] text-base font-medium text-white transition-colors hover:bg-[#0F766E] disabled:cursor-not-allowed disabled:bg-[#9CA3AF]';

// 44px minimum (WCAG 2.5.5) and an underline, so these read as controls
// rather than the small grey text the audit flagged.
const switchLinkClasses =
  'inline-flex min-h-11 items-center font-[DM_Sans] text-sm font-medium text-[#0D9488] underline underline-offset-2 hover:text-[#0F766E] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0D9488]';

const COPY: Record<JoinAuthMode, { heading: string; blurb: string; submit: string }> = {
  signup: {
    heading: 'Create your account',
    blurb:
      "Your firm's details come straight from the CLC register — nothing to re-type; you can check them from your dashboard.",
    submit: 'Create account & join',
  },
  login: {
    heading: 'Sign in to join',
    blurb: 'Your firm already has a PropXchain account. Sign in and we will add this transaction to your dashboard.',
    submit: 'Sign in & join',
  },
  reset: {
    heading: 'Reset your password',
    blurb: 'We will email you a reset link. Your invitation is saved — come back to this link afterwards, or just sign in.',
    submit: 'Email me a reset link',
  },
};

const JoinAuthPanel: React.FC<JoinAuthPanelProps> = ({
  code,
  firmName,
  onAwaitingVerification,
  onAuthenticated,
}) => {
  const loginWithEmail = useAuthStore((s) => s.loginWithEmail);

  const [mode, setMode] = useState<JoinAuthMode>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  // Distinct from formError: this one comes with an escape hatch rendered
  // next to it, because the user cannot fix it by retyping.
  const [accountExists, setAccountExists] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const switchMode = (next: JoinAuthMode): void => {
    setMode(next);
    setFormError(null);
    setAccountExists(false);
    setResetSent(false);
    setPassword('');
  };

  const handleSignup = async (): Promise<void> => {
    if (password.length < 8) {
      setFormError('Choose a longer password — at least 8 characters.');
      return;
    }
    const result = await supabaseAuthService.signUp(email, password, {
      name: firmName || email,
      role: 'solicitor',
    });
    if (result.error) {
      // signUp() converts Supabase's anti-enumeration fake-success into a
      // real 422. That is the case where retyping cannot help, so we offer
      // the two real ways forward instead of just printing the message.
      if (result.error.status === 422 || /already exists/i.test(result.error.message ?? '')) {
        setAccountExists(true);
        setFormError(null);
        return;
      }
      setFormError(result.error.message || 'Sign up failed. Please try again.');
      return;
    }
    conveyancerJoinService.stashPendingJoinCode(code);
    onAwaitingVerification(email);
  };

  const handleLogin = async (): Promise<void> => {
    // Stash before authenticating, not after. loginWithEmail can succeed and
    // still trigger a route change elsewhere; if that happens the dashboard
    // needs to find the code.
    conveyancerJoinService.stashPendingJoinCode(code);
    const ok = await loginWithEmail(email, password);
    if (!ok) {
      setFormError(useAuthStore.getState().error || 'Sign in failed. Check your email and password.');
      return;
    }
    onAuthenticated();
  };

  const handleReset = async (): Promise<void> => {
    conveyancerJoinService.stashPendingJoinCode(code);
    const { error } = await supabaseAuthService.resetPassword(email);
    if (error) {
      setFormError(error.message || 'Could not send the reset email. Please try again.');
      return;
    }
    setResetSent(true);
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setFormError(null);
    setBusy(true);
    try {
      if (mode === 'signup') await handleSignup();
      else if (mode === 'login') await handleLogin();
      else await handleReset();
    } catch {
      setFormError('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (mode === 'reset' && resetSent) {
    return (
      <div className="rounded-lg border border-[#0D9488]/30 bg-[#F0F5F0] p-5 dark:bg-teal-900/10">
        <p className="font-[DM_Sans] text-base text-[#374151] dark:text-gray-300">
          Reset link sent to <strong className="text-[#1A1A1A] dark:text-white">{email}</strong>. Set a new
          password, then come back to this page — your invitation is still valid.
        </p>
        <button type="button" onClick={() => switchMode('login')} className={`${switchLinkClasses} mt-3`}>
          Back to sign in
        </button>
      </div>
    );
  }

  const copy = COPY[mode];

  return (
    <section aria-label={copy.heading}>
      <h2 className="font-[Fraunces] text-xl font-semibold text-[#1A1A1A] dark:text-white">{copy.heading}</h2>
      <p className="mt-2 font-[DM_Sans] text-sm text-[#6B7280] dark:text-gray-400">{copy.blurb}</p>

      <form onSubmit={(e) => { void handleSubmit(e); }} className="mt-6 space-y-6">
        <div>
          <label htmlFor="join-email" className="block font-[DM_Sans] text-sm font-medium text-[#1A1A1A] dark:text-gray-200">
            Work email address
          </label>
          <input
            id="join-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className={inputClasses}
          />
        </div>

        {mode !== 'reset' && (
          <div>
            <label htmlFor="join-password" className="block font-[DM_Sans] text-sm font-medium text-[#1A1A1A] dark:text-gray-200">
              Password
            </label>
            <input
              id="join-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              aria-describedby={mode === 'signup' ? 'join-password-hint' : undefined}
              className={inputClasses}
            />
            {mode === 'signup' && (
              <p id="join-password-hint" className="mt-1 font-[DM_Sans] text-xs text-[#6B7280] dark:text-gray-400">
                At least 8 characters.
              </p>
            )}
          </div>
        )}

        {accountExists && (
          <div
            role="alert"
            className="rounded-md border border-[#0D9488]/40 bg-[#F0F5F0] p-4 dark:border-teal-700/40 dark:bg-teal-900/20"
          >
            <p className="font-[DM_Sans] text-sm text-[#1A1A1A] dark:text-gray-200">
              Your firm already has a PropXchain account. Sign in instead — the email address stays as you typed it.
            </p>
            <div className="mt-3 flex flex-wrap gap-4">
              <button type="button" onClick={() => switchMode('login')} className={switchLinkClasses}>
                Sign in instead
              </button>
              <button type="button" onClick={() => switchMode('reset')} className={switchLinkClasses}>
                Forgot password?
              </button>
            </div>
          </div>
        )}

        {formError && (
          <div
            role="alert"
            className="rounded-md border border-[#DC2626]/30 bg-[#FEF2F2] p-3 font-[DM_Sans] text-sm text-[#DC2626] dark:border-red-800/40 dark:bg-red-900/20"
          >
            {formError}
          </div>
        )}

        <button type="submit" disabled={busy} className={primaryButtonClasses}>
          {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : copy.submit}
        </button>
      </form>

      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-[#E5E7EB] pt-4 dark:border-gray-700">
        {mode !== 'signup' && (
          <button type="button" onClick={() => switchMode('signup')} className={switchLinkClasses}>
            Create a new account
          </button>
        )}
        {mode !== 'login' && (
          <button type="button" onClick={() => switchMode('login')} className={switchLinkClasses}>
            Already have an account? Sign in
          </button>
        )}
        {mode === 'login' && (
          <button type="button" onClick={() => switchMode('reset')} className={switchLinkClasses}>
            Forgot password?
          </button>
        )}
      </div>
    </section>
  );
};

export default JoinAuthPanel;
