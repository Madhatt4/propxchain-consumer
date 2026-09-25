import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import HmlrRegisterCard from '../HmlrRegisterCard';
import type { HmlrFetchAudit } from '../../../services/transactionAudit';

function makeFetch(overrides: Partial<HmlrFetchAudit> = {}): HmlrFetchAudit {
  return {
    titleNumber: 'BD247886',
    responseHash: 'a1b2c3d4e5f60718293a4b5c6d7e8f901234567890abcdef1234567890abcdef',
    fetchedAt: Date.UTC(2026, 5, 16, 12) * 1_000_000, // 16 Jun 2026, ns
    fetchedBy: 'q5inx-example-principal',
    ...overrides,
  };
}

describe('HmlrRegisterCard', () => {
  it('should render title number, fetch date and truncated hash when the register was pulled', () => {
    render(<HmlrRegisterCard hmlrFetch={makeFetch()} />);

    expect(screen.getByText('BD247886')).toBeInTheDocument();
    // 16 Jun 2026 in en-GB short format
    expect(screen.getByText(/16 Jun 2026/)).toBeInTheDocument();
    // Hash is truncated head...tail, never shown in full
    expect(screen.getByText(/a1b2c3d4\.\.\.90abcdef/)).toBeInTheDocument();
  });

  it('should render a not-pulled placeholder when hmlrFetch is null', () => {
    render(<HmlrRegisterCard hmlrFetch={null} />);

    expect(screen.getByText(/not been pulled/i)).toBeInTheDocument();
  });
});
