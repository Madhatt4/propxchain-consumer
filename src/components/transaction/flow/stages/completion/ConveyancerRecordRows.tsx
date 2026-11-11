// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { conveyancerRecordRows, useConveyancerRecords } from '@/hooks/useConveyancerRecords';
import { Row } from './CompletionRows';
import type { ReactNode } from 'react';

/**
 * Read-only: the deposit the buyer's conveyancer recorded as sent at exchange,
 * and, after completion, their registration application to HM Land Registry.
 * PropXchain holds no money and lodges nothing; it shows what was recorded.
 * Renders nothing when neither can be read.
 */
export function ConveyancerRecordRows({ transactionId }: { transactionId: string | undefined }): ReactNode {
  const rows = conveyancerRecordRows(useConveyancerRecords(transactionId));
  if (rows.length === 0) return null;
  return (
    <dl className="flex flex-col" aria-label="Recorded by the buyer's conveyancer">
      {rows.map((row) => <Row key={row.label} label={row.label} value={row.value} />)}
    </dl>
  );
}
