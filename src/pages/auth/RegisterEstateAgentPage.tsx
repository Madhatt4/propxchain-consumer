// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import React from 'react';
import { useEstateAgentSignup } from '../../hooks/useEstateAgentSignup';
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
 */
const RegisterEstateAgentPage: React.FC = () => {
  const signup = useEstateAgentSignup();

  return (
    <div className="relative min-h-screen bg-[#FAFAF8]/70 text-[#1A1A1A]">
      <BlueprintBackground />
      <RegisterEstateAgentPageHeader />
      <main className="relative z-10 mx-auto max-w-[640px] px-6 py-16">
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
          <RegisterEstateAgentCheckEmailStep email={signup.email} onBack={signup.goToAccount} />
        )}
      </main>
    </div>
  );
};

export default RegisterEstateAgentPage;
