// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuditTrailLink } from '../AuditTrailLink';

describe('AuditTrailLink', () => {
  it('links to the audit page for the given transaction', () => {
    render(
      <MemoryRouter>
        <AuditTrailLink transactionId="tx_42" />
      </MemoryRouter>,
    );
    const link = screen.getByRole('link', { name: /view audit trail/i });
    expect(link).toHaveAttribute('href', '/transaction/tx_42/audit');
  });

  it('applies a caller-supplied className to the wrapper', () => {
    render(
      <MemoryRouter>
        <AuditTrailLink transactionId="tx_42" className="mb-4" />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('audit-trail-section')).toHaveClass('mb-4');
  });
});
