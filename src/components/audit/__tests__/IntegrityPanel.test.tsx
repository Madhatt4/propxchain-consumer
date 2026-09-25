import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import IntegrityPanel from '../IntegrityPanel';
import type { IntegrityVerification } from '../../../services/transactionAudit';

// Mock useThemeClasses to avoid ThemeContext dependency
vi.mock('../../../hooks/useThemeClasses', () => ({
  useThemeClasses: () => ({
    textPrimary: 'text-primary',
    textSecondary: 'text-secondary',
    textTertiary: 'text-tertiary',
    cardPrimary: 'card-primary',
    cardSecondary: 'card-secondary',
  }),
}));

function makeIntegrity(overrides: Partial<IntegrityVerification> = {}): IntegrityVerification {
  return {
    overallStatus: 'verified',
    documentHashesVerified: true,
    crossReferenceStatus: 'all_matched',
    crossReferences: [],
    canisterAvailability: {
      transaction_manager: true,
      document_storage: true,
      ledger_manager: true,
    },
    ...overrides,
  };
}

describe('IntegrityPanel', () => {
  it('should render green badge when status is verified', () => {
    const integrity = makeIntegrity({ overallStatus: 'verified' });

    render(<IntegrityPanel integrity={integrity} />);

    expect(screen.getByText('All data verified')).toBeInTheDocument();
    // The container should have green border classes
    const container = screen.getByText('All data verified').closest('div[class*="border"]');
    expect(container?.className).toContain('border-green-600');
    expect(container?.className).toContain('bg-green-50');
  });

  it('should render amber badge when status is warning', () => {
    const integrity = makeIntegrity({ overallStatus: 'warning' });

    render(<IntegrityPanel integrity={integrity} />);

    expect(screen.getByText('Some data unavailable')).toBeInTheDocument();
    const container = screen.getByText('Some data unavailable').closest('div[class*="border"]');
    expect(container?.className).toContain('border-amber-500');
    expect(container?.className).toContain('bg-amber-50');
  });

  it('should render red badge when status is discrepancy', () => {
    const integrity = makeIntegrity({ overallStatus: 'discrepancy' });

    render(<IntegrityPanel integrity={integrity} />);

    expect(screen.getByText('Discrepancies found')).toBeInTheDocument();
    const container = screen.getByText('Discrepancies found').closest('div[class*="border"]');
    expect(container?.className).toContain('border-red-600');
    expect(container?.className).toContain('bg-red-50');
  });

  it('should render canister availability dots', () => {
    const integrity = makeIntegrity({
      canisterAvailability: {
        transaction_manager: true,
        document_storage: false,
      },
    });

    render(<IntegrityPanel integrity={integrity} />);

    expect(screen.getByText('transaction manager')).toBeInTheDocument();
    expect(screen.getByText('document storage')).toBeInTheDocument();
  });
});
