// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import React from 'react';
import { Link } from 'react-router-dom';
import BlueprintBackground from '../common/BlueprintBackground';

/**
 * AuthShell — split-panel chrome for the consumer auth surface.
 *
 * Desktop (lg+): sage-tinted brand aside on the left (40%, max 480px) with the
 * BlueprintBackground site plan as a quiet watermark; form lives on the right,
 * vertically centred, max-width 440px, on the warm off-white field.
 *
 * Tablet/mobile (<lg): aside collapses to a slim banner strip with wordmark and
 * one secondary link; form fills the rest.
 *
 * The shell intentionally has no card chrome around the form — the warm field
 * carries the surface, like a letterhead.
 */

export interface AuthShellTopLink {
  label: string;
  to: string;
}

interface AuthShellProps {
  children: React.ReactNode;
  /** Optional contextual link rendered at the top of the form pane (and the
   *  mobile banner). Used for "Sign in" on /register and "Get started" on
   *  /login. */
  topLink?: AuthShellTopLink;
}

const AuthShell: React.FC<AuthShellProps> = ({ children, topLink }) => {
  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#1A1A1A]">
      {/* Mobile / tablet banner (replaces the desktop aside) */}
      <header className="border-b border-[#E5E7EB] bg-[#F0F5F0] lg:hidden">
        <div className="flex items-center justify-between px-5 py-4">
          <Link
            to="/"
            className="font-fraunces text-xl font-bold tracking-tight text-[#1A1A1A]"
          >
            PropX<span className="text-[#0D9488]">chain</span>
          </Link>
          {topLink && (
            <Link
              to={topLink.to}
              className="font-dm-sans text-sm text-[#1A1A1A] transition-colors hover:text-[#0D9488]"
            >
              {topLink.label}
            </Link>
          )}
        </div>
      </header>

      <div className="grid min-h-[calc(100vh-65px)] lg:min-h-screen lg:grid-cols-[minmax(360px,40%)_1fr] xl:grid-cols-[minmax(420px,40%)_1fr]">
        {/* Brand panel — desktop only */}
        <aside className="relative hidden overflow-hidden bg-[#F0F5F0] lg:block">
          <BlueprintBackground variant="contained" />
          <div className="relative z-10 flex h-full flex-col px-12 py-10 xl:px-16">
            <Link
              to="/"
              className="font-fraunces text-2xl font-bold tracking-tight text-[#1A1A1A] transition-colors hover:text-[#0D9488]"
            >
              PropX<span className="text-[#0D9488]">chain</span>
            </Link>

            <div className="mt-auto pb-2">
              <p className="max-w-[26ch] font-fraunces text-3xl font-light italic leading-tight text-[#1A1A1A] xl:text-4xl">
                Conveyancing on the record.
              </p>
              <div className="mt-10 flex items-center gap-5 font-geist-mono text-[11px] uppercase tracking-[0.18em] text-[#5F8A68]">
                <span>HMLR</span>
                <span aria-hidden className="text-[#84A98C]">·</span>
                <span>ICP</span>
                <span aria-hidden className="text-[#84A98C]">·</span>
                <span>CLC</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Form pane */}
        <main className="flex items-center justify-center px-5 py-10 sm:px-10 lg:px-12 xl:px-16">
          <div className="w-full max-w-[440px]">
            {topLink && (
              <div className="mb-10 hidden justify-end lg:flex">
                <Link
                  to={topLink.to}
                  className="font-dm-sans text-sm text-[#6B7280] transition-colors hover:text-[#0D9488]"
                >
                  {topLink.label}
                </Link>
              </div>
            )}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AuthShell;
