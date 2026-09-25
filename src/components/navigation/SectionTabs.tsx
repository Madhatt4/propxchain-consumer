// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Section strip under the AppTopBar, shared by the portal layouts so every
 * portal (agent, builder) navigates the same way. Lifted out of
 * EstateAgentLayout so the builder portal could stop being the odd one out.
 */

import { NavLink } from 'react-router-dom';

export interface SectionTab {
  label: string;
  to: string;
  /** Match only the exact path, not its sub-routes. For an index tab. */
  end?: boolean;
}

const TAB_BASE =
  'inline-flex min-h-11 shrink-0 items-center border-b-2 px-1 font-[DM_Sans] text-sm font-medium transition-colors';
const TAB_ACTIVE = 'border-[#0D9488] text-[var(--text-main)]';
const TAB_INACTIVE =
  'border-transparent text-[var(--text-secondary)] hover:border-[var(--border-color)] hover:text-[var(--text-main)]';

interface SectionTabsProps {
  sections: SectionTab[];
  ariaLabel: string;
}

export default function SectionTabs({ sections, ariaLabel }: SectionTabsProps): JSX.Element {
  return (
    <nav aria-label={ariaLabel}>
      <div className="flex gap-6 overflow-x-auto border-b border-[var(--border-color)]">
        {sections.map((section) => (
          <NavLink
            key={section.to}
            to={section.to}
            end={section.end}
            className={({ isActive }) => `${TAB_BASE} ${isActive ? TAB_ACTIVE : TAB_INACTIVE}`}
          >
            {section.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
