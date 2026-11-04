// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { ThemeProvider } from '@/contexts/ThemeContext';

import PropertyCheckPage from '../PropertyCheckPage';
import { PROPERTY_CHECK_FAQS, PROPERTY_CHECK_HERO } from '../marketing/propertyCheckData';

const mockAddToWaitlist = vi.fn();

vi.mock('@/services/waitlist', async () => {
  const actual = await vi.importActual<typeof import('@/services/waitlist')>('@/services/waitlist');
  return { ...actual, addToWaitlist: (...args: unknown[]) => mockAddToWaitlist(...args) };
});

vi.mock('@/components/transaction/PropertyIntelligenceCard', () => ({
  PropertyIntelligenceCard: ({ postcode, addressLine }: { postcode: string; addressLine?: string }) => (
    <div data-testid="report" data-postcode={postcode} data-address={addressLine} />
  ),
}));

function renderPage(): void {
  render(
    <MemoryRouter>
      <ThemeProvider>
        <PropertyCheckPage />
      </ThemeProvider>
    </MemoryRouter>,
  );
}

function renderPageWithState(state: unknown): void {
  render(
    <MemoryRouter initialEntries={[{ pathname: '/property-check', state }]}>
      <ThemeProvider>
        <PropertyCheckPage />
      </ThemeProvider>
    </MemoryRouter>,
  );
}

function checkAddress(houseNumber: string, postcode: string): void {
  fireEvent.change(screen.getByLabelText('House name or number'), { target: { value: houseNumber } });
  fireEvent.change(screen.getByLabelText('Postcode'), { target: { value: postcode } });
  fireEvent.click(screen.getByRole('button', { name: 'Check this property' }));
}

describe('PropertyCheckPage', () => {
  beforeAll(() => {
    // jsdom has no scrollIntoView; the page scrolls to the report on reveal.
    Element.prototype.scrollIntoView = vi.fn();
  });

  beforeEach(() => {
    mockAddToWaitlist.mockReset();
  });

  it('should render the shared hero copy and every FAQ from the data module', () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: PROPERTY_CHECK_HERO.h1 })).toBeInTheDocument();
    for (const faq of PROPERTY_CHECK_FAQS) {
      expect(screen.getByRole('heading', { name: faq.q })).toBeInTheDocument();
    }
    expect(screen.queryByTestId('report')).not.toBeInTheDocument();
  });

  it('should run the report straight away for an address handed over by the homepage hero', () => {
    renderPageWithState({ address: { houseNumber: '14a', postcode: 'SG19 1AB' } });

    const report = screen.getByTestId('report');
    expect(report).toHaveAttribute('data-postcode', 'SG19 1AB');
    expect(report).toHaveAttribute('data-address', '14a');
  });

  it('should ignore a malformed hand-over and wait for an address', () => {
    renderPageWithState({ address: { houseNumber: '', postcode: 42 } });

    expect(screen.queryByTestId('report')).not.toBeInTheDocument();
  });

  it('should ask for the house number when it is missing', () => {
    renderPage();

    checkAddress('', 'SG19 1AB');

    expect(screen.getByRole('alert').textContent).toContain('house name or number');
    expect(screen.queryByTestId('report')).not.toBeInTheDocument();
  });

  it('should reject a partial postcode without showing a report', () => {
    renderPage();

    checkAddress('14a', 'SG19');

    expect(screen.getByRole('alert').textContent).toContain('full UK postcode');
    expect(screen.queryByTestId('report')).not.toBeInTheDocument();
  });

  it('should show the report straight away without asking for an email', () => {
    renderPage();

    checkAddress(' 14a ', 'sg19 1ab');

    const report = screen.getByTestId('report');
    expect(report).toHaveAttribute('data-postcode', 'SG19 1AB');
    expect(report).toHaveAttribute('data-address', '14a');
    expect(mockAddToWaitlist).not.toHaveBeenCalled();
  });

  it('should not call the waitlist when the optional email is invalid', () => {
    renderPage();
    checkAddress('14a', 'SG19 1AB');

    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'not-an-email' } });
    fireEvent.click(screen.getByRole('button', { name: 'Join the launch list' }));

    expect(screen.getByRole('alert').textContent).toContain('valid email');
    expect(mockAddToWaitlist).not.toHaveBeenCalled();
  });

  it('should join the launch list with the checked address when an email is given', async () => {
    mockAddToWaitlist.mockResolvedValue({ ok: true, duplicate: false });
    renderPage();
    checkAddress('14a', 'SG19 1AB');

    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'ann@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Join the launch list' }));

    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('launch list'));
    expect(mockAddToWaitlist).toHaveBeenCalledWith({
      name: null,
      email: 'ann@example.com',
      role: null,
      postcode: 'SG19 1AB',
      houseNumber: '14a',
      source: 'home_mover_report',
    });
  });

  it('should keep the report on screen and offer a retry when the waitlist call fails', async () => {
    mockAddToWaitlist.mockResolvedValue({ ok: false, duplicate: false, error: 'HTTP 500' });
    renderPage();
    checkAddress('14a', 'SG19 1AB');

    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'ann@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Join the launch list' }));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Something went wrong'));
    expect(screen.getByTestId('report')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Join the launch list' })).toBeEnabled();
  });
});
