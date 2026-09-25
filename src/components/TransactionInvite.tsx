// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import React, { useState, useEffect } from 'react';
import { useThemeClasses } from '../hooks/useThemeClasses';
import { Transaction } from '../types/transaction.types';
import { icpService } from '../services/icp.service';
import { scrapeRightmoveListing as scrapePropertyListing } from '@/services/rightmove.service';
import { storeRightmoveData } from '@/utils/rightmoveStorage';
import { isValidInviteCode, normaliseInviteCode, formatInviteCodeInput } from '@/utils/inviteCode';
import { logger } from '@/utils/logger';
import SolicitorOnboarding from './auth/SolicitorOnboarding';
import type { SolicitorRecord, RegulatoryBody } from '../types/solicitor.types';
import { getStorePrincipalId, getStoreIsAuthenticated } from '../stores/authStore';
import { partyRoleService } from '../services/partyRole.service';
import type { PartyRole } from '../services/shareParty.service';
import type { InviteContext } from '@/utils/inviteContext';

interface TransactionInviteProps {
  onJoinSuccess: (transaction: Transaction) => void;
  onClose?: () => void;
  initialCode?: string;
  rightmoveUrl?: string;
  /** Role / side / inviter hints carried on the join link (wallet spec decision 15). */
  inviteContext?: InviteContext;
}

type JoinRole = 'buyer' | 'seller' | 'solicitor' | 'estate-agent' | 'mortgage-broker' | 'lender' | 'other';

/** Join-screen role → the off-chain party role recorded for the Transaction Wallet roster. */
const PARTY_ROLE_BY_JOIN_ROLE: Record<JoinRole, PartyRole> = {
  buyer: 'buyer',
  seller: 'seller',
  solicitor: 'conveyancer',
  'estate-agent': 'estate_agent',
  'mortgage-broker': 'mortgage_broker',
  lender: 'lender',
  other: 'other',
};

const JOIN_ROLE_BY_INVITE_ROLE: Record<string, JoinRole> = {
  buyer: 'buyer',
  seller: 'seller',
  conveyancer: 'solicitor',
  estate_agent: 'estate-agent',
  mortgage_broker: 'mortgage-broker',
  lender: 'lender',
  other: 'other',
};

const EXTRA_ROLES: ReadonlyArray<{ value: JoinRole; label: string }> = [
  { value: 'mortgage-broker', label: 'Mortgage broker' },
  { value: 'lender', label: 'Lender' },
  { value: 'other', label: 'Someone else' },
];

const TransactionInvite: React.FC<TransactionInviteProps> = ({ onJoinSuccess, onClose, initialCode, rightmoveUrl, inviteContext }) => {
  const themeClasses = useThemeClasses();
  const [inviteCode, setInviteCode] = useState(initialCode || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedRole, setSelectedRole] = useState<JoinRole>(
    (inviteContext?.role && JOIN_ROLE_BY_INVITE_ROLE[inviteContext.role]) || 'buyer',
  );
  const [buyerCount, setBuyerCount] = useState<1 | 2>(1);
  const [step, setStep] = useState<'enter-code' | 'select-role' | 'solicitor-onboarding' | 'success'>('enter-code');
  const [foundTransaction, setFoundTransaction] = useState<Transaction | null>(null);
  const [gdprConsent, setGdprConsent] = useState(false);

  // Update invite code when initialCode prop changes
  useEffect(() => {
    if (initialCode && initialCode !== inviteCode) {
      setInviteCode(initialCode);
    }
  }, [initialCode]);

  // Format/validation live in utils/inviteCode. The old inline pair rejected
  // anything a user TYPED, because the formatter injected a "TX-" prefix on
  // every keystroke — including while they were typing the prefix themselves.
  const validateInviteCode = (code: string): boolean => isValidInviteCode(code);

  // Keep the user's keystrokes. No prefix injection — see utils/inviteCode.
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInviteCode(formatInviteCodeInput(e.target.value));
    setError('');
  };

  // The field holds whatever the user typed. EVERY canister/Supabase lookup
  // must use the canonical form instead — otherwise verification succeeds on
  // a normalised code and the join that follows sends the raw one.
  const canonicalCode = normaliseInviteCode(inviteCode) ?? inviteCode;

  const handleVerifyCode = async () => {
    // The field holds whatever the user typed; canonicalCode above is the
    // single normalised form every lookup uses.
    if (!isValidInviteCode(inviteCode)) {
      setError('Invalid invite code format. Expected: TX-XXXX-XXXX (e.g., TX-JPEN-Z4HM)');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Initialize ICP service
      await icpService.initialize();

      // Get transaction by invite code from the canister
      const transaction = await icpService.getTransactionByInviteCode(canonicalCode);

      if (!transaction) {
        // Fallback: check if this is a developer plot invite code in Supabase
        const { supabase } = await import('@/lib/supabase');
        // plot_by_invite_code answers only for the exact code; the plots table
        // itself is no longer readable by strangers (security scan L1).
        const { data: plot } = await supabase
          .rpc('plot_by_invite_code', { p_code: canonicalCode })
          .maybeSingle<{ id: string; site_id: string; plot_number: string; sale_price_pence: number | null }>();

        if (plot) {
          setFoundTransaction({
            id: plot.id,
            inviteCode: canonicalCode,
            propertyAddress: `Plot ${plot.plot_number}`,
            postcode: '',
            seller: '',
            buyer: '',
            status: 'pending',
            transactionType: 'sale',
            mode: 'development',
            propertyType: 'New Build',
            propertyCategory: `Plot ${plot.plot_number}`,
            amount: plot.sale_price_pence ? plot.sale_price_pence / 100 : 0,
          } as unknown as Transaction);
          setStep('select-role');
          setIsLoading(false);
          return;
        }

        setError('Transaction not found. Please check the invite code and try again.');
        setIsLoading(false);
        return;
      }

      // Get current user principal
      const principalId = getStorePrincipalId();
      const isAuthenticated = getStoreIsAuthenticated();

      if (!principalId || !isAuthenticated) {
        setError('You must be logged in to join a transaction.');
        setIsLoading(false);
        return;
      }

      // Check if user is already part of the transaction (buyer, seller, or in access list)
      const isBuyer = transaction.buyer === principalId;
      const isSeller = transaction.seller === principalId;
      const isCreator = transaction.createdBy === principalId;

      if (isBuyer || isSeller || isCreator) {
        setError('You are already part of this transaction.');
        setIsLoading(false);
        return;
      }

      // Store found transaction and move to role selection
      setFoundTransaction(transaction as Transaction);
      setStep('select-role');

    } catch (err: unknown) {
      logger.error('Error verifying transaction on canister:', err);

      // Fallback: canister threw — try Supabase developer plot codes
      try {
        const { supabase } = await import('@/lib/supabase');
        // plot_by_invite_code answers only for the exact code; the plots table
        // itself is no longer readable by strangers (security scan L1).
        const { data: plot } = await supabase
          .rpc('plot_by_invite_code', { p_code: canonicalCode })
          .maybeSingle<{ id: string; site_id: string; plot_number: string; sale_price_pence: number | null }>();

        if (plot) {
          setFoundTransaction({
            id: plot.id,
            inviteCode: canonicalCode,
            propertyAddress: `Plot ${plot.plot_number}`,
            postcode: '',
            seller: '',
            buyer: '',
            status: 'pending',
            transactionType: 'sale',
            mode: 'development',
            propertyType: 'New Build',
            propertyCategory: `Plot ${plot.plot_number}`,
            amount: plot.sale_price_pence ? plot.sale_price_pence / 100 : 0,
          } as unknown as Transaction);
          setStep('select-role');
          setIsLoading(false);
          return;
        }
      } catch (sbErr) {
        logger.error('Supabase fallback also failed:', sbErr);
      }

      setError((err instanceof Error ? err.message : null) || 'Failed to verify transaction. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const deriveActingFor = (tx: Transaction): 'buyer' | 'seller' => {
    // If no buyer solicitor slot filled, default to buyer side
    if (!('buyerSolicitor' in tx) || !(tx as unknown as Record<string, unknown>)['buyerSolicitor']) {
      return 'buyer';
    }
    if (!('sellerSolicitor' in tx) || !(tx as unknown as Record<string, unknown>)['sellerSolicitor']) {
      return 'seller';
    }
    return 'buyer';
  };

  const toCandidSolicitorRecord = (record: SolicitorRecord): Record<string, unknown> => {
    const regulatoryBodyVariant: Record<RegulatoryBody, Record<string, null>> = {
      sra: { sra: null },
      clc: { clc: null },
    };
    return {
      ...record,
      regulatoryBody: regulatoryBodyVariant[record.regulatoryBody],
    };
  };

  const handleJoinTransaction = async () => {
    if (!foundTransaction) return;

    // Solicitors go through the onboarding flow instead of joining directly
    if (selectedRole === 'solicitor') {
      setStep('solicitor-onboarding');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Get current user principal
      const principalId = getStorePrincipalId();
      const isAuthenticated = getStoreIsAuthenticated();

      if (!principalId || !isAuthenticated) {
        setError('You must be logged in to join a transaction.');
        setIsLoading(false);
        return;
      }

      // Developer plot flow — create on-chain transaction with developer as
      // seller (so buyer/seller view derivation works naturally), reserve
      // plot in Supabase.
      if ((foundTransaction as unknown as Record<string, unknown>).mode === 'development') {
        const { supabase } = await import('@/lib/supabase');
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) {
          setError('You must be logged in to join a transaction.');
          setIsLoading(false);
          return;
        }

        // Listing columns via plots_public: the table itself is members-only.
        const { data: plot } = await supabase
          .from('plots_public')
          .select('id, plot_number, sale_price_pence, expected_practical_completion, site_id')
          .eq('id', foundTransaction.id)
          .single();

        if (!plot) {
          setError('Plot data not found.');
          setIsLoading(false);
          return;
        }

        // Resolve developer's pinned ICP principal via SECURITY DEFINER RPC
        // (development_sites is org-only RLS — the buyer can't read it directly).
        const { data: developerPrincipal, error: principalError } = await supabase
          .rpc('get_plot_developer_principal', { p_plot_id: plot.id });

        if (principalError) {
          logger.error('get_plot_developer_principal RPC failed:', principalError);
          setError('Unable to resolve developer for this plot. Please try again.');
          setIsLoading(false);
          return;
        }

        if (!developerPrincipal) {
          setError(
            "This developer hasn't completed onboarding yet — their identity needs to be locked in before plots can be sold. Please ask them to log in once."
          );
          setIsLoading(false);
          return;
        }

        // Use data already available from foundTransaction (avoids development_sites RLS)
        const propertyAddress = foundTransaction.propertyAddress || `Plot ${plot.plot_number}`;
        const propertyType = foundTransaction.propertyType || 'New Build';

        // 1. Create on-chain transaction with developer as seller, buyer = caller.
        //    Passing `seller` makes the canister set buyer/seller to distinct
        //    principals — no separate assignBuyer round-trip needed.
        await icpService.initialize();
        const txResult = await icpService.createTransaction({
          propertyId: plot.id,
          propertyAddress,
          postcode: '',
          titleNumber: '',
          previousOwner: '',
          amount: plot.sale_price_pence ? plot.sale_price_pence / 100 : 0,
          transactionType: 'sale',
          userRole: 'developer',
          propertyType,
          propertyCategory: `Plot ${plot.plot_number}`,
          mode: 'development',
          deposit: 0,
          mortgageAmount: 0,
          completionDate: plot.expected_practical_completion ?? '',
          seller: developerPrincipal,
        });

        if (!txResult?.transactionId) {
          setError('Failed to create on-chain transaction.');
          setIsLoading(false);
          return;
        }

        const canisterTxId = String(txResult.transactionId);

        // 2. Reserve the plot in Supabase and link to canister transaction
        const { error: reserveError } = await supabase
          .from('plots')
          .update({
            reservation_status: 'reserved',
            reserved_by_buyer_user_id: userData.user.id,
            reserved_at: new Date().toISOString(),
            transaction_id: canisterTxId,
          })
          .eq('id', plot.id)
          .eq('reservation_status', 'available');

        if (reserveError) {
          setError('Failed to reserve plot. It may already be taken.');
          setIsLoading(false);
          return;
        }

        // The buyer CREATED this deal, so no invite proves them to RLS; the
        // chain-verified writer records their buyer row instead (best-effort).
        void partyRoleService.recordRoleFromChain(canisterTxId);

        // Store buyer count
        if (selectedRole === 'buyer') {
          const txPartyCount = JSON.parse(localStorage.getItem('txPartyCount') || '{}');
          txPartyCount[plot.id] = { buyerCount };
          localStorage.setItem('txPartyCount', JSON.stringify(txPartyCount));
        }

        setStep('success');
        setTimeout(() => {
          onJoinSuccess(foundTransaction);
        }, 1500);
      } else {
        // Consumer flow — join via ICP canister. For buyers we use the
        // atomic AsBuyer variant which adds caller to accessList AND
        // assigns them as buyer in a single canister call (with the lock
        // held). Closes the 2-call race the previous implementation had
        // (joinTransactionByInviteCode + assignBuyer): if assignBuyer
        // failed, the joiner was stuck in accessList with buyer slot
        // still on the seller placeholder, and deriveUserRole showed
        // them the seller view. The atomic method either both or neither.
        // The canister gates against displacing an already-assigned buyer.
        const updatedTransaction =
          selectedRole === 'buyer'
            ? await icpService.joinTransactionByInviteCodeAsBuyer(canonicalCode)
            : await icpService.joinTransactionByInviteCode(canonicalCode);

        if (selectedRole === 'buyer') {
          // Store buyer count for this transaction (used for document checklist)
          const txPartyCount = JSON.parse(localStorage.getItem('txPartyCount') || '{}');
          txPartyCount[foundTransaction.id] = {
            ...txPartyCount[foundTransaction.id],
            buyerCount: buyerCount
          };
          localStorage.setItem('txPartyCount', JSON.stringify(txPartyCount));
        }

        // Record my role + side off-chain for the Transaction Wallet roster (best-effort).
        const myPrincipal = getStorePrincipalId();
        if (myPrincipal) {
          const partyRole = PARTY_ROLE_BY_JOIN_ROLE[selectedRole];
          const side =
            partyRole === 'buyer' || partyRole === 'seller' ? partyRole : inviteContext?.side ?? null;
          void partyRoleService.recordMyRole({
            transactionId: String(foundTransaction.id),
            principal: myPrincipal,
            role: partyRole,
            side,
            invitedBy: inviteContext?.invitedBy ?? null,
          });
        }

        // Fetch and store listing if URL was passed via invite link
        if (rightmoveUrl) {
          try {
            const { listing } = await scrapePropertyListing(rightmoveUrl);
            storeRightmoveData(foundTransaction.id, listing);
            logger.info('Listing data fetched for joined transaction');
          } catch (rmErr) {
            logger.warn('Failed to fetch listing (non-blocking):', rmErr);
          }
        }

        // Show success
        setStep('success');

        // Call success callback after a short delay
        setTimeout(() => {
          onJoinSuccess(updatedTransaction as Transaction);
        }, 1500);
      }

    } catch (err: any) {
      logger.error('Error joining transaction:', err);
      setError(err.message || 'Failed to join transaction. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isLoading && step === 'enter-code') {
      handleVerifyCode();
    }
  };

  return (
    <div className={`${themeClasses.cardBg} rounded-lg p-6 shadow-lg`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className={`text-xl font-bold ${themeClasses.textPrimary}`}>
          Join Transaction Chain
        </h3>
        {onClose && (
          <button
            onClick={onClose}
            className={`${themeClasses.textSecondary} hover:${themeClasses.textPrimary}`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Step 1: Enter Code */}
      {step === 'enter-code' && (
        <>
          <p className={`${themeClasses.textSecondary} mb-4`}>
            Enter the transaction invite code shared with you to join the property chain.
          </p>

          <div className="mb-4">
            <label htmlFor="join-invite-code" className={`block text-sm font-medium ${themeClasses.textPrimary} mb-2`}>
              Invite Code
            </label>
            <input
              id="join-invite-code"
              type="text"
              value={inviteCode}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              placeholder="TX-XXXX-XXXX"
              className={`w-full px-4 py-3 ${themeClasses.cardSecondary} ${themeClasses.textPrimary} rounded-lg font-mono text-lg tracking-wider text-center border-2 ${
                error ? 'border-red-500' : themeClasses.border
              } focus:outline-none focus:border-gray-500 transition-colors`}
              disabled={isLoading}
            />
            <p className={`text-xs ${themeClasses.textTertiary} mt-2`}>
              Format: TX-XXXX-XXXX (e.g., TX-A7F2-9K3L)
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-700 rounded-lg">
              <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
            </div>
          )}

          <button
            type="button"
            onClick={handleVerifyCode}
            disabled={isLoading || !validateInviteCode(inviteCode)}
            className={`w-full py-3 px-4 rounded-lg font-medium transition-all ${
              isLoading || !validateInviteCode(inviteCode)
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-gray-700 text-white hover:bg-gray-600'
            }`}
          >
            {isLoading ? (
              <div className="flex items-center justify-center">
                <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Verifying...
              </div>
            ) : (
              'Continue'
            )}
          </button>

          <div className={`mt-4 p-3 ${themeClasses.cardSecondary} rounded-lg`}>
            <p className={`text-xs ${themeClasses.textSecondary}`}>
              <strong>Note:</strong> By joining a transaction chain, you'll be able to see the progress of
              connected transactions while maintaining GDPR compliance. You'll only see full details of your own property.
            </p>
          </div>
        </>
      )}

      {/* Step 2: Select Role */}
      {step === 'select-role' && foundTransaction && (
        <>
          <p className={`${themeClasses.textSecondary} mb-4`}>
            Transaction found! Select your role in this transaction:
          </p>

          {/* Transaction Info */}
          <div className={`mb-6 p-4 ${themeClasses.cardSecondary} rounded-lg border-2 ${themeClasses.border}`}>
            <p className={`text-sm ${themeClasses.textTertiary} mb-1`}>Property Address</p>
            <p className={`text-lg font-semibold ${themeClasses.textPrimary}`}>{foundTransaction.propertyAddress}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className={`px-2 py-1 text-xs font-semibold rounded ${
                foundTransaction.mode === 'diy' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                foundTransaction.mode === 'hybrid' ? 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200' :
                'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
              }`}>
                {foundTransaction.mode === 'diy' ? 'DIY Mode' : foundTransaction.mode === 'hybrid' ? 'Hybrid Mode' : 'Professional Mode'}
              </span>
              <span className={`px-2 py-1 text-xs font-semibold rounded capitalize ${themeClasses.cardBg} ${themeClasses.textSecondary}`}>
                {foundTransaction.transactionType}
              </span>
            </div>
          </div>

          {/* Role Selection */}
          <div className="mb-6">
            <label className={`block text-sm font-medium ${themeClasses.textPrimary} mb-3`}>
              Select Your Role
            </label>
            <div className="grid grid-cols-1 gap-3">
              <button
                onClick={() => setSelectedRole('buyer')}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  selectedRole === 'buyer'
                    ? 'border-gray-500 bg-gray-200 dark:bg-gray-800/20'
                    : `${themeClasses.border} ${themeClasses.cardSecondary}`
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`font-semibold ${themeClasses.textPrimary}`}>Buyer</p>
                    <p className={`text-sm ${themeClasses.textTertiary}`}>I am purchasing this property</p>
                  </div>
                  {selectedRole === 'buyer' && (
                    <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </button>

              <button
                onClick={() => setSelectedRole('seller')}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  selectedRole === 'seller'
                    ? 'border-gray-500 bg-gray-200 dark:bg-gray-800/20'
                    : `${themeClasses.border} ${themeClasses.cardSecondary}`
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`font-semibold ${themeClasses.textPrimary}`}>Seller</p>
                    <p className={`text-sm ${themeClasses.textTertiary}`}>I am selling this property</p>
                  </div>
                  {selectedRole === 'seller' && (
                    <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </button>

              <button
                onClick={() => setSelectedRole('solicitor')}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  selectedRole === 'solicitor'
                    ? 'border-gray-500 bg-gray-200 dark:bg-gray-800/20'
                    : `${themeClasses.border} ${themeClasses.cardSecondary}`
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`font-semibold ${themeClasses.textPrimary}`}>Solicitor / Conveyancer</p>
                    <p className={`text-sm ${themeClasses.textTertiary}`}>Legal representative for this transaction</p>
                  </div>
                  {selectedRole === 'solicitor' && (
                    <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </button>

              <button
                onClick={() => setSelectedRole('estate-agent')}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  selectedRole === 'estate-agent'
                    ? 'border-gray-500 bg-gray-200 dark:bg-gray-800/20'
                    : `${themeClasses.border} ${themeClasses.cardSecondary}`
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`font-semibold ${themeClasses.textPrimary}`}>Estate Agent</p>
                    <p className={`text-sm ${themeClasses.textTertiary}`}>Property agent facilitating the sale</p>
                  </div>
                  {selectedRole === 'estate-agent' && (
                    <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </button>
            </div>
          </div>

          {/* Other roles (broker / lender / other) — kept compact */}
          <div className="mb-4">
            <label htmlFor="join-other-role" className={`block text-xs ${themeClasses.textTertiary} mb-1`}>
              Joining as someone else?
            </label>
            <select
              id="join-other-role"
              value={EXTRA_ROLES.some((r) => r.value === selectedRole) ? selectedRole : ''}
              onChange={(e) => {
                if (e.target.value) setSelectedRole(e.target.value as JoinRole);
              }}
              className={`w-full rounded-md border px-3 py-2 text-sm ${themeClasses.border} ${themeClasses.cardSecondary} ${themeClasses.textPrimary}`}
            >
              <option value="">— pick above, or choose —</option>
              {EXTRA_ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          {/* Buyer Count Selection - only show when buyer is selected */}
          {selectedRole === 'buyer' && (
            <div className="mb-6">
              <label className={`block text-sm font-medium ${themeClasses.textPrimary} mb-2`}>
                Who will be on the new title?
              </label>
              <p className={`text-xs ${themeClasses.textTertiary} mb-3`}>
                This determines how many sets of ID documents are required
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setBuyerCount(1)}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    buyerCount === 1
                      ? 'border-gray-500 bg-gray-200 dark:bg-gray-800/20'
                      : `${themeClasses.border} ${themeClasses.cardSecondary}`
                  }`}
                >
                  <div className="text-2xl mb-2">👤</div>
                  <p className={`text-sm font-medium ${themeClasses.textPrimary}`}>Just me</p>
                  <p className={`text-xs ${themeClasses.textTertiary}`}>Single buyer</p>
                </button>
                <button
                  type="button"
                  onClick={() => setBuyerCount(2)}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    buyerCount === 2
                      ? 'border-gray-500 bg-gray-200 dark:bg-gray-800/20'
                      : `${themeClasses.border} ${themeClasses.cardSecondary}`
                  }`}
                >
                  <div className="text-2xl mb-2">👥</div>
                  <p className={`text-sm font-medium ${themeClasses.textPrimary}`}>Me and my partner</p>
                  <p className={`text-xs ${themeClasses.textTertiary}`}>Joint buyers</p>
                </button>
              </div>
            </div>
          )}

          {/* GDPR consent — solicitor role only */}
          {selectedRole === 'solicitor' && (
            <div className="mb-6">
              <label className="flex items-start gap-3 cursor-pointer p-4 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-600/40 dark:bg-amber-900/10">
                <input
                  type="checkbox"
                  checked={gdprConsent}
                  onChange={(e) => setGdprConsent(e.target.checked)}
                  className="mt-0.5 w-4 h-4 shrink-0 accent-amber-500 cursor-pointer"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                  By inviting a solicitor/conveyancer, I consent to sharing all transaction data — including property details, party names, documents, and progress — with the invited professional. Transaction records stored on the Internet Computer blockchain cannot be erased after completion.
                </span>
              </label>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-700 rounded-lg">
              <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setStep('enter-code')}
              className={`flex-1 py-3 px-4 rounded-lg font-medium ${themeClasses.cardSecondary} ${themeClasses.textSecondary} hover:opacity-80 transition-colors`}
            >
              Back
            </button>
            <button
              onClick={handleJoinTransaction}
              disabled={isLoading || (selectedRole === 'solicitor' && !gdprConsent)}
              className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                isLoading || (selectedRole === 'solicitor' && !gdprConsent)
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-gray-700 text-white hover:bg-gray-600'
              }`}
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Joining...
                </div>
              ) : (
                'Join Transaction'
              )}
            </button>
          </div>
        </>
      )}

      {/* Step: Solicitor Onboarding */}
      {step === 'solicitor-onboarding' && foundTransaction && (
        <SolicitorOnboarding
          transactionId={foundTransaction.id}
          inviteCode={inviteCode}
          callerRole={deriveActingFor(foundTransaction)}
          onComplete={async (record) => {
            setIsLoading(true);
            setError('');
            try {
              // TODO: pass toCandidSolicitorRecord(record) to icpService.registerSolicitor(inviteCode, ...) once the canister method is wired
              void toCandidSolicitorRecord(record);
              const updatedTransaction = await icpService.joinTransactionByInviteCode(canonicalCode);
              setStep('success');
              setTimeout(() => {
                onJoinSuccess(updatedTransaction as Transaction);
              }, 1500);
            } catch (err: unknown) {
              const message = err instanceof Error ? err.message : 'Failed to join as solicitor.';
              logger.error('Solicitor join error:', err);
              setError(message);
              setStep('select-role');
            } finally {
              setIsLoading(false);
            }
          }}
          onBack={() => setStep('select-role')}
        />
      )}

      {/* Step 3: Success */}
      {step === 'success' && (
        <div className="text-center py-8">
          <div className="mb-4">
            <svg className="w-16 h-16 mx-auto text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h4 className={`text-xl font-bold ${themeClasses.textPrimary} mb-2`}>
            Successfully Joined!
          </h4>
          <p className={`${themeClasses.textSecondary} mb-2`}>
            You have been added to the transaction chain as a <span className="capitalize font-semibold">{selectedRole}</span>.
          </p>
          <p className={`text-sm ${themeClasses.textTertiary}`}>
            Loading chain view...
          </p>
        </div>
      )}
    </div>
  );
};

export default TransactionInvite;
