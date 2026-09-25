// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import React from 'react';
import { Link } from 'react-router-dom';

/** Top nav bar shared by the estate agent signup steps: brand + sign-in link. */
const RegisterEstateAgentPageHeader: React.FC = () => (
  <header className="relative z-10 border-b border-[#E5E7EB] bg-[#FAFAF8]/80 backdrop-blur-sm">
    <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-5">
      <Link
        to="/"
        className="font-[Fraunces] text-xl font-bold tracking-tight text-[#1A1A1A] transition-colors hover:text-[#0D9488]"
      >
        PropX<span className="text-[#0D9488]">chain</span>
      </Link>
      <Link to="/login" className="font-[DM_Sans] text-sm text-[#1A1A1A] transition-colors hover:text-[#0D9488]">
        Already have an account? Sign in
      </Link>
    </div>
  </header>
);

export default RegisterEstateAgentPageHeader;
