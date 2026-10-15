// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import React from 'react';
import { Sparkles } from 'lucide-react';

/** Marks an answer filled from a certificate the seller confirmed; the seller still checks and saves it. */
export const SuggestedBadge: React.FC = () => (
  <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700 dark:bg-teal-900/30 dark:text-teal-300">
    <Sparkles className="h-3 w-3" aria-hidden="true" />
    Suggested from your upload - please check
  </span>
);
