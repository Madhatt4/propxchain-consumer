// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { single, update, updateEq, org } = vi.hoisted(() => ({
  single: vi.fn(),
  update: vi.fn(),
  updateEq: vi.fn(),
  org: { organisationId: 'org-1' as string | null },
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ single }) }),
      update: (patch: unknown) => {
        update(patch);
        return { eq: updateEq };
      },
    }),
  },
}));
vi.mock('@/hooks/useEstateAgentOrg', () => ({
  useEstateAgentOrg: () => ({ organisationId: org.organisationId, organisationName: 'Acme', isLoading: false, isError: false }),
}));

import { RedressPendingBanner } from '../RedressPendingBanner';

function renderBanner(): void {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><RedressPendingBanner /></QueryClientProvider>);
}

describe('<RedressPendingBanner>', () => {
  beforeEach(() => {
    single.mockReset();
    update.mockReset();
    updateEq.mockReset();
    org.organisationId = 'org-1';
  });

  it('should render nothing when the agency already has a membership number', async () => {
    single.mockResolvedValue({ data: { redress_scheme: 'TPO', redress_number: 'T0123' }, error: null });
    renderBanner();
    await waitFor(() => expect(single).toHaveBeenCalled());
    expect(screen.queryByTestId('redress-pending-banner')).not.toBeInTheDocument();
  });

  it('should render nothing when the user has no agent organisation', () => {
    org.organisationId = null;
    renderBanner();
    expect(single).not.toHaveBeenCalled();
    expect(screen.queryByTestId('redress-pending-banner')).not.toBeInTheDocument();
  });

  it('should name the scheme and ask for the number when it is pending', async () => {
    single.mockResolvedValue({ data: { redress_scheme: 'PRS', redress_number: null }, error: null });
    renderBanner();
    expect(await screen.findByTestId('redress-pending-banner')).toBeInTheDocument();
    expect(screen.getByText(/Property Redress Scheme membership number/)).toBeInTheDocument();
  });

  it('should refuse an empty number without saving', async () => {
    single.mockResolvedValue({ data: { redress_scheme: 'PRS', redress_number: null }, error: null });
    renderBanner();
    fireEvent.click(await screen.findByRole('button', { name: /save number/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/enter your membership number/i);
    expect(update).not.toHaveBeenCalled();
  });

  it('should save the trimmed number and hide once it is on file', async () => {
    single
      .mockResolvedValueOnce({ data: { redress_scheme: 'PRS', redress_number: null }, error: null })
      .mockResolvedValue({ data: { redress_scheme: 'PRS', redress_number: 'PRS777' }, error: null });
    updateEq.mockResolvedValue({ error: null });
    renderBanner();
    fireEvent.change(await screen.findByLabelText(/membership number/i), { target: { value: '  PRS777 ' } });
    fireEvent.click(screen.getByRole('button', { name: /save number/i }));

    await waitFor(() => expect(update).toHaveBeenCalledWith({ redress_number: 'PRS777' }));
    expect(updateEq).toHaveBeenCalledWith('id', 'org-1');
    await waitFor(() => expect(screen.queryByTestId('redress-pending-banner')).not.toBeInTheDocument());
  });

  it('should show an error and keep the banner when the save fails', async () => {
    single.mockResolvedValue({ data: { redress_scheme: 'TPO', redress_number: null }, error: null });
    updateEq.mockResolvedValue({ error: { message: 'denied' } });
    renderBanner();
    fireEvent.change(await screen.findByLabelText(/membership number/i), { target: { value: 'T1' } });
    fireEvent.click(screen.getByRole('button', { name: /save number/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn't save/i);
    expect(screen.getByTestId('redress-pending-banner')).toBeInTheDocument();
  });
});
