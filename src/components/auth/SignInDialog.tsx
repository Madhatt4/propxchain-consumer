// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import React, { useEffect, useRef } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { X } from 'lucide-react';

import LoginForm, { LOGIN_FORM_LEDE_ID } from './LoginForm';
import { useAuthStore } from '../../stores/authStore';
import { getPostLoginRoute } from '../../pages/auth/postLoginRoute';

/** Search param that opens the dialog. */
export const SIGN_IN_PARAM = 'signin';

/** What the landing page's "Log in" links point at. */
export const SIGN_IN_URL = `/?${SIGN_IN_PARAM}=1`;

/**
 * Sign-in as a floating card over the landing page, so someone who came to
 * read about PropXchain can log in without losing their place.
 *
 * The open state is the URL (`/?signin=1`), not component state: Back closes
 * the card, the link survives a reload, and middle-clicking "Log in" still
 * opens a working page in a new tab. /login is untouched and remains the
 * destination for everything that needs a real route — ProtectedRoute's
 * `state.from`, session expiry, password resets.
 *
 * Styled from literal hex rather than the shadcn theme tokens: the card is
 * deliberately light in both landing themes (the marketing page runs its own
 * light/dark toggle, and `bg-background` would follow the *app* theme instead).
 * Built on the Radix primitives rather than ui/dialog.tsx because that wrapper
 * hard-codes `bg-background`, its own close button, and centred positioning —
 * this card needs none of the three.
 */
const SignInDialog: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const { isAuthenticated, isInitialized } = useAuthStore();

  const isOpen = searchParams.get(SIGN_IN_PARAM) !== null;

  // The nav offers "Log in" whether or not you already are, and /login has
  // always answered that by sending a signed-in visitor to their dashboard.
  // The card has to do the same or it asks people to sign in twice.
  //
  // getPostLoginRoute() consumes the pending-invite localStorage entry as a
  // side effect, so it must run at most once — the same StrictMode
  // double-invoke hazard LoginPage guards against.
  const hasRedirectedRef = useRef(false);
  useEffect(() => {
    if (hasRedirectedRef.current) return;
    if (isOpen && isInitialized && isAuthenticated) {
      hasRedirectedRef.current = true;
      navigate(getPostLoginRoute(), { replace: true });
    }
  }, [isOpen, isInitialized, isAuthenticated, navigate]);

  const close = (): void => {
    // Popping returns to a clean landing URL and leaves no card behind the
    // Back button. Someone who opened a shared /?signin=1 link has nothing to
    // pop — `key` is 'default' only on the first entry of a session — so drop
    // the param instead of walking them off the site. Other params (utm_*)
    // are preserved either way.
    if (location.key === 'default') {
      const next = new URLSearchParams(searchParams);
      next.delete(SIGN_IN_PARAM);
      setSearchParams(next, { replace: true });
    } else {
      navigate(-1);
    }
  };

  return (
    <DialogPrimitive.Root
      open={isOpen && !isAuthenticated}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[150] bg-[#0A0F1E]/55 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />

        <DialogPrimitive.Content
          aria-describedby={LOGIN_FORM_LEDE_ID}
          className="fixed inset-x-0 bottom-0 z-[151] max-h-[92vh] overflow-y-auto rounded-t-2xl bg-white text-[#1A1A1A] shadow-[0_24px_60px_-12px_rgba(10,15,30,0.45)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[85vh] sm:w-[26rem] sm:max-w-[calc(100%-2rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:data-[state=closed]:slide-out-to-bottom-0 sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95"
        >
          {/* The card floats over marketing copy with no other chrome — the
              wordmark is the only thing saying whose password box this is. */}
          <div className="flex items-center justify-between rounded-t-2xl border-b border-[#E5E7EB] bg-[#F0F5F0] px-6 py-3 sm:rounded-t-xl">
            <span className="font-fraunces text-base font-semibold tracking-tight text-[#1A1A1A]">
              PropX<span className="text-[#0D9488]">chain</span>
            </span>
            <span className="font-geist-mono text-[10px] uppercase tracking-[0.16em] text-[#5F8A68]">
              Secure sign-in
            </span>
          </div>

          <DialogPrimitive.Close
            aria-label="Close sign in"
            className="absolute right-3 top-2.5 inline-flex h-9 w-9 items-center justify-center rounded-md text-[#6B7280] transition-colors hover:bg-[#DAE5DC] hover:text-[#1A1A1A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0D9488]"
          >
            <X className="h-4 w-4" />
          </DialogPrimitive.Close>

          <div className="px-6 pb-7 pt-6">
            <DialogPrimitive.Title className="font-fraunces text-[1.75rem] font-semibold leading-tight tracking-tight text-[#1A1A1A]">
              Sign in.
            </DialogPrimitive.Title>

            <LoginForm onSuccess={() => navigate(getPostLoginRoute())} />
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

export default SignInDialog;
