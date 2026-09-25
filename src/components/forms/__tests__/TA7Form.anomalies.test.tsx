import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import TA7Form from '../TA7Form';
import { emptyTA7Form } from '../../../types/ta7.types';

vi.mock('../FormExportButton', () => ({
  FormExportButton: () => <div data-testid="form-export-stub" />,
}));

function futureDate(yearsFromNow: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + yearsFromNow);
  return d.toISOString().slice(0, 10);
}

describe('TA7Form anomaly rendering', () => {
  it('renders a critical AnomalyFlag when remaining lease is under 80 years', () => {
    const ta7 = {
      ...emptyTA7Form,
      leaseTermYears: 99,
      leaseStartDate: '1970-01-01',
      leaseExpiryDate: futureDate(50),
    };
    render(
      <TA7Form
        transactionId="tx-1"
        initialData={ta7}
        onSave={async () => {}}
        isLeasehold={true}
        intelOverride={null}
      />,
    );
    expect(screen.getByTestId('anomaly-flag-critical')).toBeInTheDocument();
    expect(
      screen.getByText(/below the 80-year mortgage threshold/),
    ).toBeInTheDocument();
  });

  it('renders a warning AnomalyFlag when ground rent exceeds £250', () => {
    const ta7 = {
      ...emptyTA7Form,
      leaseTermYears: 125,
      leaseStartDate: '2020-01-01',
      leaseExpiryDate: futureDate(120),
      groundRentAmount: 500,
      groundRentPaymentFrequency: 'annual' as const,
    };
    render(
      <TA7Form
        transactionId="tx-1"
        initialData={ta7}
        onSave={async () => {}}
        isLeasehold={true}
        intelOverride={null}
      />,
    );
    expect(screen.getByTestId('anomaly-flag-warning')).toBeInTheDocument();
    expect(screen.getByText(/may be classed as "onerous"/)).toBeInTheDocument();
  });
});
