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
  it('hides lease rows for freehold', () => {
    render(<MaterialInfoPanel info={emptyMaterialInfo()} tenure="freehold" />);
    expect(screen.queryByText(/ground rent/i)).toBeNull();
  });
  it('renders "Not yet provided" instead of crashing for a partially-shaped DB default of {}', () => {
    render(<MaterialInfoPanel info={{}} tenure={null} />);
    expect(screen.getAllByText(/not yet provided/i).length).toBeGreaterThan(3);
  });
});
