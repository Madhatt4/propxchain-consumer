// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Home, Key, ArrowLeft } from 'lucide-react';
import AppTopBar from '@/components/navigation/AppTopBar';
import { usePortalKinds } from '@/components/navigation/usePortalSections';
import AgentStartGate from '@/components/estate-agent/AgentStartGate';
import { ROLE_PRICE_COPY } from '@/components/auth/roleCards.config';

type Role = 'buyer' | 'seller';

/**
 * Shown when a user clicks "Start transaction" on the dashboard.
 *
 * Estate agents get their own first question (are you acting for a seller?).
 * Everyone else picks buying or selling. The portal is free, so there is no
 * plan to choose: the choice is stored as the free ('starter') path, which
 * skips Stripe and sends sellers to the property-details flow and buyers to
 * the invite-code page. The Premium picker that used to sit in front of this
 * is hidden for now (the subscription tiers behind it are still in use).
 *
 * localStorage.pendingTier is still written so downstream views can gate
 * features (AI brief, conveyancer quotes, search ordering).
 */
export default function StartTransactionPage(): JSX.Element {
  const navigate = useNavigate();
  const isAgent = usePortalKinds().includes('agent');

  const handleRole = (role: Role): void => {
    localStorage.setItem('pendingTier', 'starter');
    // Chosen per transaction. Do NOT shortcut on onboardingRole: authStore
    // rewrites that key from the account's user_metadata.role on every login,
    // so a buyer-role account would skip this question.
    localStorage.setItem('onboardingRole', role);
    localStorage.setItem('userType', role);
    navigate(role === 'seller' ? '/create-transaction' : '/join');
  };

  if (isAgent) {
    return (
      <div className="min-h-screen">
        <AppTopBar title="Start a transaction" />
        <AgentStartGate />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <AppTopBar title="Start a transaction" backTo="/dashboard" backLabel="Back to dashboard" />

      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-slate-900 dark:to-slate-900 py-4 sm:py-8 px-3 sm:px-4">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => navigate('/dashboard')}
            className="min-h-11 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 flex items-center gap-2 mb-6"
          >
            <ArrowLeft className="h-5 w-5" />
            Back to Dashboard
          </button>

          <RolePicker onSelect={handleRole} />
        </div>
      </div>
    </div>
  );
}

function RolePicker({ onSelect }: { onSelect: (role: Role) => void }): JSX.Element {
  return (
    <>
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold mb-2">Are you buying or selling?</h1>
        <p className="text-muted-foreground text-lg">{ROLE_PRICE_COPY}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
        <Card
          className="cursor-pointer hover:shadow-lg transition-all hover:border-gray-800 dark:hover:border-slate-400"
          onClick={() => onSelect('seller')}
        >
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center mb-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-gray-800 shadow-lg">
                <Home className="h-8 w-8 text-white" />
              </div>
            </div>
            <CardTitle className="text-xl">I'm Selling</CardTitle>
            <CardDescription>List your property and invite the buyer.</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button className="w-full bg-gray-800 hover:bg-gray-700 text-white">Continue as Seller</Button>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-lg transition-all hover:border-gray-800 dark:hover:border-slate-400"
          onClick={() => onSelect('buyer')}
        >
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center mb-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-gray-800 shadow-lg">
                <Key className="h-8 w-8 text-white" />
              </div>
            </div>
            <CardTitle className="text-xl">I'm Buying</CardTitle>
            <CardDescription>Enter the invite code from your seller.</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button variant="outline" className="w-full">Continue as Buyer</Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
