// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import { SRA_ATTRIBUTION_URL } from '../../services/regulator';

/**
 * The SRA's data-sharing terms require re-publishers to credit the SRA, linking
 * to its attribution statement, wherever its register data appears.
 */
export function SraAttribution(): React.ReactElement {
  return (
    <p className="text-xs text-gray-500 dark:text-gray-400">
      PropXchain includes data supplied by the{' '}
      <a
        href={SRA_ATTRIBUTION_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="underline hover:text-gray-700 dark:hover:text-gray-200"
      >
        Solicitors Regulation Authority
      </a>
      .
    </p>
  );
}
