// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Section definitions for the builder portal strip. Kept apart from the
 * layout component so tests can import them without tripping fast refresh.
 */

import type { SectionTab } from '@/components/navigation/SectionTabs';

export const BUILDER_ROOT = '/builder';

/** The strip for one site. `end` on Overview so it is not lit on every sub-route. */
export function siteSections(siteId: string): SectionTab[] {
  const base = `${BUILDER_ROOT}/sites/${siteId}`;
  return [
    { label: 'Overview', to: base, end: true },
    { label: 'Plots', to: `${base}/plots` },
    { label: 'Plot types', to: `${base}/plot-types` },
    { label: 'Pipeline', to: `${base}/pipeline` },
    { label: 'Milestones', to: `${base}/milestones` },
  ];
}
