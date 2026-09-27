// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The frame around the support pages: the shared top bar and nothing else.
 *
 * Support is reached from every portal — buyer and seller, conveyancer, estate
 * agent, developer — so it must not wear any one portal's navigation. These
 * pages used to render the buyer/seller sidebar, which walked a conveyancer
 * who asked for help straight into the seller dashboard.
 *
 * Without a `backTo`, Back returns to wherever the user came from; opened
 * cold (a link from an email), it goes to `/post-login`, which sends each
 * role to its own home.
 */
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import AppTopBar from '@/components/navigation/AppTopBar';

interface SupportShellProps {
  title: string;
  /** A fixed parent, for pages that sit under another support page. */
  backTo?: string;
  backLabel?: string;
  children: ReactNode;
}

/** React Router keeps its own history index; 0 means this is the first entry. */
function hasInAppHistory(): boolean {
  const state = window.history.state as { idx?: number } | null;
  return typeof state?.idx === 'number' && state.idx > 0;
}

export default function SupportShell({ title, backTo, backLabel = 'Back', children }: SupportShellProps): JSX.Element {
  const navigate = useNavigate();
  const goBack = (): void => {
    if (hasInAppHistory()) navigate(-1);
    else navigate('/post-login');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <AppTopBar title={title} backTo={backTo} onBack={backTo ? undefined : goBack} backLabel={backLabel} />
      <main className="px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
