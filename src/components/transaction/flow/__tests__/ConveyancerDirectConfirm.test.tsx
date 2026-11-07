import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConveyancerDirectConfirm } from '../ConveyancerDirectConfirm';

const OFFER = /My conveyancer isn.t on PropXchain/;

describe('ConveyancerDirectConfirm', () => {
  it('should confirm only after the client says so twice', () => {
    const onConfirm = vi.fn();
    render(<ConveyancerDirectConfirm isClientConfirmed={false} isComplete={false} canConfirm onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole('button', { name: OFFER }));
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('should not offer the choice to someone who is not this side\'s client', () => {
    render(<ConveyancerDirectConfirm isClientConfirmed={false} isComplete={false} canConfirm={false} onConfirm={vi.fn()} />);

    expect(screen.queryByRole('button', { name: OFFER })).not.toBeInTheDocument();
  });

  it('should not offer the choice once a verified conveyancer is on the deal', () => {
    render(<ConveyancerDirectConfirm isClientConfirmed={false} isComplete canConfirm onConfirm={vi.fn()} />);

    expect(screen.queryByRole('button', { name: OFFER })).not.toBeInTheDocument();
  });

  it('should say a client-confirmed stage is not verified by a conveyancer', () => {
    render(<ConveyancerDirectConfirm isClientConfirmed isComplete canConfirm onConfirm={vi.fn()} />);

    expect(screen.getByText('Client-confirmed, not verified by a conveyancer.')).toBeInTheDocument();
  });
});
