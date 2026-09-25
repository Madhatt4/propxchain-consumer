import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import { FreeReportSection } from '../FreeReportSection';

const mockAddToWaitlist = vi.fn();

vi.mock('@/services/waitlist', async () => {
  const actual = await vi.importActual<typeof import('@/services/waitlist')>('@/services/waitlist');
  return {
    ...actual,
    addToWaitlist: (...args: unknown[]) => mockAddToWaitlist(...args),
  };
});

vi.mock('@/components/transaction/PropertyIntelligenceCard', () => ({
  PropertyIntelligenceCard: ({ postcode, addressLine }: { postcode: string; addressLine?: string }) => (
    <div data-testid="report" data-postcode={postcode} data-address={addressLine} />
  ),
}));

function fillValidForm(): void {
  fireEvent.click(screen.getByRole('button', { name: 'Selling' }));
  fireEvent.click(screen.getByRole('button', { name: '1 to 3 months' }));
  fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Marc Hatton' } });
  fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'marc@example.com' } });
  fireEvent.change(screen.getByLabelText('House name or number'), { target: { value: '14a' } });
  fireEvent.change(screen.getByLabelText('Postcode'), { target: { value: 'sg19 1ab' } });
}

function submit(): void {
  fireEvent.click(screen.getByRole('button', { name: 'Get my free report' }));
}

describe('FreeReportSection', () => {
  beforeAll(() => {
    // jsdom has no scrollIntoView; the section calls it on report reveal.
    Element.prototype.scrollIntoView = vi.fn();
  });

  beforeEach(() => {
    mockAddToWaitlist.mockReset();
  });

  it('should ask for a role first when the form is submitted empty', () => {
    render(<FreeReportSection />);

    submit();

    expect(screen.getByRole('status').textContent).toContain('who you are');
    expect(mockAddToWaitlist).not.toHaveBeenCalled();
  });

  it('should reject an invalid postcode before calling the worker', () => {
    render(<FreeReportSection />);
    fillValidForm();
    fireEvent.change(screen.getByLabelText('Postcode'), { target: { value: 'SG19' } });

    submit();

    expect(screen.getByRole('status').textContent).toContain('full UK postcode');
    expect(mockAddToWaitlist).not.toHaveBeenCalled();
  });

  it('should submit the mapped payload and reveal the report on success', async () => {
    mockAddToWaitlist.mockResolvedValue({ ok: true, duplicate: false });
    render(<FreeReportSection />);
    fillValidForm();

    submit();

    await waitFor(() => expect(screen.getByTestId('report')).toBeInTheDocument());
    expect(mockAddToWaitlist).toHaveBeenCalledWith({
      name: 'Marc Hatton',
      email: 'marc@example.com',
      role: 'seller',
      postcode: 'SG19 1AB',
      houseNumber: '14a',
      timeline: '1_3_months',
      source: 'home_mover_report',
    });
    expect(screen.getByTestId('report').dataset.postcode).toBe('SG19 1AB');
    expect(screen.getByTestId('report').dataset.address).toBe('14a');
    expect(screen.getByRole('status').textContent).toContain('launch list');
  });

  it('should still reveal the report when the email is already on the list', async () => {
    mockAddToWaitlist.mockResolvedValue({ ok: true, duplicate: true });
    render(<FreeReportSection />);
    fillValidForm();

    submit();

    await waitFor(() => expect(screen.getByTestId('report')).toBeInTheDocument());
    expect(screen.getByRole('status').textContent).toContain('Welcome back');
  });

  it('should show an error and no report when the worker call fails', async () => {
    mockAddToWaitlist.mockResolvedValue({ ok: false, duplicate: false, error: 'HTTP 500' });
    render(<FreeReportSection />);
    fillValidForm();

    submit();

    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('went wrong'));
    expect(screen.queryByTestId('report')).not.toBeInTheDocument();
  });
});
