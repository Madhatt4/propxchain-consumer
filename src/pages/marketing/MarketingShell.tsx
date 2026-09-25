// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import React, { type ReactNode } from 'react';
import MarketingHeader from './MarketingHeader';
import MarketingFooter from './MarketingFooter';

/**
 * Marketing layout shell — chrome only.
 *
 * Wraps the secondary marketing pages (About, Features, FAQ, guides) with
 * a shared header and footer. Zero data, zero conditional rendering,
 * zero props beyond children. If a future page needs different chrome,
 * fork this — do not add props.
 *
 * The existing v1 ConsumerLandingPage at `/` does NOT use this shell;
 * it has its own header/footer baked in and stays untouched.
 */
const MarketingShell: React.FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#1A1A1A] dark:bg-[#0B1120] dark:text-[#E5E7EB] transition-colors">
      <MarketingHeader />
      <main>{children}</main>
      <MarketingFooter />
    </div>
  );
};

export default MarketingShell;
