// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MaterialInfoPanel from '../MaterialInfoPanel';
import { emptyMaterialInfo } from '@/utils/materialInfo';

describe('<MaterialInfoPanel>', () => {
  it('renders Part A/B/C headings and "Not yet provided" for missing fields', () => {
    render(<MaterialInfoPanel info={emptyMaterialInfo()} tenure={null} />);
    expect(screen.getByRole('heading', { name: /part a/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /part b/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /part c/i })).toBeInTheDocument();
    expect(screen.getAllByText(/not yet provided/i).length).toBeGreaterThan(3);
  });
  it('shows value and source badge for provided fields', () => {
    const info = { ...emptyMaterialInfo(), epcRating: { value: 'C', source: 'epc' as const }, price: { value: 325000, source: 'listing' as const } };
    render(<MaterialInfoPanel info={info} tenure="freehold" />);
    expect(screen.getByText('C')).toBeInTheDocument();
    expect(screen.getByText(/£325,000/)).toBeInTheDocument();
    expect(screen.getByText(/from epc register/i)).toBeInTheDocument();
  });
  it('shows lease terms under Part A, and utilities under Part B with the TA6 badge', () => {
    const info = { ...emptyMaterialInfo(), heating: { value: 'Gas central heating', source: 'seller' as const } };
    render(<MaterialInfoPanel info={info} tenure="leasehold" />);
    const partA = screen.getByRole('heading', { name: /part a/i }).closest('section') as HTMLElement;
    const partB = screen.getByRole('heading', { name: /part b/i }).closest('section') as HTMLElement;
    expect(partA).toHaveTextContent(/ground rent/i);
    expect(partB).not.toHaveTextContent(/ground rent/i);
    expect(partB).toHaveTextContent(/gas central heating/i);
    expect(partB).toHaveTextContent(/from seller's ta6/i);
    expect(partB).toHaveTextContent(/broadband/i);
  });
  it('hides lease rows for freehold', () => {
    render(<MaterialInfoPanel info={emptyMaterialInfo()} tenure="freehold" />);
    expect(screen.queryByText(/ground rent/i)).toBeNull();
  });
  it('renders "Not yet provided" instead of crashing for a partially-shaped DB default of {}', () => {
    render(<MaterialInfoPanel info={{}} tenure={null} />);
    expect(screen.getAllByText(/not yet provided/i).length).toBeGreaterThan(3);
  });
});
