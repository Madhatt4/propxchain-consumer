import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

import { Section10 } from '../Section10';
import { emptyTA6Form } from '../../../../types/ta6.defaults';
import type { TA6Section10Parking } from '../../../../types/ta6.types';

function emptySection10(): TA6Section10Parking {
  return emptyTA6Form().section10;
}

describe('Section10', () => {
  it('should render the parking checkboxes and both response questions', () => {
    // Arrange / Act
    render(<Section10 value={emptySection10()} onChange={() => {}} readOnly={false} />);

    // Assert
    expect(screen.getByRole('checkbox', { name: 'Garage' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'On-road' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: '10.2 answer' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: '10.3 answer' })).toBeInTheDocument();
  });

  it('should add driveway to the arrangements when its checkbox is ticked', () => {
    // Arrange
    const onChange = vi.fn();
    const value = emptySection10();
    render(<Section10 value={value} onChange={onChange} readOnly={false} />);

    // Act
    fireEvent.click(screen.getByRole('checkbox', { name: 'Driveway' }));

    // Assert
    expect(onChange).toHaveBeenCalledWith({ ...value, q10_1Arrangements: ['driveway'] });
  });

  it('should reveal the parking details field when other is ticked', () => {
    // Arrange
    const value: TA6Section10Parking = { ...emptySection10(), q10_1Arrangements: ['other'] };

    // Act
    render(<Section10 value={value} onChange={() => {}} readOnly={false} />);

    // Assert
    expect(screen.getByLabelText('Parking details')).toBeInTheDocument();
  });

  it('should call onChange with not-known when Not known is clicked on the permit question', () => {
    // Arrange
    const onChange = vi.fn();
    const value = emptySection10();
    render(<Section10 value={value} onChange={onChange} readOnly={false} />);

    // Act
    const permitGroup = screen.getByRole('group', { name: '10.2 answer' });
    fireEvent.click(within(permitGroup).getByRole('button', { name: 'Not known' }));

    // Assert
    expect(onChange).toHaveBeenCalledWith({
      ...value,
      q10_2PermitRequired: { answer: 'not-known', details: '' },
    });
  });

  it('should hide the EV consent slot until the charging point answer is yes', () => {
    // Arrange / Act
    const { rerender } = render(
      <Section10 value={emptySection10()} onChange={() => {}} readOnly={false} />,
    );

    // Assert — no consent slot on a fresh draft
    expect(screen.queryByRole('group', { name: '10.3.consent document status' })).toBeNull();

    // Act — the seller answers yes to the EV charging point
    const withEv: TA6Section10Parking = {
      ...emptySection10(),
      q10_3EvChargingPoint: { answer: 'yes', details: 'Owned outright' },
    };
    rerender(<Section10 value={withEv} onChange={() => {}} readOnly={false} />);

    // Assert
    expect(screen.getByRole('group', { name: '10.3.consent document status' })).toBeInTheDocument();
  });

  it('should record the consent document status without a documentId when To follow is chosen', () => {
    // Arrange
    const onChange = vi.fn();
    const value: TA6Section10Parking = {
      ...emptySection10(),
      q10_3EvChargingPoint: { answer: 'yes', details: '' },
    };
    render(<Section10 value={value} onChange={onChange} readOnly={false} />);

    // Act
    const statusGroup = screen.getByRole('group', { name: '10.3.consent document status' });
    fireEvent.click(within(statusGroup).getByRole('button', { name: 'To follow' }));

    // Assert
    expect(onChange).toHaveBeenCalledWith({
      ...value,
      q10_3InstallConsent: { status: 'to-follow', documentId: null },
    });
  });
});
