// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The button, its loading state and what each failure tells the seller. A
 * failed retry must not wipe the advice already on screen.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockCheckForm = vi.fn();

vi.mock('@/services/formCheck.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/formCheck.service')>();
  return { ...actual, checkForm: (...args: unknown[]) => mockCheckForm(...args) };
});
vi.mock('@/utils/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

import { CheckMyAnswers } from '../../../components/propertyInfo/CheckMyAnswers';
import { FormCheckError, type FormCheckResult } from '../../../services/formCheck.service';

const RESULT: FormCheckResult = {
  form: 'ta6',
  readyToSubmit: 0.62,
  followUpScore: 1,
  worstSection: null,
  flags: [{ key: 'services_gap', label: 'The drainage answers would draw an enquiry.', probability: 0.64, severity: 'warn' }],
  deterministic: [],
  model: 'typesafe-system-one',
  checkedAt: '2026-09-19T10:00:00.000Z',
};

function renderControl(): void {
  render(
    <MemoryRouter>
      <CheckMyAnswers transactionId="tx_1" form="ta6" />
    </MemoryRouter>,
  );
}

describe('CheckMyAnswers', () => {
  beforeEach(() => {
    mockCheckForm.mockReset();
  });

  it('should show no panel until the seller asks for one', () => {
    renderControl();

    expect(screen.getByRole('button', { name: /Check my answers/ })).toBeInTheDocument();
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    expect(mockCheckForm).not.toHaveBeenCalled();
  });

  it('should run the check for its own form and render the panel', async () => {
    mockCheckForm.mockResolvedValue(RESULT);

    renderControl();
    fireEvent.click(screen.getByRole('button', { name: /Check my answers/ }));

    expect(await screen.findByText('Ready to submit: 62%')).toBeInTheDocument();
    expect(mockCheckForm).toHaveBeenCalledWith('tx_1', 'ta6');
  });

  it('should disable the button and say it is checking while the call is in flight', async () => {
    let release: (value: FormCheckResult) => void = () => {};
    mockCheckForm.mockReturnValue(new Promise<FormCheckResult>((resolve) => { release = resolve; }));

    renderControl();
    fireEvent.click(screen.getByRole('button', { name: /Check my answers/ }));

    const button = screen.getByRole('button', { name: /Checking/ });
    expect(button).toBeDisabled();

    release(RESULT);
    await waitFor(() => expect(screen.getByRole('button', { name: /Check again/ })).toBeEnabled());
  });

  it('should tell a buyer-side caller who the check is for rather than "something went wrong"', async () => {
    mockCheckForm.mockRejectedValue(new FormCheckError(403, 'forbidden'));

    renderControl();
    fireEvent.click(screen.getByRole('button', { name: /Check my answers/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Only the seller and their conveyancer/);
  });

  it('should say there is nothing saved to check on a 404', async () => {
    mockCheckForm.mockRejectedValue(new FormCheckError(404, 'form_not_found'));

    renderControl();
    fireEvent.click(screen.getByRole('button', { name: /Check my answers/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/no saved answers to check yet/);
  });

  it('should say how long to wait when the rate limit reports it', async () => {
    mockCheckForm.mockRejectedValue(new FormCheckError(429, 'rate_limited', 42));

    renderControl();
    fireEvent.click(screen.getByRole('button', { name: /Check my answers/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Try again in 42s/);
  });

  it('should fall back to a plain message for an unexpected failure', async () => {
    mockCheckForm.mockRejectedValue(new Error('boom'));

    renderControl();
    fireEvent.click(screen.getByRole('button', { name: /Check my answers/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Could not run the check/);
  });

  it('should keep the previous result on screen when a retry fails', async () => {
    mockCheckForm.mockResolvedValueOnce(RESULT).mockRejectedValueOnce(new FormCheckError(429, 'rate_limited'));

    renderControl();
    fireEvent.click(screen.getByRole('button', { name: /Check my answers/ }));
    expect(await screen.findByText('Ready to submit: 62%')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Check again/ }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Ready to submit: 62%')).toBeInTheDocument();
  });
});
