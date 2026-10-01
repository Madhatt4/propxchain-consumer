// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The side menu every signed-in user sees. Everyone gets the same common
 * sections; a professional gets their own extras added underneath, so the
 * dashboard, the agent portal and the builder portal all share one menu.
 */

import type { OrganisationType } from '@/router/decideRoute';
import type { SectionTab } from './SectionTabs';

export type PortalKind = 'agent' | 'developer' | 'conveyancer';

/** Same order as the old dashboard sidebar. */
export const COMMON_SECTIONS: readonly SectionTab[] = [
  { label: 'Transactions', to: '/dashboard', end: true },
  { label: 'Analytics', to: '/dashboard/analytics' },
  { label: 'Wallet', to: '/dashboard/my-documents' },
  { label: 'Property logbook', to: '/dashboard/my-logbooks' },
  { label: 'AI agents', to: '/dashboard/bot-agents' },
  { label: 'Messages', to: '/messages' },
];

const EXTRA_SECTIONS: Record<PortalKind, readonly SectionTab[]> = {
  agent: [
    { label: 'Listings', to: '/estate-agent/listings' },
    { label: 'Pipeline', to: '/estate-agent/pipeline' },
  ],
  developer: [{ label: 'Sites', to: '/builder' }],
  conveyancer: [{ label: 'Matters', to: '/conveyancer' }],
};

const KIND_ORDER: readonly PortalKind[] = ['agent', 'developer', 'conveyancer'];

const KIND_FOR_ORGANISATION: Partial<Record<OrganisationType, PortalKind>> = {
  agent: 'agent',
  developer: 'developer',
  solicitor_firm: 'conveyancer',
};

/** The sign-up role stored on the account, before any organisation exists. */
const KIND_FOR_SIGNUP_ROLE: Record<string, PortalKind> = {
  agent: 'agent',
  developer: 'developer',
  solicitor: 'conveyancer',
};

/** Which professional extras this user has, from their organisations and sign-up role. */
export function portalKindsFor(
  organisationTypes: readonly OrganisationType[],
  signupRole?: string,
): PortalKind[] {
  const kinds = new Set<PortalKind>();
  for (const type of organisationTypes) {
    const kind = KIND_FOR_ORGANISATION[type];
    if (kind) kinds.add(kind);
  }
  const fromRole = signupRole ? KIND_FOR_SIGNUP_ROLE[signupRole] : undefined;
  if (fromRole) kinds.add(fromRole);
  return KIND_ORDER.filter((kind) => kinds.has(kind));
}

/** Common sections first, then each professional kind's extras. */
export function sectionsFor(kinds: readonly PortalKind[]): SectionTab[] {
  return [...COMMON_SECTIONS, ...KIND_ORDER.filter((k) => kinds.includes(k)).flatMap((k) => EXTRA_SECTIONS[k])];
}
