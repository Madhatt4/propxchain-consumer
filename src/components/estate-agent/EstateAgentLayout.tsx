// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Layout wrapper for all /estate-agent routes. Same PortalShell as the user
 * dashboard, with Listings / Pipeline as its sections and a back control on
 * sub-pages.
 */

import { Outlet, useLocation } from 'react-router-dom';
import PortalShell from '@/components/navigation/PortalShell';

const LISTINGS_PATH = '/estate-agent/listings';

const SECTIONS = [
  { label: 'Listings', to: LISTINGS_PATH },
  { label: 'Pipeline', to: '/estate-agent/pipeline' },
];

/** Detail and create pages live under /listings/…; they get a way back up. */
function isListingSubPage(pathname: string): boolean {
  return pathname.startsWith(`${LISTINGS_PATH}/`);
}

export default function EstateAgentLayout(): JSX.Element {
  const { pathname } = useLocation();
  const hasBack = isListingSubPage(pathname);
  return (
    <PortalShell
      sections={SECTIONS}
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
