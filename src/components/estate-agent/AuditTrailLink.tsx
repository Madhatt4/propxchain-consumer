// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Link from an agent's listing to that sale's audit trail. The audit page
 * (/transaction/:id/audit) already exists and is linked from the transaction
 * tabs, but an agent working from the listing had no way to reach it.
 */
import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';

interface AuditTrailLinkProps {
  transactionId: string;
  className?: string;
}

export function AuditTrailLink({ transactionId, className = '' }: AuditTrailLinkProps): JSX.Element {
  return (
    <section
      className={`rounded-lg border border-gray-200 p-4 dark:border-gray-700 ${className}`}
      data-testid="audit-trail-section"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">Audit trail</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Every step on this sale, time-stamped and recorded on-chain.
          </p>
        </div>
        <Link
          to={`/transaction/${transactionId}/audit`}
          className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-50 dark:hover:bg-gray-800"
          data-testid="audit-trail-link"
        >
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          View audit trail
        </Link>
      </div>
    </section>
  );
}
