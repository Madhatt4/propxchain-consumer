// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import type { ReactElement } from 'react';

interface SiteBadgeProps {
  siteName: string;
}

/**
 * Small sage-tinted badge showing the development site name.
 * Rendered at the top of the buyer transaction flow when the
 * transaction originated from a developer platform reservation.
 */
export function SiteBadge({ siteName }: SiteBadgeProps): ReactElement {
  return (
    <span className="inline-flex items-center gap-1.5 bg-[#84A98C]/10 text-[#5F8A68] rounded-full px-3 py-1 text-xs font-medium font-['DM_Sans']">
      <svg
        className="w-3.5 h-3.5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z"
        />
      </svg>
      Part of {siteName} development
    </span>
  );
}
