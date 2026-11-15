// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The Sales pack's inline "About your property" form saves through the
 * listing save path, warns like Stage 1 when the chain write fails, and
 * re-runs readiness so the tick comes from saved data.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { MaterialInfoInlineForm } from '../MaterialInfoInlineForm';
import type { MaterialInfoGap } from '@/services/materialInfo';

vi.mock('@/services/materialInfoSave', () => ({
  saveMaterialInfoPatch: vi.fn().mockResolvedValue({ saved: true, chainOk: true }),
}));
import { saveMaterialInfoPatch } from '@/services/materialInfoSave';

const toastSpy = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: toastSpy }) }));

function renderForm(missing: MaterialInfoGap[]): QueryClient {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MaterialInfoInlineForm transactionId="tx-1" missing={missing} />
    </QueryClientProvider>,
  );
  return client;
}

beforeEach(() => {
  vi.mocked(saveMaterialInfoPatch).mockClear();
  toastSpy.mockClear();
});

describe('MaterialInfoInlineForm', () => {
  it('should show only the fields it was told are missing', () => {
    renderForm(['councilTaxBand', 'propertyType']);
    expect(screen.getByLabelText('Council tax band')).toBeInTheDocument();
    expect(screen.getByLabelText('Property type')).toBeInTheDocument();
    expect(screen.queryByLabelText('Tenure')).toBeNull();
  });

  it('should save through the listing save path and re-run readiness', async () => {
    const client = renderForm(['councilTaxBand']);
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Council tax band'), { target: { value: 'D' } });
    fireEvent.click(save);
    await waitFor(() => expect(saveMaterialInfoPatch).toHaveBeenCalledWith('tx-1', { councilTaxBand: 'D' }));
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['salesPack', 'readiness', 'tx-1'] }));
    expect(toastSpy).not.toHaveBeenCalled();
  });

  it('should warn when the save reached this device but not the chain', async () => {
    vi.mocked(saveMaterialInfoPatch).mockResolvedValueOnce({ saved: true, chainOk: false, error: 'offline' });
    renderForm(['councilTaxBand']);
    fireEvent.change(screen.getByLabelText('Council tax band'), { target: { value: 'B' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(toastSpy).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Saved on this device — blockchain sync failed',
      variant: 'destructive',
    })));
  });

  it('should tell the seller nothing was saved when there is no listing to merge into', async () => {
    vi.mocked(saveMaterialInfoPatch).mockResolvedValueOnce({ saved: false, chainOk: false });
    renderForm(['councilTaxBand']);
    fireEvent.change(screen.getByLabelText('Council tax band'), { target: { value: 'B' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(toastSpy).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Not saved',
      variant: 'destructive',
    })));
  });

  it('should tell the seller nothing was saved when the save throws', async () => {
    vi.mocked(saveMaterialInfoPatch).mockRejectedValueOnce(new Error('boom'));
    renderForm(['councilTaxBand']);
    fireEvent.change(screen.getByLabelText('Council tax band'), { target: { value: 'B' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(toastSpy).toHaveBeenCalledWith(expect.objectContaining({ title: 'Not saved' })));
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  it('should ask for the lease trio once the seller picks leasehold', async () => {
    renderForm(['tenure']);
    expect(screen.queryByLabelText('Years left on the lease')).toBeNull();
    fireEvent.change(screen.getByLabelText('Tenure'), { target: { value: 'leasehold' } });
    fireEvent.change(screen.getByLabelText('Years left on the lease'), { target: { value: '95' } });
    fireEvent.change(screen.getByLabelText('Ground rent (£ a year)'), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText('Service charge (£ a year)'), { target: { value: '1200' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(saveMaterialInfoPatch).toHaveBeenCalledWith('tx-1', {
      tenure: 'leasehold', leaseYearsRemaining: 95, groundRentPerYear: 0, serviceChargePerYear: 1200,
    }));
  });

  it('should keep Save disabled for a lease of zero years', () => {
    renderForm(['leaseYearsRemaining']);
    fireEvent.change(screen.getByLabelText('Years left on the lease'), { target: { value: '0' } });
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });
});
