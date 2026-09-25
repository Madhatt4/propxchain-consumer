// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useMembershipsQuery } from './useMembershipsQuery';
import { writeCookie, LAST_USED_ROLE_COOKIE } from './cookies';
import type { OrganisationMembership, OrganisationType } from './decideRoute';

/**
 * Stub role picker — functional only. Real design pass comes in wave 1c.
 *
 * Lists the current user's memberships as clickable buttons. Clicking
 * a membership writes the chosen org type to the `lastUsedRole` cookie
 * and navigates back to `/post-login`, which re-runs `<AuthGate>` with
 * the cookie now populated.
 */

const ROLE_LABEL: Record<OrganisationType, string> = {
  consumer: 'Consumer',
  developer: 'Developer',
  agent: 'Estate agent',
  solicitor_firm: 'Solicitor firm',
};

const RolePickerPage: React.FC = () => {
  const navigate = useNavigate();
  const supabaseUser = useAuthStore((s) => s.supabaseUser);
  const { data: memberships, isLoading, isError, refetch } =
    useMembershipsQuery(supabaseUser?.id);

  const handlePick = (m: OrganisationMembership): void => {
    writeCookie(LAST_USED_ROLE_COOKIE, m.organisationType);
    navigate('/post-login', { replace: true });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Failed to load your accounts — please refresh.
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="min-h-11 min-w-[44px] px-4 py-2 text-sm font-medium rounded-md bg-gray-800 text-white hover:bg-gray-700"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-4">
        <header className="space-y-1">
          <h1 className="text-xl font-semibold">Choose an account</h1>
          <p className="text-sm text-muted-foreground">
            You belong to multiple organisations. Pick which one to open.
          </p>
        </header>
        <ul className="space-y-2" aria-label="Your organisations">
          {(memberships ?? []).map((m) => (
            <li key={m.organisationId}>
              <button
                type="button"
                onClick={() => handlePick(m)}
                className="w-full min-h-11 px-4 py-3 text-left text-sm rounded-md border border-border hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <div className="font-medium">{m.organisationId}</div>
                <div className="text-xs text-muted-foreground">
                  {ROLE_LABEL[m.organisationType]} · {m.role}
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
};

export default RolePickerPage;
