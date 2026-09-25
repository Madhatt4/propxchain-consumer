// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PaymentHandoffCard, type PaymentHandoffCardProps } from '../PaymentHandoffCard';

function renderCard(over: Partial<PaymentHandoffCardProps> = {}): PaymentHandoffCardProps {
  const props: PaymentHandoffCardProps = {
    side: 'seller', providerLabel: 'Groundsure', totalPence: 16668, sentTo: null, busy: null, error: null, note: null,
    onHandOver: vi.fn(), onEmailLink: vi.fn(), onCheckPayment: vi.fn(), ...over,
  };
  render(<PaymentHandoffCard {...props} />);
  return props;
}

describe('PaymentHandoffCard', () => {
  it('says whose payment it is, how much and to whom, and offers the two hand-overs', () => {
    const props = renderCard();
    const card = screen.getByTestId('payment-handoff');
    expect(card).toHaveTextContent('Payment in the seller’s name');
    expect(card).toHaveTextContent('£166.68 to Groundsure');
    expect(card).toHaveTextContent('card must be the seller’s own');
    fireEvent.click(screen.getByRole('button', { name: 'Hand the screen over' }));
    fireEvent.click(screen.getByRole('button', { name: 'Email the link to the seller' }));
    expect(props.onHandOver).toHaveBeenCalledTimes(1);
    expect(props.onEmailLink).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Check payment' })).toBeNull();
  });

  it('once the link is sent, shows where it went and lets the agent check for the payment', () => {
    const props = renderCard({ sentTo: 'm***@example.com', note: 'Not paid yet.' });
    expect(screen.getByText(/Sent to/)).toHaveTextContent('m***@example.com');
    expect(screen.getByRole('button', { name: 'Send the link again' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Check payment' }));
    expect(props.onCheckPayment).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toHaveTextContent('Not paid yet.');
  });

  it('shows busy states and errors, and disables the buttons while busy; pence always render as pounds and pence', () => {
    renderCard({ busy: 'sending', error: 'Could not send the link just now.', totalPence: 5 });
    expect(screen.getByTestId('payment-handoff')).toHaveTextContent('£0.05 to Groundsure');
    expect(screen.getByRole('button', { name: 'Sending…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Hand the screen over' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('Could not send the link just now.');
  });
});
