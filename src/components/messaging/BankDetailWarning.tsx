// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import React from 'react';
import { ShieldAlert } from 'lucide-react';

/**
 * Shown to the reader of a message that mentions bank details. The copy is
 * the one rule that stops payment-diversion fraud: never act on bank details
 * from a message, check by phone on a number you already have.
 */
export const BankDetailWarning: React.FC = () => (
  <div
    role="alert"
    className="mb-2 flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-100"
  >
    <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
    <p>
      <strong>This message mentions bank details.</strong> Never send money to new or changed bank
      details because of a message, even one that looks like it comes from someone you know. Call
      your conveyancer on a phone number you already hold to check before you pay.
    </p>
  </div>
);
