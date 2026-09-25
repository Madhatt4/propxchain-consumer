// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Shared phase/step types for StartSaleModal + StartSaleProgressPanel.
 */

export type ModalPhase = 'form' | 'progress' | 'success' | 'failed';

export interface StepState {
  status: 'waiting' | 'pending' | 'success' | 'failed';
  error?: string;
}

export function initialSteps(): Record<number, StepState> {
  return {
    1: { status: 'waiting' },
    2: { status: 'waiting' },
    3: { status: 'waiting' },
    4: { status: 'waiting' },
  };
}
