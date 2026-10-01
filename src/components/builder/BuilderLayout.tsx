// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Layout wrapper for all /builder routes. Same PortalShell as the user
 * dashboard (top bar, side menu, content):
 * the shared AppTopBar, then a section strip. At the portal root the strip
 * is just Sites; inside a site it becomes that site's sections, so a builder
 * can move between plots, pipeline and milestones without climbing back to
 * the site page each time.
 */

import { Outlet, useLocation, useParams } from 'react-router-dom';
import PortalShell from '@/components/navigation/PortalShell';
import { usePortalSections } from '@/components/navigation/usePortalSections';
import { BUILDER_ROOT, siteSections } from './builderSections';

/** The site-creation wizard has no site yet, so it keeps the root strip. */
function isInsideSite(pathname: string, siteId: string | undefined): siteId is string {
  return siteId !== undefined && pathname.startsWith(`${BUILDER_ROOT}/sites/${siteId}`);
}

export default function BuilderLayout(): JSX.Element {
  const { pathname } = useLocation();
  const { siteId } = useParams<{ siteId: string }>();
  const inSite = isInsideSite(pathname, siteId);
  // At the portal root the menu is the shared one (Sites is the developer extra);
  // inside a site it becomes that site's own sections.
  const sharedSections = usePortalSections('developer');
  const sections = inSite ? siteSections(siteId) : sharedSections;
  return (
    <PortalShell
      sections={sections}
      portalName="Builder portal"
      topBar={{
        title: 'Builder portal',
        backTo: inSite ? BUILDER_ROOT : undefined,
        backLabel: inSite ? 'All sites' : undefined,
      }}
    >
      <Outlet />
    </PortalShell>
  );
}
