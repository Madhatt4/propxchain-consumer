import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

import { Section09 } from '../Section09';
import { emptyTA6Form } from '../../../../types/ta6.types';
import type { TA6Section9Rights } from '../../../../types/ta6.types';

const emptySlice = (): TA6Section9Rights => emptyTA6Form().section9;

describe('Section09', () => {
  it('should render every numbered question with row editors and amounts hidden on a draft form', () => {
    // Arrange / Act
    render(<Section09 value={emptySlice()} onChange={() => {}} readOnly={false} />);

    // Assert — 9.1..9.9 present, conditional editors absent
    for (const ref of ['9.1', '9.2', '9.3', '9.4', '9.5', '9.6', '9.7', '9.8', '9.9']) {
      expect(screen.getByText(ref)).toBeInTheDocument();
    }
    expect(screen.queryByRole('group', { name: '9.1 rights' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: '9.4 rights' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Amount you pay (£)')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add arrangement' })).toBeInTheDocument();
  });

  it('should call onChange with a not-known 9.7 response when Not known is clicked', () => {
    // Arrange
    const onChange = vi.fn();
    render(<Section09 value={emptySlice()} onChange={onChange} readOnly={false} />);

    // Act
    fireEvent.click(
      within(screen.getByRole('group', { name: '9.7 answer' })).getByRole('button', {
        name: 'Not known',
      }),
    );

    // Assert
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ q9_7CrossingOtherProperty: { answer: 'not-known', details: '' } }),
    );
  });

  it('should append an empty right row when Add right is clicked in the 9.1 editor', () => {
    // Arrange
    const onChange = vi.fn();
    const slice: TA6Section9Rights = {
      ...emptySlice(),
      q9_1RightsExercised: { answer: 'yes', details: '' },
    };
    render(<Section09 value={slice} onChange={onChange} readOnly={false} />);

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Add right' }));

    // Assert
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ q9_1Rights: [{ description: '', overProperty: null }] }),
    );
  });

  it('should render an open ghost right row with no remove control when 9.1 is yes with no rights', () => {
    // Arrange
    const slice: TA6Section9Rights = {
      ...emptySlice(),
      q9_1RightsExercised: { answer: 'yes', details: '' },
    };

    // Act
    render(<Section09 value={slice} onChange={() => {}} readOnly={false} />);

    // Assert — the first row sits open without a click, but cannot be removed
    const editor = screen.getByRole('group', { name: '9.1 rights' });
    expect(within(editor).getByLabelText('Right 1 description')).toHaveValue('');
    expect(
      within(editor).queryByRole('button', { name: 'Remove right 1' }),
    ).not.toBeInTheDocument();
  });

  it('should materialise the 9.1 ghost right as a one-element array on the first keystroke', () => {
    // Arrange
    const onChange = vi.fn();
    const slice: TA6Section9Rights = {
      ...emptySlice(),
      q9_1RightsExercised: { answer: 'yes', details: '' },
    };
    render(<Section09 value={slice} onChange={onChange} readOnly={false} />);

    // Act
    const editor = screen.getByRole('group', { name: '9.1 rights' });
    fireEvent.change(within(editor).getByLabelText('Right 1 description'), {
      target: { value: 'Shared driveway' },
    });

    // Assert — typing writes through the ghost, nothing fired before
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        q9_1Rights: [{ description: 'Shared driveway', overProperty: null }],
      }),
    );
  });

  it('should materialise the 9.4 ghost right independently of the 9.1 editor', () => {
    // Arrange — only the 9.4 editor is open
    const onChange = vi.fn();
    const slice: TA6Section9Rights = {
      ...emptySlice(),
      q9_4OthersRights: { answer: 'yes', details: '' },
    };
    render(<Section09 value={slice} onChange={onChange} readOnly={false} />);

    // Act
    const editor = screen.getByRole('group', { name: '9.4 rights' });
    fireEvent.change(within(editor).getByLabelText('Right 1 description'), {
      target: { value: 'Right of way across the rear garden' },
    });

    // Assert — the 9.4 ghost materialises into q9_4Rights, not q9_1Rights
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        q9_1Rights: [],
        q9_4Rights: [{ description: 'Right of way across the rear garden', overProperty: null }],
      }),
    );
  });

  it('should remove a 9.4 right row when its Remove button is clicked', () => {
    // Arrange
    const onChange = vi.fn();
    const slice: TA6Section9Rights = {
      ...emptySlice(),
      q9_4OthersRights: { answer: 'yes', details: '' },
      q9_4Rights: [{ description: 'Right of way across the rear garden', overProperty: null }],
    };
    render(<Section09 value={slice} onChange={onChange} readOnly={false} />);

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Remove right 1' }));

    // Assert
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ q9_4Rights: [] }));
  });

  it('should store a pounds amount as pence when typed into the 9.2 amount field', () => {
    // Arrange
    const onChange = vi.fn();
    const slice: TA6Section9Rights = {
      ...emptySlice(),
      q9_2Contributions: { answer: 'yes', details: '' },
    };
    render(<Section09 value={slice} onChange={onChange} readOnly={false} />);

    // Act
    fireEvent.change(screen.getByLabelText('Amount you pay (£)'), {
      target: { value: '12.50' },
    });

    // Assert — £12.50 -> 1250 pence
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ q9_2Amount: 1250 }));
  });

  it('should display a stored pence amount as pounds in the 9.5 amount field', () => {
    // Arrange
    const slice: TA6Section9Rights = {
      ...emptySlice(),
      q9_5ContributionsReceived: { answer: 'yes', details: '' },
      q9_5Amount: 4999,
    };

    // Act
    render(<Section09 value={slice} onChange={() => {}} readOnly={false} />);

    // Assert — 4999 pence -> £49.99
    expect(screen.getByLabelText('Amount you ask for (£)')).toHaveValue('49.99');
  });

  it('should create an empty arrangement record when Add arrangement is clicked', () => {
    // Arrange
    const onChange = vi.fn();
    render(<Section09 value={emptySlice()} onChange={onChange} readOnly={false} />);

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Add arrangement' }));

    // Assert
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        q9_9Arrangement: {
          description: '',
          contributionAmount: null,
          document: { status: 'not-answered', documentId: null },
        },
      }),
    );
  });

  it('should clear the arrangement record when Remove arrangement is clicked', () => {
    // Arrange
    const onChange = vi.fn();
    const slice: TA6Section9Rights = {
      ...emptySlice(),
      q9_9Arrangement: {
        description: 'Shared drain maintenance with next door',
        contributionAmount: 2000,
        document: { status: 'to-follow', documentId: null },
      },
    };
    render(<Section09 value={slice} onChange={onChange} readOnly={false} />);

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Remove arrangement' }));

    // Assert
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ q9_9Arrangement: null }));
  });
});
