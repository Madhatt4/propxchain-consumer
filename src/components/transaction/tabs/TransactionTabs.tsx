// PropXchain - Open Source Blockchain Property Conveyancing Platform
// Copyright (C) 2025 PropXchain Contributors
// SPDX-License-Identifier: Proprietary

/**
 * Responsive section shell for the transaction dashboard.
 *
 * Three columns at xl and up: the section menu on the left, the active
 * section's content in the middle, and the standing cards (invite code,
 * listing preview, other-party progress, audit card) down the right. Between
 * lg and xl the menu stays and the cards fall below the content — a 232px menu
 * and a 320px card rail either side of a 1024px viewport would leave the
 * section itself under 400px. Below lg the menu becomes a drawer (see
 * TransactionSectionNav) and everything is one column.
 *
 * Hybrid navigation: on desktop switching replaces the URL; on mobile each
 * section acts like a page (switching pushes history, so the back button
 * returns to the previous section). State lives in the `?tab=` query param,
 * so every section is deep-linkable. Locked sections render greyed with a
 * lock and open to a teaser (the section component decides).
 */
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useIsTierAtLeast } from '@/hooks/useSubscription';
import type { SubscriptionTier } from '@/constants/subscriptionFeatures';
import { TransactionSectionNav } from './TransactionSectionNav';
import {
  isTabUnlocked,
  TRANSACTION_TABS,
  type TransactionTabContext,
} from './transactionTabs.config';

interface TransactionTabsProps {
  context: TransactionTabContext;
  /** Main-column content for the 'overview' section (active stage detail). */
  overview: React.ReactNode;
  /** Rendered full-content-width above the main/cards split, overview only
   *  (next-step cards + the horizontal stage tab row). */
  overviewTop?: React.ReactNode;
  /** Standing cards, visible whichever section is active. */
  sidebar?: React.ReactNode;
}

function useIsDesktop(): boolean {
  const query = '(min-width: 1024px)';
  const [isDesktop, setIsDesktop] = useState<boolean>(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent): void => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isDesktop;
}

export function TransactionTabs({
  context,
  overview,
  overviewTop,
  sidebar,
}: TransactionTabsProps): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const isDesktop = useIsDesktop();

  const isPremium = useIsTierAtLeast('premium');
  const isUnlocked = (t: SubscriptionTier): boolean => isTabUnlocked(t, isPremium);

  const requested = searchParams.get('tab') ?? 'overview';
  const activeId = TRANSACTION_TABS.some((t) => t.id === requested) ? requested : 'overview';
  const active = TRANSACTION_TABS.find((t) => t.id === activeId) ?? TRANSACTION_TABS[0];

  const select = (id: string): void => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', id);
    // Desktop = tab feel (replace); mobile = page feel (push → back button works).
    setSearchParams(next, { replace: isDesktop });
  };

  return (
    <div className="lg:flex lg:items-start lg:gap-5">
      <TransactionSectionNav
        activeId={activeId}
        isUnlocked={isUnlocked}
        select={select}
        transactionId={context.transactionId}
        isDesktop={isDesktop}
      />

      <div className="min-w-0 flex-1">
        {/* Mobile: sections behave like pages and the menu is a drawer — give
            every non-overview section an explicit, labelled way home. Desktop
            reads it off the menu. */}
        {activeId !== 'overview' && (
          <button
            type="button"
            onClick={() => select('overview')}
            className="mb-3 inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-teal-700 hover:underline dark:text-teal-400 lg:hidden"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
            Overview
          </button>
        )}

        {activeId === 'overview' && overviewTop}

        <div className="flex flex-col items-start gap-5 xl:flex-row">
          <div role="tabpanel" className="w-full min-w-0 flex-1">
            {active.kind === 'overview'
              ? overview
              : active.Component && (
                  <active.Component
                    {...context}
                    locked={!isUnlocked(active.minTier)}
                    requiredTier={active.minTier}
                  />
                )}
          </div>

          {/* Below xl the cards fall under the section content, which stays the
              first thing you read. */}
          {sidebar && (
            <div className="flex w-full min-w-0 flex-col gap-4 xl:sticky xl:top-[96px] xl:w-[320px] xl:shrink-0">
              {sidebar}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
