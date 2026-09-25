// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import type { AgentListingStatus } from '@/types/estateAgentListing.types';

/** Human-readable label for each agent listing status. Exported for reuse
 *  (e.g. filter dropdowns) so the wording stays in one place. */
export const STATUS_LABELS: Record<AgentListingStatus, string> = {
  draft: 'Draft',
  for_sale: 'For sale',
  under_offer: 'Under offer',
  sold_stc: 'Sold STC',
  exchanged: 'Exchanged',
  completed: 'Completed',
  withdrawn: 'Withdrawn',
};

const STATUS_STYLES: Record<AgentListingStatus, string> = {
  draft: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  for_sale: 'bg-[#84A98C]/20 text-[#5F8A68] dark:text-[#84A98C]',
  under_offer: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  sold_stc: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  exchanged: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
  completed: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
  withdrawn: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

export interface ListingStatusBadgeProps {
  status: AgentListingStatus;
}

/** Small pill showing an agent listing's current status. */
export function ListingStatusBadge({ status }: ListingStatusBadgeProps): JSX.Element {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 font-[DM_Sans] text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

export default ListingStatusBadge;
