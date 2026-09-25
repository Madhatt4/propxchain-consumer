import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

import { Section07 } from '../Section07';
import { emptyTA6Form } from '../../../../types/ta6.types';

const WHO_INSURES_LABEL = 'If you do not insure the property, who does?';

const emptySlice = (): ReturnType<typeof emptyTA6Form>['section7'] => emptyTA6Form().section7;

describe('Section07', () => {
  it('should render all three section 7 questions with the who-insures follow-up hidden on a draft form', () => {
    // Arrange / Act
    render(<Section07 value={emptySlice()} onChange={() => {}} readOnly={false} />);

    // Assert — ref chips for 7.1–7.3, no follow-up input yet
    expect(screen.getByText('7.1')).toBeInTheDocument();
    expect(screen.getByText('7.2')).toBeInTheDocument();
    expect(screen.getByText('7.3')).toBeInTheDocument();
    expect(screen.queryByLabelText(WHO_INSURES_LABEL)).not.toBeInTheDocument();
  });

  it('should offer only yes and no for 7.1 because the seller knows who arranges cover', () => {
    // Arrange / Act
    render(<Section07 value={emptySlice()} onChange={() => {}} readOnly={false} />);

    // Assert
    const group = screen.getByRole('group', { name: '7.1 answer' });
    expect(within(group).getByRole('button', { name: 'Yes' })).toBeInTheDocument();
    expect(within(group).getByRole('button', { name: 'No' })).toBeInTheDocument();
    expect(within(group).queryByRole('button', { name: 'Not known' })).not.toBeInTheDocument();
  });

  it('should call onChange with q7_1DoYouInsure no when No is clicked on 7.1', () => {
    // Arrange
    const onChange = vi.fn();
    const slice = emptySlice();
    render(<Section07 value={slice} onChange={onChange} readOnly={false} />);

    // Act
    fireEvent.click(
      within(screen.getByRole('group', { name: '7.1 answer' })).getByRole('button', {
        name: 'No',
      }),
    );

    // Assert
    expect(onChange).toHaveBeenCalledWith({ ...slice, q7_1DoYouInsure: 'no' });
  });

  it('should reveal the who-insures input when the seller answers no and report typed text', () => {
    // Arrange
    const onChange = vi.fn();
    const slice = { ...emptySlice(), q7_1DoYouInsure: 'no' as const };
    render(<Section07 value={slice} onChange={onChange} readOnly={false} />);

    // Act
    fireEvent.change(screen.getByLabelText(WHO_INSURES_LABEL), {
      target: { value: 'The freeholder' },
    });

    // Assert
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ q7_1WhoInsuresIfNot: 'The freeholder' }),
    );
  });

  it('should call onChange with a not-known 7.3 claims response when Not known is clicked', () => {
    // Arrange
    const onChange = vi.fn();
    render(<Section07 value={emptySlice()} onChange={onChange} readOnly={false} />);

    // Act
    fireEvent.click(
      within(screen.getByRole('group', { name: '7.3 answer' })).getByRole('button', {
        name: 'Not known',
      }),
    );

    // Assert
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ q7_3Claims: { answer: 'not-known', details: '' } }),
    );
  });
});
