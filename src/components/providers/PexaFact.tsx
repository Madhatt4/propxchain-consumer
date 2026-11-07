// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import React from 'react';

/** One wording everywhere a firm is shown to a client (card bbf17990). */
export const PEXA_FACT_TEXT = 'PEXA-enabled — completion can be same-day digital';

interface PexaFactProps {
  isPexaEnabled?: boolean;
  className?: string;
}

/**
 * A plain fact line, not a badge: PropXchain is provider-neutral, so this
 * carries the same weight as the firm's other facts and nothing sorts or
 * filters on it. Renders nothing for a firm that is not PEXA-enabled — no
 * "not enabled" marker that would read as a mark against the firm.
 */
export function PexaFact({ isPexaEnabled, className }: PexaFactProps): React.ReactElement | null {
  if (!isPexaEnabled) return null;
  return <span className={className}>{PEXA_FACT_TEXT}</span>;
}
