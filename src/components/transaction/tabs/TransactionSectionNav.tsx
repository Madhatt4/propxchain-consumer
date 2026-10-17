// PropXchain - Open Source Blockchain Property Conveyancing Platform
// Copyright (C) 2025 PropXchain Contributors
// SPDX-License-Identifier: Proprietary

/**
 * Section navigation for the transaction dashboard.
 *
 * Desktop (lg+): a persistent 232px vertical menu down the left, styled like
 * the dashboard sidebar — icon + label per section, teal active state with an
 * inset left rule. Every section is named and one click away, which the pill
 * row that preceded it could not manage: eight labelled pills did not fit a
 * laptop-width context strip, so below 1280px they went icon-only and the
 * section names disappeared.
 *
 * Below lg there is no room for a menu, so it collapses to a labelled opener
 * in the transaction context strip that slides the same list out from the
 * left. The drawer is portaled to document.body: the flow page wraps its
 * content in `relative z-10`, so rendered in place the drawer's z-50 is
 * trapped below the `sticky z-40` top bars, which paint over its header.
 *
 * The list is generated from TRANSACTION_TABS, so the registry stays the one
 * place a section is declared. Blockchain audit sits at the foot of both menu
 * and drawer: it is a route of its own rather than a section, so it renders as
 * a link and never takes the active state. The menu itself is the shared
 * navigation/SectionMenu.
 */
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Menu, ShieldCheck, X } from 'lucide-react';
import {
  SectionMenu,
  SectionMenuHeading,
  SectionMenuList,
  type SectionMenuFooterLink,
} from '@/components/navigation/SectionMenu';
import { TRANSACTION_NAV_SLOT_ID } from '../flow/TopBar';
import { TRANSACTION_TABS } from './transactionTabs.config';

export interface TransactionSectionNavProps {
  activeId: string;
  select: (id: string) => void;
  /** Drives the audit link, which leaves the shell for its own route. */
  transactionId: string;
  /** Closes the drawer when a resize takes the viewport up to the side menu. */
  isDesktop: boolean;
}

type SectionListProps = Omit<TransactionSectionNavProps, 'isDesktop'>;

function auditLink(transactionId: string): SectionMenuFooterLink | undefined {
  return transactionId
    ? {
        to: `/transaction/${transactionId}/audit`,
        label: 'Blockchain audit',
        ariaLabel: 'View the blockchain audit trail',
        icon: ShieldCheck,
      }
    : undefined;
}

/** The sections themselves, plus the audit link, shared by menu and drawer. */
function SectionList({ activeId, select, transactionId }: SectionListProps): JSX.Element {
  return (
    <SectionMenuList
      items={TRANSACTION_TABS}
      activeId={activeId}
      onSelect={select}
      footerLink={auditLink(transactionId)}
    />
  );
}

/** Slide-out list below lg, where the menu has no room. */
function SectionDrawer({
  onClose,
  ...listProps
}: SectionListProps & { onClose: () => void }): JSX.Element {
  // Prevent body scroll while the drawer is open (same pattern as the global
  // MobileNavMenu).
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  // Escape closes it. Without this the only ways out are the overlay, the close
  // button and picking a section — so a keyboard user who opened the drawer to
  // look had to commit to a section to get out of it.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return createPortal(
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} aria-hidden="true" />
      <nav
        aria-label="Transaction sections"
        className="fixed left-0 top-0 z-50 flex h-full w-72 flex-col gap-1 overflow-y-auto bg-white p-4 shadow-lg dark:bg-[#0b1226]"
      >
        <div className="mb-2 flex items-center justify-between">
          <SectionMenuHeading className="px-2">Transaction</SectionMenuHeading>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-white/[0.06]"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <SectionList {...listProps} />
      </nav>
    </>,
    document.body,
  );
}

export function TransactionSectionNav({
  isDesktop,
  ...listProps
}: TransactionSectionNavProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);

  // Resolved after mount — the slot belongs to the top bar, which may not be in
  // the DOM on first render.
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setSlot(document.getElementById(TRANSACTION_NAV_SLOT_ID));
  }, []);

  // A resize past the breakpoint would otherwise leave the drawer floating over
  // a page that now has the menu.
  useEffect(() => {
    if (isDesktop) setIsOpen(false);
  }, [isDesktop]);

  // Stable so the drawer's Escape listener is not torn down and re-added on
  // every render of this component.
  const close = useCallback((): void => setIsOpen(false), []);

  const choose = (id: string): void => {
    listProps.select(id);
    setIsOpen(false);
  };

  const opener = (
    <button
      type="button"
      onClick={() => setIsOpen(true)}
      aria-label="Open transaction sections menu"
      aria-expanded={isOpen}
      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-3 text-xs font-semibold text-teal-700 transition-colors hover:bg-teal-100 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-300 lg:hidden"
    >
      <Menu className="h-4 w-4 shrink-0" />
      Sections
    </button>
  );

  return (
    <>
      <SectionMenu
        heading="Transaction"
        ariaLabel="Transaction sections"
        items={TRANSACTION_TABS}
        activeId={listProps.activeId}
        onSelect={listProps.select}
        footerLink={auditLink(listProps.transactionId)}
      />
      {slot && createPortal(opener, slot)}
      {isOpen && <SectionDrawer {...listProps} select={choose} onClose={close} />}
    </>
  );
}
