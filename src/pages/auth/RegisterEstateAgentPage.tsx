// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useEstateAgentSignup } from '../../hooks/useEstateAgentSignup';
import { storePendingInviteUrl } from '../../utils/pendingInviteUrl';
import BlueprintBackground from '../../components/common/BlueprintBackground';
import RegisterEstateAgentBusinessStep from '../../components/estate-agent/RegisterEstateAgentBusinessStep';
import RegisterEstateAgentAccountStep from '../../components/estate-agent/RegisterEstateAgentAccountStep';
import RegisterEstateAgentCheckEmailStep from '../../components/estate-agent/RegisterEstateAgentCheckEmailStep';
import RegisterEstateAgentPageHeader from '../../components/estate-agent/RegisterEstateAgentPageHeader';

/**
 * RegisterEstateAgentPage — Door 3 signup for estate agents (estate-agent
 * portal phase 1). Same two-step shape as the developer door; Companies
 * House is optional. All state and behaviour live in useEstateAgentSignup;
 * this component is just a thin render.
 *
 * Arriving from a seller's invitation (`?invite=<code>`), the invitation is
 * stored so the first sign-in after email verification returns to it and the
 * sale joins the new agency's listings (see utils/pendingInviteUrl).
 */
const INVITE_CODE = /^[0-9a-f]{64}$/;

const RegisterEstateAgentPage: React.FC = () => {
  const signup = useEstateAgentSignup();
  const [searchParams] = useSearchParams();
  const inviteParam = searchParams.get('invite') ?? '';
  const hasInvite = INVITE_CODE.test(inviteParam);

  useEffect(() => {
    if (hasInvite) storePendingInviteUrl(`/agent/join/${inviteParam}`);
  }, [hasInvite, inviteParam]);

  return (
    <div className="relative min-h-screen bg-[#FAFAF8]/70 text-[#1A1A1A]">
      <BlueprintBackground />
      <RegisterEstateAgentPageHeader />
      <main className="relative z-10 mx-auto max-w-[640px] px-6 py-16">
        {hasInvite && signup.step !== 'check-email' && (
          <p data-testid="agent-invite-note" className="mb-8 border-l-2 border-[#0D9488] pl-4 font-[DM_Sans] text-sm text-[#374151]">
            You are joining from a seller&rsquo;s invitation. Once your account is set up, the sale is added to your listings.
          </p>
        )}
        {signup.step === 'business' && (
          <RegisterEstateAgentBusinessStep
            value={signup.businessDetails}
            onChange={signup.setBusinessDetails}
            onContinue={signup.handleBusinessContinue}
            error={signup.businessError}
            chLookupLoading={signup.chLookupLoading}
            chLookupRan={signup.chLookupRan}
            isDissolved={signup.isDissolved}
          />
        )}
        {signup.step === 'account' && (
          <RegisterEstateAgentAccountStep
            agencyName={signup.businessDetails.agencyName}
            email={signup.email}
            password={signup.password}
            passwordConfirm={signup.passwordConfirm}
            onEmailChange={signup.setEmail}
            onPasswordChange={signup.setPassword}
            onPasswordConfirmChange={signup.setPasswordConfirm}
            onSubmit={signup.handleSignupSubmit}
            onBack={signup.goToBusiness}
            error={signup.error}
            isLoading={signup.signupLoading}
          />
        )}
        {signup.step === 'check-email' && (
          <RegisterEstateAgentCheckEmailStep email={signup.email} onBack={signup.goToAccount} fromInvite={hasInvite} />
        )}
      </main>
    </div>
  );
};

export default RegisterEstateAgentPage;
