// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { create } from 'zustand';
import type { TransactionStatus } from '../types/transactionStatus';

export interface ActiveTransaction {
  id: string;
  status: TransactionStatus;
}

interface ActiveTransactionState {
  transactionId: string | null;
  stage: TransactionStatus | null;
  setActiveTransaction: (transaction: ActiveTransaction | null) => void;
}

export const useActiveTransactionStore = create<ActiveTransactionState>((set) => ({
  transactionId: null,
  stage: null,
  setActiveTransaction: (transaction) =>
    set({ transactionId: transaction?.id ?? null, stage: transaction?.status ?? null }),
}));
