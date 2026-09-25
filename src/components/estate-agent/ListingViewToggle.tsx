// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Tile / list switcher for the listings page. The choice is a per-browser
 * convenience, so it lives in localStorage rather than the profile.
 */

import type { ReactNode } from 'react';

import type { ListingView } from '@/hooks/useListingView';

interface ToggleButtonProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
  children: ReactNode;
}

function ToggleButton({ label, isActive, onClick, children }: ToggleButtonProps): JSX.Element {
  const activeClass = isActive
    ? 'bg-[#0D9488] text-white'
    : 'bg-white text-gray-500 hover:text-gray-900 dark:bg-gray-800 dark:text-gray-400 dark:hover:text-gray-50';
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={isActive}
      onClick={onClick}
      className={`inline-flex h-10 w-10 items-center justify-center ${activeClass}`}
    >
      {children}
    </button>
  );
}

interface ListingViewToggleProps {
  view: ListingView;
  onChange: (view: ListingView) => void;
}

export function ListingViewToggle({ view, onChange }: ListingViewToggleProps): JSX.Element {
  return (
    <div
      role="group"
      aria-label="Listing view"
      className="inline-flex overflow-hidden rounded-md border border-gray-200 dark:border-gray-700"
    >
      <ToggleButton label="Tile view" isActive={view === 'tiles'} onClick={() => onChange('tiles')}>
        <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
          <rect x="1" y="1" width="6" height="6" rx="1" />
          <rect x="9" y="1" width="6" height="6" rx="1" />
          <rect x="1" y="9" width="6" height="6" rx="1" />
          <rect x="9" y="9" width="6" height="6" rx="1" />
        </svg>
      </ToggleButton>
      <ToggleButton label="List view" isActive={view === 'list'} onClick={() => onChange('list')}>
        <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
          <rect x="1" y="2" width="14" height="2.5" rx="1" />
          <rect x="1" y="6.75" width="14" height="2.5" rx="1" />
          <rect x="1" y="11.5" width="14" height="2.5" rx="1" />
        </svg>
      </ToggleButton>
    </div>
  );
}
