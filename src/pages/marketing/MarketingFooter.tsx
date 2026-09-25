// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import React from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';

import { Logo } from '@/components/brand/Logo';

/**
 * Marketing footer — used by MarketingShell only. Same content on
 * every marketing page. DESIGN.md compliant: Fraunces wordmark, DM
 * Sans body, sage accents, no decorative gradients.
 */
const MarketingFooter: React.FC = () => {
  const { isDark } = useTheme();

  return (
    <footer className="border-t border-[#E5E7EB] dark:border-[#1E293B] bg-[#F0F5F0] dark:bg-[#0D1526] transition-colors">
      <div className="mx-auto max-w-[1200px] px-6 py-12 font-[DM_Sans] text-sm text-[#1A1A1A] dark:text-[#CBD5E1]">
        <div className="grid gap-10 sm:grid-cols-3">
          <div>
            <Logo variant="full" tone={isDark ? 'onDark' : 'onLight'} className="h-14 w-auto" />
            <p className="mt-2 max-w-xs text-[#6B7280] dark:text-[#94A3B8]">
              The conveyancing pipeline for small UK housebuilders.
              Built on the Internet Computer for verifiable audit trails.
            </p>
          </div>
          <div>
            <div className="font-[DM_Sans] font-medium text-[#5F8A68] dark:text-[#6EE7B7]">
              Product
            </div>
            <ul className="mt-3 space-y-2">
              <li><Link to="/#developers" className="hover:text-[#0D9488]">For developers</Link></li>
              <li><Link to="/#conveyancers" className="hover:text-[#0D9488]">For conveyancers</Link></li>
              <li><Link to="/pricing" className="hover:text-[#0D9488]">Pricing</Link></li>
              <li><Link to="/api" className="hover:text-[#0D9488]">API docs</Link></li>
            </ul>
          </div>
          <div>
            <div className="font-[DM_Sans] font-medium text-[#5F8A68] dark:text-[#6EE7B7]">
              Company
            </div>
            <ul className="mt-3 space-y-2">
              <li><Link to="/about" className="hover:text-[#0D9488]">About</Link></li>
              <li><Link to="/resources" className="hover:text-[#0D9488]">Resources</Link></li>
              {/* Plain anchor: /news/ is a static page outside the HashRouter */}
              <li><a href="/news/" className="hover:text-[#0D9488]">News &amp; Press</a></li>
              <li><Link to="/faq" className="hover:text-[#0D9488]">FAQ</Link></li>
              <li><Link to="/terms" className="hover:text-[#0D9488]">Terms</Link></li>
              <li><Link to="/privacy" className="hover:text-[#0D9488]">Privacy</Link></li>
              <li><Link to="/support" className="hover:text-[#0D9488]">Support</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-10 border-t border-[#E5E7EB] dark:border-[#1E293B] pt-6 text-xs text-[#6B7280] dark:text-[#64748B]">
          PropXchain Ltd, Sandy, Bedfordshire, England.
          {' '}VAT registration number GB 524 6852 77.
          Conveyancing transactions are recorded on the Internet Computer
          for verifiable audit trails — view the public ledger at any time.
        </div>
      </div>
    </footer>
  );
};

export default MarketingFooter;
