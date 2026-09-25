import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

import { Section11 } from '../Section11';
import { emptyTA6Form } from '../../../../types/ta6.defaults';
import type { TA6Section11Services, TA6SewerageSystem } from '../../../../types/ta6.types';

function emptySection11(): TA6Section11Services {
  return emptyTA6Form().section11;
}

function septicSystem(): TA6SewerageSystem {
  return {
    source: 'septic-tank',
    otherDetails: null,
    location: null,
    lastServiceDate: null,
    dischargeType: null,
    infiltrationSystem: 'not-answered',
    regulationCompliant: 'not-answered',
  };
}

describe('Section11', () => {
  it('should render electrics, heating and drainage question groups', () => {
    // Arrange / Act
    render(<Section11 value={emptySection11()} onChange={() => {}} readOnly={false} />);

    // Assert
    expect(screen.getByRole('group', { name: '11.1 answer' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: '11.2 answer' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: '11.3 answer' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add heating system' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: '11.5a answer' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: '11.5b answer' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: '11.6 answer' })).toBeInTheDocument();
  });

  it('should reveal the report date and document slot when the EICR answer is yes', () => {
    // Arrange
    const value: TA6Section11Services = { ...emptySection11(), q11_3Eicr: 'yes' };

    // Act
    render(<Section11 value={value} onChange={() => {}} readOnly={false} />);

    // Assert
    expect(screen.getByLabelText('Date of most recent report')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: '11.3.doc document status' })).toBeInTheDocument();
  });

  it('should render an open ghost heating row with defaults before any system is added', () => {
    // Arrange
    const onChange = vi.fn();

    // Act
    render(<Section11 value={emptySection11()} onChange={onChange} readOnly={false} />);

    // Assert — row 1 is open with defaults, the ghost cannot be removed,
    // and nothing is written to form state until the user edits it
    expect(screen.getByLabelText('11.4 system 1 type')).toHaveValue('gas-central');
    expect(screen.queryByRole('button', { name: 'Remove heating system 1' })).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('should materialise the ghost heating row as a one-element array on first edit', () => {
    // Arrange
    const onChange = vi.fn();
    const value = emptySection11();
    render(<Section11 value={value} onChange={onChange} readOnly={false} />);

    // Act
    fireEvent.change(screen.getByLabelText('11.4 system 1 type'), { target: { value: 'oil' } });

    // Assert
    expect(onChange).toHaveBeenCalledWith({
      ...value,
      q11_4HeatingSystems: [
        {
          heatingType: 'oil',
          otherDetails: null,
          installDate: null,
          lastServiceDate: null,
          certificate: { status: 'not-answered', documentId: null },
        },
      ],
    });
  });

  it('should append an empty heating system when Add heating system is clicked', () => {
    // Arrange
    const onChange = vi.fn();
    const value = emptySection11();
    render(<Section11 value={value} onChange={onChange} readOnly={false} />);

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Add heating system' }));

    // Assert
    expect(onChange).toHaveBeenCalledWith({
      ...value,
      q11_4HeatingSystems: [
        {
          heatingType: 'gas-central',
          otherDetails: null,
          installDate: null,
          lastServiceDate: null,
          certificate: { status: 'not-answered', documentId: null },
        },
      ],
    });
  });

  it('should update a heating system type when the row select changes', () => {
    // Arrange
    const onChange = vi.fn();
    const system = {
      heatingType: 'gas-central' as const,
      otherDetails: null,
      installDate: null,
      lastServiceDate: null,
      certificate: { status: 'not-answered' as const, documentId: null },
    };
    const value: TA6Section11Services = { ...emptySection11(), q11_4HeatingSystems: [system] };
    render(<Section11 value={value} onChange={onChange} readOnly={false} />);

    // Act
    fireEvent.change(screen.getByLabelText('11.4 system 1 type'), { target: { value: 'oil' } });

    // Assert
    expect(onChange).toHaveBeenCalledWith({
      ...value,
      q11_4HeatingSystems: [{ ...system, heatingType: 'oil' }],
    });
  });

  it('should populate the 11.7 system when a non-mains sewerage source is selected', () => {
    // Arrange
    const onChange = vi.fn();
    const value = emptySection11();
    render(<Section11 value={value} onChange={onChange} readOnly={false} />);

    // Act
    const sourceGroup = screen.getByRole('group', { name: '11.6 answer' });
    fireEvent.click(within(sourceGroup).getByRole('button', { name: 'Septic tank' }));

    // Assert
    expect(onChange).toHaveBeenCalledWith({
      ...value,
      q11_6SewerageSource: 'septic-tank',
      q11_7SewerageSystem: septicSystem(),
    });
  });

  it('should clear the 11.7 system when the source moves back to mains', () => {
    // Arrange
    const onChange = vi.fn();
    const value: TA6Section11Services = {
      ...emptySection11(),
      q11_6SewerageSource: 'septic-tank',
      q11_7SewerageSystem: septicSystem(),
    };
    render(<Section11 value={value} onChange={onChange} readOnly={false} />);

    // Act
    const sourceGroup = screen.getByRole('group', { name: '11.6 answer' });
    fireEvent.click(within(sourceGroup).getByRole('button', { name: 'Mains drains' }));

    // Assert
    expect(onChange).toHaveBeenCalledWith({
      ...value,
      q11_6SewerageSource: 'mains',
      q11_7SewerageSystem: null,
    });
  });

  it('should show the 11.7 detail block and record its infiltration answer', () => {
    // Arrange
    const onChange = vi.fn();
    const system = septicSystem();
    const value: TA6Section11Services = {
      ...emptySection11(),
      q11_6SewerageSource: 'septic-tank',
      q11_7SewerageSystem: system,
    };
    render(<Section11 value={value} onChange={onChange} readOnly={false} />);

    // Assert — the conditional block is on screen
    expect(screen.getByLabelText('Location of the system')).toBeInTheDocument();

    // Act
    const infiltrationGroup = screen.getByRole('group', { name: '11.7 infiltration answer' });
    fireEvent.click(within(infiltrationGroup).getByRole('button', { name: 'Not known' }));

    // Assert
    expect(onChange).toHaveBeenCalledWith({
      ...value,
      q11_7SewerageSystem: { ...system, infiltrationSystem: 'not-known' },
    });
  });

  it('should hide the 11.7 block while the sewerage source is unanswered', () => {
    // Arrange / Act
    render(<Section11 value={emptySection11()} onChange={() => {}} readOnly={false} />);

    // Assert
    expect(screen.queryByLabelText('Location of the system')).toBeNull();
  });
});
