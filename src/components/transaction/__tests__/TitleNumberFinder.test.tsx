// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockSearch = vi.fn();
vi.mock('@/services/hmlrTitle.service', async () => {
  // Keep the real splitAddressLine1 (pure) but stub the network method.
  const actual = await vi.importActual<
    typeof import('@/services/hmlrTitle.service')
  >('@/services/hmlrTitle.service');
  return {
    ...actual,
    hmlrTitleService: { searchTitlesByAddress: (...a: unknown[]) => mockSearch(...a) },
  };
});
vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import TitleNumberFinder from '../TitleNumberFinder';

beforeEach(() => {
  vi.clearAllMocks();
});

function expand() {
  fireEvent.click(screen.getByText(/find it from your address/i));
}

describe('TitleNumberFinder', () => {
  it('passes the split address to the search and fills the field on pick', async () => {
    mockSearch.mockResolvedValueOnce({
      typeCode: 30,
      matches: [
        { titleNumber: 'BD120274', addressDisplay: '1 HIGH STREET, SANDY, SG19 1AG', tenure: 'Freehold' },
        { titleNumber: 'BD268495', addressDisplay: 'FLAT 1, 1 HIGH STREET, SANDY, SG19 1AG', tenure: 'Leasehold' },
      ],
      rejection: null,
      acknowledgement: null,
    });
    const onSelect = vi.fn();

    render(
      <TitleNumberFinder
        postcode="SG19 1AG"
        addressLine1="1 High Street"
        onSelect={onSelect}
      />,
    );

    expand();
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));

    // Address line 1 is split into houseNumber + streetName for HMLR.
    await waitFor(() => expect(mockSearch).toHaveBeenCalledTimes(1));
    expect(mockSearch).toHaveBeenCalledWith({
      postcode: 'SG19 1AG',
      houseNumber: '1',
      streetName: 'High Street',
    });

    // Both matches render; picking one calls onSelect with the title number.
    const match = await screen.findByText('1 HIGH STREET, SANDY, SG19 1AG');
    expect(screen.getByText('BD268495')).toBeInTheDocument();
    fireEvent.click(match);
    expect(onSelect).toHaveBeenCalledWith('BD120274');
  });

  it('shows the HMLR rejection reason on TypeCode 20', async () => {
    mockSearch.mockResolvedValueOnce({
      typeCode: 20,
      matches: [],
      rejection: { reason: 'Insufficient address details', code: 'bg.invalid.property.search.criteria' },
      acknowledgement: null,
    });

    render(<TitleNumberFinder postcode="SG19 1AG" addressLine1="" onSelect={vi.fn()} />);
    expand();
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));

    expect(await screen.findByText(/insufficient address details/i)).toBeInTheDocument();
  });

  it('disables search until a postcode is present', () => {
    render(<TitleNumberFinder postcode="" addressLine1="1 High Street" onSelect={vi.fn()} />);
    expand();
    expect(screen.getByRole('button', { name: /^search$/i })).toBeDisabled();
  });

  it('shows an empty-state message when no titles match', async () => {
    mockSearch.mockResolvedValueOnce({
      typeCode: 30,
      matches: [],
      rejection: null,
      acknowledgement: null,
    });
    render(<TitleNumberFinder postcode="SG19 1AG" addressLine1="1 High Street" onSelect={vi.fn()} />);
    expand();
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));
    expect(await screen.findByText(/no registered titles matched/i)).toBeInTheDocument();
  });

  it('should say HMLR is out of hours on a TypeCode 10 acknowledgement, not "no titles matched"', async () => {
    // Regression 2026-07-22: evening searches hit HMLR's out-of-hours window;
    // it queues the request (TypeCode 10) instead of answering, and the UI
    // showed the misleading empty-state.
    mockSearch.mockResolvedValueOnce({
      typeCode: 10,
      matches: [],
      rejection: null,
      acknowledgement: {
        uniqueId: 'Q-123',
        expectedResponseDateTime: '2026-07-23T06:30:00Z',
        message: 'Request queued for processing',
      },
    });
    render(<TitleNumberFinder postcode="SG19 1AG" addressLine1="1 High Street" onSelect={vi.fn()} />);
    expand();
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));
    expect(await screen.findByText(/out of hours/i)).toBeInTheDocument();
    expect(screen.queryByText(/no registered titles matched/i)).not.toBeInTheDocument();
  });
});
