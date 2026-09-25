// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Home, Key, Sparkles, ArrowLeft } from 'lucide-react';
import AppTopBar from '@/components/navigation/AppTopBar';

type Tier = 'starter' | 'premium';
type Role = 'buyer' | 'seller';

/**
 * Tier picker shown when a user clicks "Start a Transaction" from the dashboard.
 *
 * Stage 1 — pick tier: Starter (free, no Stripe, no bundled services) or
 *                       Premium (£75 per transaction, full platform).
 * Stage 2 — only for Starter: pick role (Buyer / Seller).
 *
 * Premium users always go through the property-details + Stripe flow.
 * Starter Sellers go through the property-details flow but skip Stripe.
 * Starter Buyers go straight to the invite-code page.
 *
 * The chosen tier is persisted in localStorage.pendingTier so downstream
 * views can gate features (AI brief, conveyancer quotes, search ordering).
 */
export default function StartTransactionPage(): JSX.Element {
  const navigate = useNavigate();
  const [tier, setTier] = useState<Tier | null>(null);

  const handleTier = (chosen: Tier): void => {
    if (chosen === 'premium') {
      localStorage.setItem('pendingTier', 'premium');
      navigate('/create-transaction');
      return;
    }
    // Starter always asks buying vs selling for THIS transaction. Do NOT
    // shortcut on onboardingRole: authStore rewrites that key from the
    // account's user_metadata.role on every login, so a buyer-role account
    // would skip the picker and land on /join when clicking Starter from the
    // dashboard. The picker is the intended per-transaction choice point.
    setTier('starter');
  };

  const handleRole = (role: Role): void => {
    localStorage.setItem('pendingTier', 'starter');
    localStorage.setItem('onboardingRole', role);
    localStorage.setItem('userType', role);
    if (role === 'seller') {
      navigate('/create-transaction');
    } else {
      navigate('/join');
    }
  };

  return (
    <div className="min-h-screen">
      <AppTopBar title="Start a transaction" backTo="/dashboard" backLabel="Back to dashboard" />

      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-slate-900 dark:to-slate-900 py-4 sm:py-8 px-3 sm:px-4">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => (tier === 'starter' ? setTier(null) : navigate('/dashboard'))}
            className="min-h-11 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 flex items-center gap-2 mb-6"
          >
            <ArrowLeft className="h-5 w-5" />
            {tier === 'starter' ? 'Back' : 'Back to Dashboard'}
          </button>

          {tier === null ? <TierPicker onSelect={handleTier} /> : <RolePicker onSelect={handleRole} />}
        </div>
      </div>
    </div>
  );
}

function TierPicker({ onSelect }: { onSelect: (tier: Tier) => void }): JSX.Element {
  return (
    <>
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold mb-2">Start a Transaction</h1>
        <p className="text-muted-foreground text-lg">Choose how you want to use PropXchain.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-gray-200 dark:border-slate-700 hover:border-gray-400 dark:hover:border-slate-500 hover:shadow-lg transition-all">
          <CardHeader>
            <CardTitle className="text-2xl">Starter</CardTitle>
            <CardDescription>Free platform access. Pay per use.</CardDescription>
            <div className="mt-4">
              <span className="text-4xl font-bold">FREE</span>
              <span className="text-muted-foreground ml-2">no platform fee</span>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 mb-6 text-sm">
              <FeatureRow text="Property tracking and document storage" />
              <FeatureRow text="Invite buyer or seller via code" />
              <FeatureRow text="£7 per HMLR title pull — check who owns the property" />
              <FeatureRow text="Search fees paid as you go" />
              <FeatureRow text="No AI brief, no conveyancer quote engine" muted />
              <FeatureRow text="No included searches" muted />
            </ul>
            <Button variant="outline" className="w-full" onClick={() => onSelect('starter')}>
              Continue with Starter
            </Button>
          </CardContent>
        </Card>

        <Card className="border-gray-800 bg-gray-900 text-white shadow-xl relative">
          <div className="absolute -top-3 right-4 bg-white text-gray-900 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
            <Sparkles className="h-3 w-3" /> RECOMMENDED
          </div>
          <CardHeader>
            <CardTitle className="text-2xl text-white">Premium</CardTitle>
            <CardDescription className="text-gray-300">Full platform, everything bundled.</CardDescription>
            <div className="mt-4">
              <span className="text-4xl font-bold">£75</span>
              <span className="text-gray-300 ml-2">per transaction</span>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 mb-6 text-sm">
              <FeatureRow text="Everything in Starter" dark />
              <FeatureRow text="AI title-register brief" dark />
              <FeatureRow text="Conveyancer quote engine (instant panel quotes)" dark />
              <FeatureRow text="Free property searches" dark />
              <FeatureRow text="1 HMLR title search included" dark />
              <FeatureRow text="1 plans search included" dark />
            </ul>
            <Button className="w-full bg-white text-gray-900 hover:bg-gray-100" onClick={() => onSelect('premium')}>
              Continue with Premium
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function RolePicker({ onSelect }: { onSelect: (role: Role) => void }): JSX.Element {
  return (
    <>
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold mb-2">Are you buying or selling?</h1>
        <p className="text-muted-foreground text-lg">Starter is free for both sides.</p>
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

function FeatureRow({
  text,
  muted = false,
  dark = false,
}: {
  text: string;
  muted?: boolean;
  dark?: boolean;
}): JSX.Element {
  const checkColor = dark ? 'text-white' : muted ? 'text-gray-300' : 'text-green-600';
  const textColor = dark ? 'text-gray-100' : muted ? 'text-gray-400' : 'text-gray-700 dark:text-gray-300';
  return (
    <li className="flex items-start gap-2">
      <Check className={`h-4 w-4 mt-0.5 flex-shrink-0 ${checkColor}`} />
      <span className={textColor}>{text}</span>
    </li>
  );
}
