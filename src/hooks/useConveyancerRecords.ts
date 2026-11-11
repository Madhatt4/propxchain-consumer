// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { useEffect, useState } from 'react';
import { icpService } from '@/services/icp.service';
import { logger } from '@/utils/logger';
import { depositSentText, registrationText, type DepositSent, type RegistrationStatus } from '@/lib/conveyancerRecords';

export interface ConveyancerRecords {
  /** Undefined while loading or when the read failed, so nothing is shown. */
  deposit?: DepositSent | null;
  registration?: RegistrationStatus | null;
}

export interface RecordRow {
  label: string;
  value: string;
}

/** A read that fails yields undefined: the row is left out rather than shown as an error. */
async function quietly<T>(read: () => Promise<T>, what: string): Promise<T | undefined> {
  try {
    return await read();
  } catch (err: unknown) {
    logger.warn(`[conveyancer records] could not read ${what}`, err);
    return undefined;
  }
}

/**
 * The buyer's conveyancer's deposit-sent and registration-application records
 * for a deal, read once. Read-only for the parties.
 */
export function useConveyancerRecords(transactionId: string | undefined): ConveyancerRecords {
  const [records, setRecords] = useState<ConveyancerRecords>({});
  useEffect(() => {
    if (!transactionId) return undefined;
    let isCancelled = false;
    setRecords({});
    void Promise.all([
      quietly(() => icpService.getDepositSent(transactionId), 'deposit sent'),
      quietly(() => icpService.getRegistrationStatus(transactionId), 'registration status'),
    ]).then(([deposit, registration]) => {
      if (!isCancelled) setRecords({ deposit, registration });
    });
    return () => { isCancelled = true; };
  }, [transactionId]);
  return records;
}

/** The rows to show; a record that could not be read, or has nothing to say yet, has no row. */
export function conveyancerRecordRows(records: ConveyancerRecords): RecordRow[] {
  const rows: RecordRow[] = [];
  if (records.deposit !== undefined) rows.push({ label: 'Deposit', value: depositSentText(records.deposit) });
  const registration = registrationText(records.registration ?? null);
  if (registration) rows.push({ label: 'Registration application', value: registration });
  return rows;
}
