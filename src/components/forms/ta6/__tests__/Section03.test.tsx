import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

import { Section03 } from '../Section03';
import { emptyTA6Form } from '../../../../types/ta6.types';

describe('Section03', () => {
  it('should render both dispute questions with their refs from an empty section 3 slice', () => {
    // Arrange / Act
    render(
      <Section03 value={emptyTA6Form().section3} onChange={() => {}} readOnly={false} />,
    );

    // Assert
    expect(screen.getByText('3.1')).toBeInTheDocument();
    expect(screen.getByText('3.2')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: '3.1 answer' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: '3.2 answer' })).toBeInTheDocument();
  });

  it('should call onChange with not-known on 3.1 when Not known is clicked', () => {
    // Arrange
    const onChange = vi.fn();
    const value = emptyTA6Form().section3;
    render(<Section03 value={value} onChange={onChange} readOnly={false} />);
    const answerGroup = screen.getByRole('group', { name: '3.1 answer' });

    // Act
    fireEvent.click(within(answerGroup).getByRole('button', { name: 'Not known' }));

    // Assert
    expect(onChange).toHaveBeenCalledWith({
      ...value,
      q3_1ExistingDisputes: { answer: 'not-known', details: '' },
    });
  });

  it('should call onChange with yes on 3.2 when Yes is clicked', () => {
    // Arrange
    const onChange = vi.fn();
    const value = emptyTA6Form().section3;
    render(<Section03 value={value} onChange={onChange} readOnly={false} />);
    const answerGroup = screen.getByRole('group', { name: '3.2 answer' });

    // Act
    fireEvent.click(within(answerGroup).getByRole('button', { name: 'Yes' }));

    // Assert
    expect(onChange).toHaveBeenCalledWith({
      ...value,
      q3_2PotentialDisputes: { answer: 'yes', details: '' },
    });
  });

  it('should disable every answer button when readOnly', () => {
    // Arrange / Act
    render(<Section03 value={emptyTA6Form().section3} onChange={() => {}} readOnly />);

    // Assert
    screen.getAllByRole('button').forEach((button) => expect(button).toBeDisabled());
  });
});
