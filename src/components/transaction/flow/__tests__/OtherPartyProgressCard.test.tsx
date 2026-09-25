// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../StallLine', () => ({
  StallLine: (props: { transactionId: string; side?: string; variant?: string }) => (
    <div data-testid="stall-line" data-tx={props.transactionId} data-side={props.side} data-variant={props.variant} />
  ),
}));

import { OtherPartyProgressCard } from '../OtherPartyProgressCard';
import type { StageConfig } from '../../../../types/stage.types';

const STAGES = [
  { id: 'buyer-1', title: 'Find a conveyancer', status: 'completed' },
  { id: 'buyer-2', title: 'Proof of funds', status: 'active' },
] as unknown as StageConfig[];

describe('OtherPartyProgressCard', () => {
  it("shows the other side's stall line, compact, once they have joined", () => {
    render(<OtherPartyProgressCard stages={STAGES} otherPartyRole="buyer" transactionId="tx_1" />);
    const line = screen.getByTestId('stall-line');
    expect(line).toHaveAttribute('data-tx', 'tx_1');
    expect(line).toHaveAttribute('data-side', 'buyer');
    expect(line).toHaveAttribute('data-variant', 'compact');
    expect(screen.getByText('1 of 2 stages complete')).toBeInTheDocument();
  });

  it('no stall line before the other party joins, nor without a transaction id', () => {
    const { unmount } = render(<OtherPartyProgressCard stages={[]} otherPartyRole="seller" transactionId="tx_1" />);
    expect(screen.getByText('Waiting for seller to join')).toBeInTheDocument();
    expect(screen.queryByTestId('stall-line')).toBeNull();
    unmount();
    render(<OtherPartyProgressCard stages={STAGES} otherPartyRole="buyer" />);
    expect(screen.queryByTestId('stall-line')).toBeNull();
  });
});
