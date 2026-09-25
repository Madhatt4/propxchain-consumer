import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

import { Section14 } from '../Section14';
import { emptyTA6Form } from '../../../../types/ta6.defaults';
import type { TA6Section14Completion } from '../../../../types/ta6.types';

const emptySection = (): TA6Section14Completion => emptyTA6Form().section14;

describe('Section14', () => {
  it('should render 14.1 and the three 14.2 commitment questions', () => {
    // Arrange / Act
    render(<Section14 value={emptySection()} onChange={() => {}} readOnly={false} />);

    // Assert
    ['14.1', '14.2a', '14.2b', '14.2c'].forEach((ref) =>
      expect(screen.getByText(ref)).toBeInTheDocument(),
    );
  });

  it('should offer a not-applicable (no mortgage) option on 14.1 and report it on click', () => {
    // Arrange — the form's third 14.1 box is "No mortgage" -> 'not-applicable'
    const onChange = vi.fn();
    render(<Section14 value={emptySection()} onChange={onChange} readOnly={false} />);

    // Act
    const group = screen.getByRole('group', { name: '14.1 answer' });
    fireEvent.click(within(group).getByRole('button', { name: 'Not applicable' }));

    // Assert
    expect(onChange).toHaveBeenCalledWith({
      ...emptySection(),
      q14_1ProceedsClearCharges: { answer: 'not-applicable', details: '' },
    });
  });

  it('should show the 14.1 details textarea when the answer is no and report typed details', () => {
    // Arrange — details are requested when proceeds will NOT clear the charges
    const onChange = vi.fn();
    const value: TA6Section14Completion = {
      ...emptySection(),
      q14_1ProceedsClearCharges: { answer: 'no', details: '' },
    };
    render(<Section14 value={value} onChange={onChange} readOnly={false} />);

    // Act
    fireEvent.change(screen.getByLabelText('14.1 details'), {
      target: { value: 'Second charge of £12,000 remains' },
    });

    // Assert
    expect(onChange).toHaveBeenCalledWith({
      ...value,
      q14_1ProceedsClearCharges: { answer: 'no', details: 'Second charge of £12,000 remains' },
    });
  });

  it('should hide the 14.1 details textarea when the answer is yes and details are empty', () => {
    // Arrange
    const value: TA6Section14Completion = {
      ...emptySection(),
      q14_1ProceedsClearCharges: { answer: 'yes', details: '' },
    };

    // Act
    render(<Section14 value={value} onChange={() => {}} readOnly={false} />);

    // Assert
    expect(screen.queryByLabelText('14.1 details')).not.toBeInTheDocument();
  });

  it('should update only the clicked commitment when Yes is clicked on 14.2b', () => {
    // Arrange
    const onChange = vi.fn();
    render(<Section14 value={emptySection()} onChange={onChange} readOnly={false} />);

    // Act
    const group = screen.getByRole('group', { name: '14.2b answer' });
    fireEvent.click(within(group).getByRole('button', { name: 'Yes' }));

    // Assert
    expect(onChange).toHaveBeenCalledWith({
      ...emptySection(),
      q14_2Commitments: { ...emptySection().q14_2Commitments, removeSellersItems: 'yes' },
    });
  });

  it('should constrain the 14.2 commitments to yes and no only', () => {
    // Arrange / Act
    render(<Section14 value={emptySection()} onChange={() => {}} readOnly={false} />);

    // Assert
    const group = screen.getByRole('group', { name: '14.2a answer' });
    expect(within(group).getAllByRole('button')).toHaveLength(2);
    expect(within(group).queryByRole('button', { name: 'Not known' })).not.toBeInTheDocument();
  });

  it('should disable every answer button when readOnly', () => {
    // Arrange / Act
    render(<Section14 value={emptySection()} onChange={() => {}} readOnly />);

    // Assert
    screen.getAllByRole('button').forEach((button) => expect(button).toBeDisabled());
  });
});
