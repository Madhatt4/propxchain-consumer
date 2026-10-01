// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The first question an estate agent is asked when starting a transaction:
 * are you acting for a seller? Yes goes to the listing import (property link,
 * then the seller's name and email, then the transaction flow). No means the
 * agent is joining a transaction someone else started, so they enter its code;
 * with no code there is only the way back to the dashboard.
 */

import { Link } from 'react-router-dom';
import { ArrowLeft, Home, Link2 } from 'lucide-react';

import { ROLE_PRICE_COPY } from '@/components/auth/roleCards.config';

const CARD_CLASS =
  'flex min-h-11 flex-col gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-5 text-left transition-colors duration-200 ease-out hover:border-[#0D9488] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0D9488]';

export default function AgentStartGate(): JSX.Element {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <Link
        to="/dashboard"
        className="mb-6 inline-flex min-h-11 items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-main)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to dashboard
      </Link>

      <h1 className="font-[Fraunces] text-3xl font-semibold text-[var(--text-main)]">
        Are you acting for a seller?
      </h1>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">{ROLE_PRICE_COPY}</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link to="/estate-agent/listings/new" className={CARD_CLASS}>
          <Home className="h-6 w-6 text-[#0D9488]" aria-hidden="true" />
          <span className="font-medium text-[var(--text-main)]">Yes, I&apos;m acting for a seller</span>
          <span className="text-sm text-[var(--text-secondary)]">
            Add the property link and the seller&apos;s name and email. The seller is invited by link.
          </span>
        </Link>

        <Link to="/join" className={CARD_CLASS}>
          <Link2 className="h-6 w-6 text-[#0D9488]" aria-hidden="true" />
          <span className="font-medium text-[var(--text-main)]">No, I have a transaction code</span>
          <span className="text-sm text-[var(--text-secondary)]">
            Enter the code from the person who started the transaction.
          </span>
        </Link>
      </div>
    </div>
  );
}
