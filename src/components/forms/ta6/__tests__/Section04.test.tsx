import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

import { Section04 } from '../Section04';
import { emptyTA6Form } from '../../../../types/ta6.types';

describe('Section04', () => {
  it('should render the three notices questions with their ref chips', () => {
    // Arrange / Act
    render(<Section04 value={emptyTA6Form().section4} onChange={() => {}} readOnly={false} />);

    // Assert — one ResponseField per §4 question
    expect(screen.getByText('4.1')).toBeInTheDocument();
    expect(screen.getByText('4.2')).toBeInTheDocument();
    expect(screen.getByText('4.3')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: '4.1 answer' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: '4.2 answer' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: '4.3 answer' })).toBeInTheDocument();
  });

  it('should call onChange with a not-known 4.1 answer when Not known is clicked', () => {
    // Arrange
    const onChange = vi.fn();
    const value = emptyTA6Form().section4;
    render(<Section04 value={value} onChange={onChange} readOnly={false} />);

    // Act
    const group = screen.getByRole('group', { name: '4.1 answer' });
    fireEvent.click(within(group).getByRole('button', { name: 'Not known' }));

    // Assert — only the targeted slot changes, the rest of the slice is intact
    expect(onChange).toHaveBeenCalledWith({
      ...value,
      q4_1NoticesReceived: { answer: 'not-known', details: '' },
    });
  });

  it('should disable every answer button when readOnly', () => {
    // Arrange / Act
    render(<Section04 value={emptyTA6Form().section4} onChange={() => {}} readOnly />);

    // Assert
    screen.getAllByRole('button').forEach((button) => expect(button).toBeDisabled());
  });
});
