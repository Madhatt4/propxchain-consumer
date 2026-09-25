// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { CompaniesHouseCompany } from '../../services/companies-house.service';

const { lookupMock, signUpMock } = vi.hoisted(() => ({
  lookupMock: vi.fn(),
  signUpMock: vi.fn(),
}));

vi.mock('../../services/companies-house.service', async () => {
  const actual = await vi.importActual<typeof import('../../services/companies-house.service')>(
    '../../services/companies-house.service',
  );
  return {
    ...actual,
    lookupCompany: lookupMock,
  };
});

vi.mock('../../services/supabase.auth.service', () => ({
  supabaseAuthService: {
    signUp: signUpMock,
  },
}));

import RegisterDeveloperPage from './RegisterDeveloperPage';

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/register/developer']}>
      <Routes>
        <Route path="/register/developer" element={<RegisterDeveloperPage />} />
        <Route path="/login" element={<div data-testid="at-login" />} />
      </Routes>
    </MemoryRouter>,
  );

const activeCompany: CompaniesHouseCompany = {
  companyNumber: '12345678',
  name: 'Sandy Meadows Developments Ltd',
  status: 'active',
  incorporatedOn: '2018-03-12',
  address: { line1: '1 High Street', locality: 'Sandy', postalCode: 'SG19 1AB' },
  isActive: true,
};

const dissolvedCompany: CompaniesHouseCompany = {
  ...activeCompany,
  status: 'dissolved',
  isActive: false,
};

const fillBusinessStep = async (companyNumber: string): Promise<void> => {
  const input = screen.getByPlaceholderText(/12345678/i);
  fireEvent.change(input, { target: { value: companyNumber } });
  // wait for debounced lookup to settle
  await waitFor(() => {
    // either the autofill panel renders, or the "couldn't find" message renders
    expect(lookupMock).toHaveBeenCalled();
  });
};

const advanceToAccountStep = async (): Promise<void> => {
  fireEvent.click(screen.getByRole('button', { name: /continue/i }));
  await waitFor(() => {
    expect(screen.getByText(/Create your account/i)).toBeInTheDocument();
  });
};

describe('<RegisterDeveloperPage>', () => {
  beforeEach(() => {
    lookupMock.mockReset();
    signUpMock.mockReset();
  });

  it('1. happy path: CH autofill displays company name then signup succeeds', async () => {
    lookupMock.mockResolvedValueOnce(activeCompany);
    signUpMock.mockResolvedValueOnce({ user: { id: 'u1' }, identity: null, error: null });

    renderPage();
    await fillBusinessStep('12345678');
    await waitFor(() => {
      expect(screen.getByText('Sandy Meadows Developments Ltd')).toBeInTheDocument();
    });
    await advanceToAccountStep();

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'marc@propxchain.com' },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: 'verysecure1' },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: 'verysecure1' },
    });

    fireEvent.submit(
      screen.getByRole('button', { name: /create your developer account/i }),
    );

    await waitFor(() => {
      expect(screen.getByText(/Check your email/i)).toBeInTheDocument();
    });
    expect(signUpMock).toHaveBeenCalledTimes(1);
    const [emailArg, passwordArg, metadataArg] = signUpMock.mock.calls[0];
    expect(emailArg).toBe('marc@propxchain.com');
    expect(passwordArg).toBe('verysecure1');
    expect(metadataArg.role).toBe('developer');
    expect(metadataArg.propxchain_pending_developer_org).toMatchObject({
      companies_house_number: '12345678',
      companies_house_verified: true,
    });
    expect(metadataArg.propxchain_pending_developer_org_expires_at).toBeTruthy();
  });

  it('2. CH not found: allows continue with unverified flag', async () => {
    lookupMock.mockResolvedValueOnce(null);
    signUpMock.mockResolvedValueOnce({ user: { id: 'u1' }, identity: null, error: null });

    renderPage();
    await fillBusinessStep('99999999');
    await waitFor(() => {
      expect(
        screen.getByText(/couldn't find this company/i),
      ).toBeInTheDocument();
    });

    await advanceToAccountStep();
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'marc@test.com' },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'pwpwpwpw1' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: 'pwpwpwpw1' },
    });
    fireEvent.submit(screen.getByRole('button', { name: /create your developer account/i }));

    await waitFor(() => {
      expect(signUpMock).toHaveBeenCalled();
    });
    const [, , metadataArg] = signUpMock.mock.calls[0];
    expect(metadataArg.propxchain_pending_developer_org.companies_house_verified).toBe(false);
    expect(metadataArg.propxchain_pending_developer_org.companies_house_data).toBeNull();
  });

  it('3. CH dissolved: shows error, blocks continue, exposes contact link', async () => {
    lookupMock.mockResolvedValueOnce(dissolvedCompany);

    renderPage();
    await fillBusinessStep('12345678');
    // Wait for the autofill panel to render the dissolved status, then for the
    // dissolved warning to appear.
    await waitFor(
      () => {
        expect(screen.getByText('dissolved')).toBeInTheDocument();
      },
      { timeout: 2000 },
    );
    expect(screen.getByRole('link', { name: /Contact support/i })).toBeInTheDocument();

    const continueBtn = screen.getByRole('button', { name: /continue/i });
    expect(continueBtn).toBeDisabled();
  });

  it('4. invalid CH format: no API call made, continue disabled', async () => {
    renderPage();
    fireEvent.change(screen.getByPlaceholderText(/12345678/i), {
      target: { value: 'ABC' },
    });
    // Wait briefly to ensure no debounce fires
    await new Promise((r) => setTimeout(r, 350));
    expect(lookupMock).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();
  });

  it('5. password mismatch: shows error, does not call signUp', async () => {
    lookupMock.mockResolvedValueOnce(activeCompany);
    renderPage();
    await fillBusinessStep('12345678');
    await waitFor(() => expect(screen.getByText(activeCompany.name)).toBeInTheDocument());
    await advanceToAccountStep();

    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'password1' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: 'password2' },
    });
    fireEvent.submit(screen.getByRole('button', { name: /create your developer account/i }));

    await waitFor(() => {
      expect(screen.getByText(/Passwords do not match/i)).toBeInTheDocument();
    });
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it('6. password too short: shows error, does not call signUp', async () => {
    lookupMock.mockResolvedValueOnce(activeCompany);
    renderPage();
    await fillBusinessStep('12345678');
    await waitFor(() => expect(screen.getByText(activeCompany.name)).toBeInTheDocument());
    await advanceToAccountStep();

    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'short' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'short' } });
    fireEvent.submit(screen.getByRole('button', { name: /create your developer account/i }));

    await waitFor(() => {
      expect(screen.getByText(/Choose a longer password/i)).toBeInTheDocument();
    });
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it('7. signUp returns an error: surfaces it inline, stays on account step', async () => {
    lookupMock.mockResolvedValueOnce(activeCompany);
    signUpMock.mockResolvedValueOnce({
      user: null,
      identity: null,
      error: { message: 'Email already in use' },
    });

    renderPage();
    await fillBusinessStep('12345678');
    await waitFor(() => expect(screen.getByText(activeCompany.name)).toBeInTheDocument());
    await advanceToAccountStep();

    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'password1' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: 'password1' },
    });
    fireEvent.submit(screen.getByRole('button', { name: /create your developer account/i }));

    await waitFor(() => {
      expect(screen.getByText(/Email already in use/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/Check your email/i)).toBeNull();
  });

  it('9. duplicate email: surfaces the "account already exists" error from service', async () => {
    lookupMock.mockResolvedValueOnce(activeCompany);
    signUpMock.mockResolvedValueOnce({
      user: null,
      identity: null,
      error: {
        message:
          'An account with this email already exists. Try signing in, or use "Forgot password" to reset.',
      },
    });

    renderPage();
    await fillBusinessStep('12345678');
    await waitFor(() => expect(screen.getByText(activeCompany.name)).toBeInTheDocument());
    await advanceToAccountStep();

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'sales@propxchain.com' },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'password1' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: 'password1' },
    });
    fireEvent.submit(screen.getByRole('button', { name: /create your developer account/i }));

    await waitFor(() => {
      expect(screen.getByText(/account with this email already exists/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/Check your email/i)).toBeNull();
  });

  it('8. back button returns from account → business step', async () => {
    lookupMock.mockResolvedValueOnce(activeCompany);
    renderPage();
    await fillBusinessStep('12345678');
    await waitFor(() => expect(screen.getByText(activeCompany.name)).toBeInTheDocument());
    await advanceToAccountStep();

    fireEvent.click(screen.getByRole('button', { name: /^← Back$/i }));
    await waitFor(() => {
      expect(screen.getByText(/Tell us about your business/i)).toBeInTheDocument();
    });
  });
});
