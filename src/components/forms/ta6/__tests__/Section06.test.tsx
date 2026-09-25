import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

import { Section06 } from '../Section06';
import { emptyTA6Form } from '../../../../types/ta6.types';
import type { TA6Section6Guarantees } from '../../../../types/ta6.types';

const WARRANTY_REFS = [
  '6.1.new-home-warranty',
  '6.1.damp-proofing',
  '6.1.timber-treatment',
  '6.1.roofing',
  '6.1.electrical-work',
  '6.1.windows-doors',
  '6.1.central-heating',
  '6.1.underpinning',
  '6.1.other',
];

function emptySection6(): TA6Section6Guarantees {
  return emptyTA6Form().section6;
}

describe('Section06', () => {
  it('should render one checklist row per 6.1 warranty type plus 6.2 and 6.3', () => {
    // Arrange / Act
    render(<Section06 value={emptySection6()} onChange={() => {}} readOnly={false} />);

    // Assert
    WARRANTY_REFS.forEach((ref) => {
      expect(screen.getByRole('group', { name: `${ref} answer` })).toBeInTheDocument();
    });
    expect(screen.getByRole('group', { name: '6.2 answer' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: '6.3 answer' })).toBeInTheDocument();
  });

  it('should call onChange with present yes when Yes is clicked on the new home warranty row', () => {
    // Arrange
    const onChange = vi.fn();
    const value = emptySection6();
    render(<Section06 value={value} onChange={onChange} readOnly={false} />);

    // Act
    const group = screen.getByRole('group', { name: '6.1.new-home-warranty answer' });
    fireEvent.click(within(group).getByRole('button', { name: 'Yes' }));

    // Assert
    expect(onChange).toHaveBeenCalledWith({
      ...value,
      q6_1NewHomeWarranty: {
        present: 'yes',
        document: { status: 'not-answered', documentId: null },
      },
    });
  });

  it('should reveal the certificate slot only for warranties answered yes', () => {
    // Arrange
    const value: TA6Section6Guarantees = {
      ...emptySection6(),
      q6_1Roofing: { present: 'yes', document: { status: 'not-answered', documentId: null } },
    };

    // Act
    render(<Section06 value={value} onChange={() => {}} readOnly={false} />);

    // Assert — roofing shows its slot; a draft row does not
    expect(screen.getByRole('group', { name: '6.1.roofing.doc document status' })).toBeInTheDocument();
    expect(
      screen.queryByRole('group', { name: '6.1.damp-proofing.doc document status' }),
    ).not.toBeInTheDocument();
  });

  it('should show the other-warranty details field once the other row is answered yes', () => {
    // Arrange
    const onChange = vi.fn();
    const value: TA6Section6Guarantees = {
      ...emptySection6(),
      q6_1Other: { present: 'yes', document: { status: 'not-answered', documentId: null } },
    };
    render(<Section06 value={value} onChange={onChange} readOnly={false} />);

    // Act
    fireEvent.change(screen.getByLabelText('What does the other guarantee or warranty cover?'), {
      target: { value: 'Cavity wall insulation (CIGA)' },
    });

    // Assert
    expect(onChange).toHaveBeenCalledWith({
      ...value,
      q6_1OtherDetails: 'Cavity wall insulation (CIGA)',
    });
  });

  it('should call onChange with a not-known 6.2 claims answer when Not known is clicked', () => {
    // Arrange
    const onChange = vi.fn();
    const value = emptySection6();
    render(<Section06 value={value} onChange={onChange} readOnly={false} />);

    // Act
    const group = screen.getByRole('group', { name: '6.2 answer' });
    fireEvent.click(within(group).getByRole('button', { name: 'Not known' }));

    // Assert
    expect(onChange).toHaveBeenCalledWith({
      ...value,
      q6_2Claims: { answer: 'not-known', details: '' },
    });
  });
});
