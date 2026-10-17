// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The left section menu of the transaction dashboard, lifted out of
 * TransactionSectionNav so other per-deal pages (the agent's listing page in
 * PropXchain Pro) can open with the same menu and read as the same product.
 *
 * - `SectionMenuList` is the rows: icon + label per section, teal active
 *   state with an inset left rule, and an optional link at the foot for a
 *   destination that is a route of its own rather than a section (it never
 *   takes the active state).
 * - `SectionMenu` is the sticky 232px card holding that list on lg and up.
 *   Callers decide what replaces it below lg.
 * - `SectionMenuStrip` is a scrolling pill row of the same sections, for a
 *   page that wants the sections inline below lg instead of a drawer.
 */
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SectionMenuItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

export interface SectionMenuFooterLink {
  to: string;
  label: string;
  ariaLabel: string;
  icon: LucideIcon;
}

export interface SectionMenuListProps {
  items: readonly SectionMenuItem[];
  activeId: string;
  onSelect: (id: string) => void;
  footerLink?: SectionMenuFooterLink;
}

/** One metric for menu and drawer alike: 44px clears the touch-target floor in
 *  the drawer, and reads as a comfortable dashboard row in the menu. */
const ITEM =
  'flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] font-semibold transition-colors';

const ITEM_IDLE =
  'text-gray-600 hover:bg-teal-500/[0.06] hover:text-teal-700 dark:text-slate-300 dark:hover:text-teal-300';

const ITEM_ACTIVE =
  'bg-gradient-to-r from-teal-500/15 to-teal-500/[0.04] text-teal-700 shadow-[inset_3px_0_0_0_#0d9488] dark:text-teal-300';

const ICON = 'h-4 w-4 shrink-0';

const HEADING = 'text-[9px] font-bold uppercase tracking-[0.15em] text-gray-400 dark:text-slate-500';

export function SectionMenuHeading({ children, className }: { children: string; className?: string }): JSX.Element {
  return <p className={cn(HEADING, className)}>{children}</p>;
}

export function SectionMenuList({ items, activeId, onSelect, footerLink }: SectionMenuListProps): JSX.Element {
  return (
    <>
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = item.id === activeId;
        return (
          <button
            key={item.id}
            type="button"
            aria-current={isActive ? 'true' : undefined}
            aria-label={`Open ${item.label}`}
            onClick={() => onSelect(item.id)}
            className={cn(ITEM, isActive ? ITEM_ACTIVE : ITEM_IDLE)}
          >
            <Icon
              className={cn(
                ICON,
                isActive ? 'text-teal-600 dark:text-teal-400' : 'text-gray-400 dark:text-slate-500',
              )}
            />
            {item.label}
          </button>
        );
      })}

      {/* Foot of the list in a drawer. In the auto-height menu mt-auto has no
          free space to push against, so it simply follows the last section. */}
      {footerLink ? (
        <div className="mt-auto border-t border-gray-200 pt-2 dark:border-slate-700/40">
          <Link to={footerLink.to} className={cn(ITEM, ITEM_IDLE)} aria-label={footerLink.ariaLabel}>
            <footerLink.icon className={cn(ICON, 'text-gray-400 dark:text-slate-500')} />
            {footerLink.label}
          </Link>
        </div>
      ) : null}
    </>
  );
}

export interface SectionMenuProps extends SectionMenuListProps {
  heading: string;
  ariaLabel: string;
}

/** Persistent left menu, lg and up. */
export function SectionMenu({ heading, ariaLabel, ...listProps }: SectionMenuProps): JSX.Element {
  return (
    <nav
      aria-label={ariaLabel}
      className="sticky top-[96px] hidden w-[232px] shrink-0 flex-col gap-1 self-start rounded-2xl border border-gray-200 bg-white p-2.5 shadow-sm dark:border-slate-700/40 dark:bg-white/[0.03] lg:flex"
    >
      <SectionMenuHeading className="px-3 pb-1.5 pt-1">{heading}</SectionMenuHeading>
      <SectionMenuList {...listProps} />
    </nav>
  );
}

export interface SectionMenuStripProps {
  items: readonly SectionMenuItem[];
  activeId: string;
  onSelect: (id: string) => void;
  ariaLabel: string;
}

/** The same sections as a scrolling pill row, below lg. */
export function SectionMenuStrip({ items, activeId, onSelect, ariaLabel }: SectionMenuStripProps): JSX.Element {
  return (
    <nav aria-label={ariaLabel} className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:hidden">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = item.id === activeId;
        return (
          <button
            key={item.id}
            type="button"
            aria-current={isActive ? 'true' : undefined}
            onClick={() => onSelect(item.id)}
            className={cn(
              'inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-lg border px-3 text-[13px] font-semibold transition-colors',
              isActive
                ? 'border-teal-300 bg-teal-50 text-teal-700 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-300'
                : 'border-gray-200 bg-white text-gray-600 dark:border-slate-700/40 dark:bg-white/[0.03] dark:text-slate-300',
            )}
          >
            <Icon className={ICON} />
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
