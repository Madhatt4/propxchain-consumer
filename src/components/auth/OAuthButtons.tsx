// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabaseAuthService } from '../../services/supabase.auth.service';
import {
  clearOAuthSignUpIntent,
  rememberOAuthSignUpIntent,
} from '../../utils/oauthSignUpIntent';

type Provider = 'google' | 'azure';

interface OAuthButtonsProps {
  disabled?: boolean;
  /**
   * 'sign-up' when these buttons sit on a register page. OAuth cannot refuse a
   * duplicate the way signUp does, so the callback uses this to say it signed
   * the user in rather than letting them believe they registered.
   */
  intent?: 'sign-in' | 'sign-up';
}

const GoogleMark: React.FC = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
    <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z" />
  </svg>
);

const MicrosoftMark: React.FC = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#F25022" d="M2 2h9.5v9.5H2z" />
    <path fill="#7FBA00" d="M12.5 2H22v9.5h-9.5z" />
    <path fill="#00A4EF" d="M2 12.5h9.5V22H2z" />
    <path fill="#FFB900" d="M12.5 12.5H22V22h-9.5z" />
  </svg>
);

const PROVIDERS: { id: Provider; label: string; Mark: React.FC }[] = [
  { id: 'google', label: 'Continue with Google', Mark: GoogleMark },
  { id: 'azure', label: 'Continue with Microsoft', Mark: MicrosoftMark },
];

const OAuthButtons: React.FC<OAuthButtonsProps> = ({ disabled, intent = 'sign-in' }) => {
  const [pending, setPending] = useState<Provider | null>(null);

  const start = async (provider: Provider): Promise<void> => {
    setPending(provider);
    if (intent === 'sign-up') rememberOAuthSignUpIntent();
    const { error } = await supabaseAuthService.signInWithOAuth(provider);
    // On success the browser redirects away; if it returns, the redirect
    // failed, so clear the spinner — and the intent with it, or it would
    // still be sitting there on an unrelated sign-in later in this tab.
    if (error) {
      clearOAuthSignUpIntent();
      setPending(null);
    }
  };

  return (
    <div className="space-y-3">
      {PROVIDERS.map(({ id, label, Mark }) => (
        <button
          key={id}
          type="button"
          onClick={() => start(id)}
          disabled={disabled || pending !== null}
          className="flex w-full items-center justify-center gap-3 rounded-md border border-[#E5E7EB] bg-white px-4 py-3 font-dm-sans text-sm font-medium text-[#1A1A1A] transition-colors hover:border-[#84A98C] hover:bg-[#F0F5F0] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending === id ? <Loader2 className="h-5 w-5 animate-spin text-[#5F8A68]" /> : <Mark />}
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
};

export default OAuthButtons;
