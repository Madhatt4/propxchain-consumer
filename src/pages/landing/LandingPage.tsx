// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * LandingPage — the unified marketing `/` for propxchain.com. A single dynamic
 * page: the nav and audience cards smooth-scroll to in-page sections rather than
 * routing to separate audience pages. Built from the approved design reference
 * (design_handoff_unified_landing, hero option "1b — The chain").
 *
 * Theme is marketing-local: `data-theme` on <html>, default dark, persisted to
 * localStorage['px-theme']. The whole page (hero included) re-themes via scoped
 * CSS variables on `.px-landing`. The app-wide `.dark` ThemeProvider (used by
 * the dashboard) is intentionally left untouched.
 */

import { useCallback, useEffect, useRef, type FC } from 'react';

import SignInDialog from '@/components/auth/SignInDialog';
import { HeroSection } from '@/components/landing/marketing/HeroSection';
import { AudienceCards } from '@/components/landing/marketing/AudienceCards';
import { PartnerStrip } from '@/components/landing/marketing/PartnerStrip';
import { ProblemSection } from '@/components/landing/marketing/ProblemSection';
import { HowItWorksSection } from '@/components/landing/marketing/HowItWorksSection';
import { AssistantsSection } from '@/components/landing/marketing/AssistantsSection';
import { AudienceSections } from '@/components/landing/marketing/AudienceSections';
import { SecuritySection } from '@/components/landing/marketing/SecuritySection';
import { PricingSection } from '@/components/landing/marketing/PricingSection';
import { FreeReportSection } from '@/components/landing/marketing/FreeReportSection';
import { SiteFooter } from '@/components/landing/marketing/SiteFooter';
import { useMarketingTheme } from '@/components/landing/marketing/hooks/useMarketingTheme';
import { useScrollReveal } from '@/components/landing/marketing/hooks/useScrollReveal';

import '@/components/landing/marketing/marketing-landing.css';

const LandingPage: FC = () => {
  const { isDark, toggleTheme } = useMarketingTheme();
  const contentRef = useRef<HTMLElement>(null);
  useScrollReveal(contentRef);

  useEffect(() => {
    document.title = 'PropXchain — Your property. Your deal. Your control.';
  }, []);

  // Smooth-scroll to a section, with an instant fallback for embeds/webviews
  // that ignore `behavior: 'smooth'` entirely.
  const scrollTo = useCallback((id: string): void => {
    const el = document.getElementById(id);
    if (!el) return;
    const from = window.pageYOffset;
    const y = el.getBoundingClientRect().top + from;
    el.scrollIntoView({ behavior: 'smooth' });
    window.setTimeout(() => {
      if (Math.abs(window.pageYOffset - from) < 2 && Math.abs(y - from) > 2) {
        window.scrollTo(0, y);
      }
    }, 350);
  }, []);

  // Deep-link support: arriving at /#sellers (e.g. via a redirect from the old
  // /sellers route or an external link) scrolls to that section once it's laid
  // out. Same-page nav clicks use scrollTo directly.
  useEffect(() => {
    const id = window.location.hash.replace('#', '');
    if (!id) return undefined;
    const timer = window.setTimeout(() => scrollTo(id), 120);
    return () => window.clearTimeout(timer);
  }, [scrollTo]);

  return (
    <div className="px-landing font-body">
      <HeroSection isDark={isDark} onToggleTheme={toggleTheme} onScrollTo={scrollTo} />

      <main id="pg" ref={contentRef} className="px-pg">
        <AudienceCards onScrollTo={scrollTo} />
        <PartnerStrip />
        <ProblemSection />
        <HowItWorksSection />
        <AssistantsSection />
        <AudienceSections onScrollTo={scrollTo} />
        <SecuritySection />
        <PricingSection onScrollTo={scrollTo} />
        <FreeReportSection />
        <SiteFooter onScrollTo={scrollTo} />
      </main>

      {/* Opens on ?signin=1. Portals to <body>, so it sits here purely as the
          landing page's declaration that it owns the sign-in card. */}
      <SignInDialog />
    </div>
  );
};

export default LandingPage;
