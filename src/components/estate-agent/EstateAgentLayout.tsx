// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Layout wrapper for all /estate-agent routes. Same PortalShell and the same
 * side menu as the user dashboard: the common sections, with Listings and
 * Pipeline as the agent's extras. Sub-pages get a back control.
 */

import { Outlet, useLocation } from 'react-router-dom';
import PortalShell from '@/components/navigation/PortalShell';
import { usePortalSections } from '@/components/navigation/usePortalSections';

const LISTINGS_PATH = '/estate-agent/listings';

/** Detail and create pages live under /listings/…; they get a way back up. */
function isListingSubPage(pathname: string): boolean {
  return pathname.startsWith(`${LISTINGS_PATH}/`);
}

export default function EstateAgentLayout(): JSX.Element {
  const { pathname } = useLocation();
  const sections = usePortalSections('agent');
  const hasBack = isListingSubPage(pathname);
  return (
    <PortalShell
      sections={sections}
      portalName="Agent portal"
      topBar={{
        title: 'Agent portal',
        backTo: hasBack ? LISTINGS_PATH : undefined,
        backLabel: hasBack ? 'Back to listings' : undefined,
      }}
    >
      <Outlet />
    </PortalShell>
  );
}
