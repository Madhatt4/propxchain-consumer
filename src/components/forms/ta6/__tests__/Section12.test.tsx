import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

import { Section12 } from '../Section12';
import { emptyTA6Form } from '../../../../types/ta6.defaults';
import type { TA6Section12Connections } from '../../../../types/ta6.types';

function emptySection12(): TA6Section12Connections {
  return emptyTA6Form().section12;
}

const SERVICE_REFS = [
  '12.electricity',
  '12.gas',
  '12.water',
  '12.sewerage',
  '12.treatment-plant',
  '12.heat-pumps',
  '12.telephone',
  '12.broadband',
] as const;

describe('Section12', () => {
  it('should render one yes/no answer group per service row plus other services', () => {
    // Arrange / Act
    render(<Section12 value={emptySection12()} onChange={() => {}} readOnly={false} />);

    // Assert
    SERVICE_REFS.forEach((ref) => {
      expect(screen.getByRole('group', { name: `${ref} answer` })).toBeInTheDocument();
    });
    expect(screen.getByLabelText('12.other details')).toBeInTheDocument();
  });

  it('should offer only yes and no for connection answers (no not-known)', () => {
    // Arrange / Act
    render(<Section12 value={emptySection12()} onChange={() => {}} readOnly={false} />);

    // Assert
    const group = screen.getByRole('group', { name: '12.electricity answer' });
    expect(within(group).getByRole('button', { name: 'Yes' })).toBeInTheDocument();
    expect(within(group).getByRole('button', { name: 'No' })).toBeInTheDocument();
    expect(within(group).queryByRole('button', { name: 'Not known' })).toBeNull();
  });

  it('should record yes for mains electricity when its Yes button is clicked', () => {
    // Arrange
    const onChange = vi.fn();
    const value = emptySection12();
    render(<Section12 value={value} onChange={onChange} readOnly={false} />);

    // Act
    const group = screen.getByRole('group', { name: '12.electricity answer' });
    fireEvent.click(within(group).getByRole('button', { name: 'Yes' }));

    // Assert
    expect(onChange).toHaveBeenCalledWith({
      ...value,
      mainsElectricity: { ...value.mainsElectricity, connected: 'yes' },
    });
  });

  it('should reveal metered detail fields when electricity is connected and record the provider', () => {
    // Arrange
    const onChange = vi.fn();
    const value: TA6Section12Connections = {
      ...emptySection12(),
      mainsElectricity: { connected: 'yes', provider: null, meterLocation: null, supplyNumber: null },
    };
    render(<Section12 value={value} onChange={onChange} readOnly={false} />);
    const row = screen.getByRole('group', { name: '12.electricity connection' });

    // Act
    fireEvent.change(within(row).getByLabelText('Provider'), { target: { value: 'Octopus' } });

    // Assert
    expect(within(row).getByLabelText('Supply number (MPAN/MPRN)')).toBeInTheDocument();
    expect(onChange).toHaveBeenCalledWith({
      ...value,
      mainsElectricity: { ...value.mainsElectricity, provider: 'Octopus' },
    });
  });

  it('should show the stopcock field for a connected water supply', () => {
    // Arrange
    const onChange = vi.fn();
    const value: TA6Section12Connections = {
      ...emptySection12(),
      mainsWater: { connected: 'yes', provider: null, stopcockLocation: null, meterLocation: null },
    };
    render(<Section12 value={value} onChange={onChange} readOnly={false} />);

    // Act
    fireEvent.change(screen.getByLabelText('Stopcock location'), {
      target: { value: 'Under the kitchen sink' },
    });

    // Assert
    expect(onChange).toHaveBeenCalledWith({
      ...value,
      mainsWater: { ...value.mainsWater, stopcockLocation: 'Under the kitchen sink' },
    });
  });

  it('should show make/model and servicer fields for a connected treatment plant', () => {
    // Arrange
    const onChange = vi.fn();
    const value: TA6Section12Connections = {
      ...emptySection12(),
      smallSewageTreatmentPlant: {
        connected: 'yes',
        provider: null,
        makeModel: null,
        serviceProvider: null,
      },
    };
    render(<Section12 value={value} onChange={onChange} readOnly={false} />);
    const row = screen.getByRole('group', { name: '12.treatment-plant connection' });

    // Act
    fireEvent.change(within(row).getByLabelText('Make and model'), {
      target: { value: 'Klargester BioDisc' },
    });

    // Assert
    expect(within(row).getByLabelText('Serviced by')).toBeInTheDocument();
    expect(onChange).toHaveBeenCalledWith({
      ...value,
      smallSewageTreatmentPlant: {
        ...value.smallSewageTreatmentPlant,
        makeModel: 'Klargester BioDisc',
      },
    });
  });

  it('should map the other-services textarea to null when emptied', () => {
    // Arrange
    const onChange = vi.fn();
    const value: TA6Section12Connections = { ...emptySection12(), otherServices: 'Oil tank' };
    render(<Section12 value={value} onChange={onChange} readOnly={false} />);

    // Act
    fireEvent.change(screen.getByLabelText('12.other details'), { target: { value: '' } });

    // Assert
    expect(onChange).toHaveBeenCalledWith({ ...value, otherServices: null });
  });
});
