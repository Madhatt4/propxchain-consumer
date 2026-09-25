// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const { signUp, lookupCompany } = vi.hoisted(() => ({ signUp: vi.fn(), lookupCompany: vi.fn() }));
vi.mock('../../../services/supabase.auth.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../services/supabase.auth.service')>();
  return { ...actual, supabaseAuthService: { ...actual.supabaseAuthService, signUp } };
});
// Mirrors the real UK company number pattern (8 digits, or 2-letter prefix +
// 6 digits) so validation tests below exercise the same normalise/invalid
// branches the real companies-house.service does.
const UK_COMPANY_NUMBER_RE = /^([0-9]{8}|[A-Z]{2}[0-9]{6})$/;
vi.mock('../../../services/companies-house.service', () => ({
  lookupCompany,
  normalizeCompanyNumber: (s: string) => {
    const cleaned = s.trim().toUpperCase();
    return UK_COMPANY_NUMBER_RE.test(cleaned) ? cleaned : null;
  },
}));

import RegisterEstateAgentPage from '../RegisterEstateAgentPage';
import { PENDING_ESTATE_AGENT_ORG_KEY } from '../../../services/supabase.auth.service';

/** Fills in step 1's required fields (agency, branch, redress scheme, membership number). */
function fillRequiredBusinessFields(): void {
  fireEvent.change(screen.getByLabelText(/agency name/i), { target: { value: 'Acme Homes' } });
  fireEvent.change(screen.getByLabelText(/branch/i), { target: { value: 'Sandy' } });
  fireEvent.change(screen.getByLabelText(/redress scheme/i), { target: { value: 'PRS' } });
  fireEvent.change(screen.getByLabelText(/membership number/i), { target: { value: 'PRS001' } });
}

const renderPage = () => render(<MemoryRouter><RegisterEstateAgentPage /></MemoryRouter>);

describe('<RegisterEstateAgentPage>', () => {
  beforeEach(() => {
    signUp.mockReset();
    lookupCompany.mockReset();
    lookupCompany.mockResolvedValue(null);
  });

  it('blocks step 1 until agency, branch, redress scheme and number are filled', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(screen.getByText(/agency name is required/i)).toBeInTheDocument();
  });

  it('submits signUp with role=agent and the pending org payload', async () => {
    signUp.mockResolvedValue({ error: null });
    renderPage();
    fillRequiredBusinessFields();
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    fireEvent.change(screen.getByLabelText(/^email/i), { target: { value: 'a@b.co' } });
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'longenough1' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'longenough1' } });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => expect(signUp).toHaveBeenCalled());
    const [, , meta] = signUp.mock.calls[0];
    expect(meta.role).toBe('agent');
    expect(meta[PENDING_ESTATE_AGENT_ORG_KEY]).toMatchObject({
      name: 'Acme Homes', branch: 'Sandy', redress_scheme: 'PRS', redress_number: 'PRS001',
      companies_house_number: null,
    });
    expect(await screen.findByText(/check your email/i)).toBeInTheDocument();
  });

  it('blocks continue and shows an error when the Companies House number is dissolved', async () => {
    lookupCompany.mockResolvedValue({
      companyNumber: '12345678',
      name: 'Old Estates Ltd',
      status: 'dissolved',
      incorporatedOn: '2001-01-01',
      address: {},
      isActive: false,
    });
    renderPage();
    fillRequiredBusinessFields();
    fireEvent.change(screen.getByLabelText(/companies house number/i), { target: { value: '12345678' } });

    // Debounced lookup fires on a real 250ms timer — wait for the dissolved
    // status card to render before asserting Continue is blocked.
    await waitFor(() => expect(screen.getAllByText(/dissolved/i).length).toBeGreaterThan(0), { timeout: 2000 });

    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(
      screen.getByText(/this company is dissolved on companies house/i),
    ).toBeInTheDocument();
    expect(signUp).not.toHaveBeenCalled();
  });

  it('blocks continue and shows an error for a non-empty invalid Companies House number', () => {
    renderPage();
    fillRequiredBusinessFields();
    fireEvent.change(screen.getByLabelText(/companies house number/i), { target: { value: 'not-a-number' } });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(
      screen.getByText(/doesn't look like a valid companies house number/i),
    ).toBeInTheDocument();
    expect(signUp).not.toHaveBeenCalled();
  });

  it('sends the normalised Companies House number in the signup payload', async () => {
    signUp.mockResolvedValue({ error: null });
    renderPage();
    fillRequiredBusinessFields();
    fireEvent.change(screen.getByLabelText(/companies house number/i), { target: { value: '  sc123456  ' } });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    fireEvent.change(screen.getByLabelText(/^email/i), { target: { value: 'a@b.co' } });
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'longenough1' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'longenough1' } });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => expect(signUp).toHaveBeenCalled());
    const [, , meta] = signUp.mock.calls[0];
    expect(meta[PENDING_ESTATE_AGENT_ORG_KEY]).toMatchObject({
      companies_house_number: 'SC123456',
    });
  });
});
