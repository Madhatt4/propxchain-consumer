// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MaterialInfoEditor from '../MaterialInfoEditor';
import type { MaterialInfoOverrides } from '@/types/materialInfo.types';

describe('<MaterialInfoEditor>', () => {
  it('typing a council tax band calls onChange with the key set', () => {
    const onChange = vi.fn();
    render(<MaterialInfoEditor value={{}} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText(/council tax band/i), { target: { value: 'D' } });

    expect(onChange).toHaveBeenCalledWith({ councilTaxBand: 'D' });
  });

  it('clearing the council tax band calls onChange without the key', () => {
    const onChange = vi.fn();
    const value: MaterialInfoOverrides = { councilTaxBand: 'D', floodRisk: 'Low' };
    render(<MaterialInfoEditor value={value} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText(/council tax band/i), { target: { value: '' } });

    expect(onChange).toHaveBeenCalledWith({ floodRisk: 'Low' });
  });

  it('selecting "Not set" for conservation area removes the key entirely', () => {
    const onChange = vi.fn();
    const value: MaterialInfoOverrides = { conservationArea: true };
    render(<MaterialInfoEditor value={value} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText(/conservation area/i), { target: { value: '' } });

    expect(onChange).toHaveBeenCalledWith({});
  });

  it('selecting "No" for conservation area sets the key to false', () => {
    const onChange = vi.fn();
    render(<MaterialInfoEditor value={{}} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText(/conservation area/i), { target: { value: 'no' } });

    expect(onChange).toHaveBeenCalledWith({ conservationArea: false });
  });

  it('selecting "Yes" for conservation area sets the key to true', () => {
    const onChange = vi.fn();
    render(<MaterialInfoEditor value={{}} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText(/conservation area/i), { target: { value: 'yes' } });

    expect(onChange).toHaveBeenCalledWith({ conservationArea: true });
  });

  it('selecting "High" flood risk calls onChange with the key set', () => {
    const onChange = vi.fn();
    render(<MaterialInfoEditor value={{}} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText(/flood risk/i), { target: { value: 'High' } });

    expect(onChange).toHaveBeenCalledWith({ floodRisk: 'High' });
  });

  it('re-selecting the blank "Not set" flood risk option deletes the key', () => {
    const onChange = vi.fn();
    const value: MaterialInfoOverrides = { floodRisk: 'High' };
    render(<MaterialInfoEditor value={value} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText(/flood risk/i), { target: { value: '' } });

    expect(onChange).toHaveBeenCalledWith({});
  });

  it('selecting "None" listed building sets the key rather than deleting it', () => {
    const onChange = vi.fn();
    render(<MaterialInfoEditor value={{}} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText(/listed building/i), { target: { value: 'None' } });

    expect(onChange).toHaveBeenCalledWith({ listedBuilding: 'None' });
  });

  it('typing a ground rent amount calls onChange with the key set', () => {
    const onChange = vi.fn();
    render(<MaterialInfoEditor value={{}} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText(/ground rent/i), { target: { value: '250' } });

    expect(onChange).toHaveBeenCalledWith({ groundRentPerYear: 250 });
  });

  it('typing "0" ground rent calls onChange with a zero value, not a deletion', () => {
    const onChange = vi.fn();
    render(<MaterialInfoEditor value={{}} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText(/ground rent/i), { target: { value: '0' } });

    expect(onChange).toHaveBeenCalledWith({ groundRentPerYear: 0 });
  });

  it('clearing the ground rent input calls onChange without the key', () => {
    const onChange = vi.fn();
    const value: MaterialInfoOverrides = { groundRentPerYear: 250 };
    render(<MaterialInfoEditor value={value} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText(/ground rent/i), { target: { value: '' } });

    expect(onChange).toHaveBeenCalledWith({});
  });
});
