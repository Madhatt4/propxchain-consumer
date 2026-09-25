// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Left side menu under the AppTopBar, shared by every signed-in portal so
 * the dashboard, builder and agent views navigate the same way. Sections
 * are passed in; Profile and Log out are the same everywhere. Below the lg
 * breakpoint the sidebar hides and the SectionTabs strip carries the same
 * sections, so nothing is lost on a phone.
 */

import { NavLink, useNavigate } from 'react-router-dom';
import { LogOut, User } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import type { SectionTab } from './SectionTabs';

interface AppSidebarProps {
  sections: SectionTab[];
  ariaLabel: string;
}

const ITEM_BASE =
  'flex min-h-10 items-center gap-2.5 rounded-md border-l-[3px] px-3 py-2 font-[DM_Sans] text-sm transition-colors';
const ITEM_ACTIVE = 'border-[#0D9488] bg-[var(--bg-section)] text-[var(--text-main)] font-medium';
const ITEM_INACTIVE =
  'border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-section)] hover:text-[var(--text-main)]';

export default function AppSidebar({ sections, ariaLabel }: AppSidebarProps): JSX.Element {
  const navigate = useNavigate();

  async function handleLogout(): Promise<void> {
    try {
      await useAuthStore.getState().logout();
    } finally {
      navigate('/login');
    }
  }

  return (
    <nav
      aria-label={ariaLabel}
      className="sticky top-16 hidden min-h-[calc(100vh-4rem)] w-[220px] shrink-0 flex-col gap-1 self-start border-r border-[var(--border-color)] bg-[var(--bg-card)] px-3 py-5 lg:flex"
    >
      {sections.map((section) => (
        <NavLink
          key={section.to}
          to={section.to}
          end={section.end}
          className={({ isActive }) => `${ITEM_BASE} ${isActive ? ITEM_ACTIVE : ITEM_INACTIVE}`}
        >
          {section.label}
        </NavLink>
      ))}
      <div className="mt-auto flex flex-col gap-1 border-t border-[var(--border-color)] pt-3">
        <NavLink
          to="/profile-setup"
          className={({ isActive }) => `${ITEM_BASE} ${isActive ? ITEM_ACTIVE : ITEM_INACTIVE}`}
        >
          <User size={16} strokeWidth={2} />
          Profile
        </NavLink>
        <button type="button" onClick={handleLogout} className={`${ITEM_BASE} ${ITEM_INACTIVE} w-full text-left`}>
          <LogOut size={16} strokeWidth={2} />
          Log out
        </button>
      </div>
    </nav>
  );
}
