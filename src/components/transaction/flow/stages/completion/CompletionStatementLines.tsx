// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { NO_STATEMENT_WARNING, completionStatementLines, firstConfirmedAtMs, statementView } from '@/lib/completionStatement';
import type { ReactNode } from 'react';
import type { CompletionStatus } from '@/services/completionStatus';
import type { StatementView } from '@/lib/completionStatement';
import type { StatementLoad } from './useCompletionStatement';

const LINE = 'text-sm text-gray-600 dark:text-slate-300';

function firstConfirmedOf(status: CompletionStatus): number | null {
  return firstConfirmedAtMs([status.buyer?.at.getTime(), status.seller?.at.getTime()]);
}

/** The recorded and late statements, or null while loading or after a failed read. */
export function statementViewOf(load: StatementLoad, status: CompletionStatus): StatementView | null {
  return load.state === 'ready' ? statementView(load.statements, firstConfirmedOf(status)) : null;
}

/**
 * Shown beside a confirm button when the seller's conveyancer has uploaded no
 * statement: confirming records the deal details, and closes the upload.
 */
export function noStatementWarningOf(view: StatementView | null, sellerConveyancer: string | null): string | null {
  return sellerConveyancer && view && !view.recorded ? NO_STATEMENT_WARNING : null;
}

interface Props {
  load: StatementLoad;
  view: StatementView | null;
  status: CompletionStatus;
}

/** The client's read-only completion statement lines. The file stays with the firm, so there is nothing to open. */
export function CompletionStatementLines({ load, view, status }: Props): ReactNode {
  if (load.state === 'loading') return null;
  if (load.state === 'failed' || !view) {
    return <p className={LINE} data-testid="completion-statement-line">Could not load the completion statement.</p>;
  }
  const isConfirmed = firstConfirmedOf(status) !== null;
  return (
    <div data-testid="completion-statement-line" className="flex flex-col gap-1">
      {completionStatementLines(view, isConfirmed).map((line) => <p key={line} className={LINE}>{line}</p>)}
    </div>
  );
}
