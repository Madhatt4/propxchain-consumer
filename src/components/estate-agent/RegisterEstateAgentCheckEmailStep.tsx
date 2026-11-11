// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import React from 'react';

import ResendConfirmation from '../auth/ResendConfirmation';

interface RegisterEstateAgentCheckEmailStepProps {
  email: string;
  onBack: () => void;
  /** Signed up from a seller's invitation: say what happens to the sale. */
  fromInvite?: boolean;
}

/** Final step of estate agent signup: "check your email" confirmation. */
const RegisterEstateAgentCheckEmailStep: React.FC<RegisterEstateAgentCheckEmailStepProps> = ({ email, onBack, fromInvite = false }) => (
  <div className="text-center">
    <h1 className="font-[Fraunces] text-[2rem] font-semibold leading-tight tracking-tight text-[#1A1A1A] sm:text-[2.5rem]">
      Check your email.
    </h1>
    <p className="mt-4 font-[DM_Sans] text-base text-[#6B7280]">
      We sent a verification link to <strong>{email}</strong>. Click it to
      activate your account, then sign in to finish setting up your agent
      portal.
    </p>
    {fromInvite && (
      <p data-testid="agent-invite-next" className="mt-4 font-[DM_Sans] text-base text-[#6B7280]">
        When you sign in, the seller&rsquo;s sale is added to your listings. If you verify on another
        device, open the invitation link from the seller&rsquo;s email there and sign in.
      </p>
    )}
    <ResendConfirmation email={email} align="center" />
    <p className="mt-8 font-[DM_Sans] text-sm text-[#6B7280]">
      Wrong email?{' '}
      <button type="button" onClick={onBack} className="text-[#0D9488] hover:underline">
        Go back
      </button>
    </p>
  </div>
);

export default RegisterEstateAgentCheckEmailStep;
