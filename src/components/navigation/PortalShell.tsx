// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The signed-in page frame: top bar, then a left side menu beside the
 * content. On screens under lg the side menu hides and the same sections
 * show as a tab strip above the content instead. Dashboard, builder and
 * agent portal all render through this so they look like one app.
 */

import type { ReactNode } from 'react';
import AppTopBar from './AppTopBar';
import AppSidebar from './AppSidebar';
import SectionTabs, { type SectionTab } from './SectionTabs';
import '@/pages/Dashboard_Premium.css';

type TopBarProps = Omit<Parameters<typeof AppTopBar>[0], 'menuItems'>;

interface PortalShellProps {
  sections: SectionTab[];
  /** "Builder portal", "Dashboard": names the side menu and tab strip for screen readers. */
  portalName: string;
  topBar: TopBarProps;
  children: ReactNode;
}

export default function PortalShell({ sections, portalName, topBar, children }: PortalShellProps): JSX.Element {
  return (
    <div className="premium-dashboard flex-col">
      <AppTopBar {...topBar} menuItems={sections} />
      <div className="flex min-h-0 flex-1 items-stretch">
        <AppSidebar sections={sections} ariaLabel={`${portalName} menu`} />
        <main className="main-content main-content--bare min-w-0 flex-1">
          <div className="lg:hidden">
            <SectionTabs sections={sections} ariaLabel={`${portalName} sections`} />
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
