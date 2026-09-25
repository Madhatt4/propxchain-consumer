import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import TA6Form from '../TA6Form';
import { TA6_OFFICIAL_FORM_URL } from '../../../lib/ta6-prompts/types';
import { emptyTA6Form } from '../../../types/ta6.types';

vi.mock('../FormExportButton', () => ({
  FormExportButton: () => <div data-testid="form-export-stub" />,
}));

const noSave = async (): Promise<void> => {};

describe('TA6Form stepper navigation', () => {
  it('should show section 1 first and advance to section 2 when Next is clicked', () => {
    // Arrange
    render(<TA6Form transactionId="tx-1" initialData={emptyTA6Form()} onSave={noSave} />);
    expect(screen.getByRole('region', { name: /Section 1:/ })).toBeInTheDocument();

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Next section' }));

    // Assert
    expect(screen.getByRole('region', { name: /Section 2:/ })).toBeInTheDocument();
  });

  it('should jump directly to section 8 when its stepper pill is clicked', () => {
    // Arrange
    render(<TA6Form transactionId="tx-1" initialData={emptyTA6Form()} onSave={noSave} />);

    // Act
    fireEvent.click(screen.getByRole('button', { name: /Section 8:/ }));

    // Assert
    expect(screen.getByRole('region', { name: /Section 8:/ })).toBeInTheDocument();
  });

  it('should link to the official Law Society form once from the header', () => {
    // Arrange / Act
    render(<TA6Form transactionId="tx-1" initialData={emptyTA6Form()} onSave={noSave} />);

    // Assert — the ADR 0009 disclosure stays one click away, in the shell only
    const link = screen.getByRole('link', { name: /read the official law society form/i });
    expect(link).toHaveAttribute('href', TA6_OFFICIAL_FORM_URL);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('should open on the section a deep link asks for', () => {
    // Arrange / Act — a "Check my answers" flag links to the section it is about
    render(<TA6Form transactionId="tx-1" initialData={emptyTA6Form()} onSave={noSave} initialStep={5} />);

    // Assert
    expect(screen.getByRole('region', { name: /Section 5:/ })).toBeInTheDocument();
  });

  it('should open on section 1 when the deep link names a section that does not exist', () => {
    // Arrange / Act
    render(<TA6Form transactionId="tx-1" initialData={emptyTA6Form()} onSave={noSave} initialStep={99} />);

    // Assert
    expect(screen.getByRole('region', { name: /Section 1:/ })).toBeInTheDocument();
  });
});

describe('TA6Form acknowledgment gate', () => {
  it('should block the form until acknowledged and call onAcknowledge when confirmed', async () => {
    // Arrange
    const onAcknowledge = vi.fn().mockResolvedValue(undefined);
    render(
      <TA6Form
        transactionId="tx-1"
        initialData={emptyTA6Form()}
        onSave={noSave}
        hasAcknowledged={false}
        onAcknowledge={onAcknowledge}
      />,
    );

    // Assert — gate is shown, the form itself is hidden
    expect(screen.getByText(/official Law Society TA6 wording/i)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /Section 1:/ })).not.toBeInTheDocument();

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'I understand' }));

    // Assert
    await waitFor(() => expect(onAcknowledge).toHaveBeenCalledTimes(1));
  });

  it('should not block the form when hasAcknowledged is undefined (legacy callers)', () => {
    // Arrange / Act
    render(<TA6Form transactionId="tx-1" initialData={emptyTA6Form()} onSave={noSave} />);

    // Assert
    expect(screen.getByRole('region', { name: /Section 1:/ })).toBeInTheDocument();
  });
});
