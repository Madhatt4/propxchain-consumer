import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PlotDetailPage from '../PlotDetailPage';
import { plotSteps, plotCompletionPercent, daysToCompletion } from '../plotProgress';
import type { Plot } from '@/services/plots.service';

const basePlot: Plot = {
  id: 'p1',
  site_id: 's1',
  plot_type_id: 't1',
  plot_number: '7',
  sale_price_pence: 48_500_000,
  description_addendum: null,
  plot_specific_image_refs: [],
  features_addendum: ['South-facing garden'],
  expected_practical_completion: null,
  listing_status: 'published',
  listing_slug: null,
  listing_first_published_at: null,
  reservation_status: 'reserved',
  reserved_by_buyer_user_id: 'b1',
  reserved_at: '2026-09-01T00:00:00Z',
  transaction_id: 'tx-123',
  current_build_status: 'structure',
  current_legal_status: 'enquiries_raised',
  at_risk_flag: false,
  at_risk_reason: null,
  invite_code: null,
  last_error: null,
  email_failed: false,
  created_at: '2026-08-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
};

vi.mock('@/services/plots.service', () => ({
  plotsService: { getById: vi.fn(), update: vi.fn() },
}));
vi.mock('@/services/plot-types.service', () => ({
  plotTypesService: { getById: vi.fn().mockResolvedValue({ id: 't1', name: 'The Ashby', features: ['4 bed'] }) },
}));
vi.mock('@/services/sites.service', () => ({
  sitesService: { getById: vi.fn().mockResolvedValue({ id: 's1', name: 'Meadow View', postcode: 'SG18 0AA' }) },
}));
vi.mock('@/components/common/NextStepCard', () => ({
  default: ({ txId }: { txId: string }) => <div>next step for {txId}</div>,
}));
vi.mock('@/components/dashboard/TransactionProgressTimeline', () => ({
  default: ({ completionPercentage }: { completionPercentage: number }) => <div>timeline {completionPercentage}%</div>,
}));

import { plotsService } from '@/services/plots.service';

function renderPage(): void {
  render(
    <MemoryRouter initialEntries={['/builder/sites/s1/plots/p1']}>
      <Routes>
        <Route path="/builder/sites/:siteId/plots/:plotId" element={<PlotDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PlotDetailPage', () => {
  beforeEach(() => {
    vi.mocked(plotsService.getById).mockResolvedValue(basePlot);
  });

  it('should show the plot header with price, type, site and both status pills', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Plot 7')).toBeInTheDocument());
    expect(screen.getByText(/£485,000 • The Ashby • Meadow View/)).toBeInTheDocument();
    expect(screen.getAllByText('Reserved').length).toBeGreaterThan(0);
    expect(screen.getByText('published')).toBeInTheDocument();
  });

  it('should link to the transaction flow and render the next-step card when a transaction exists', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('next step for tx-123')).toBeInTheDocument());
    expect(screen.getByRole('link', { name: /Open transaction/ })).toHaveAttribute('href', '/transaction/tx-123/flow');
  });

  it('should show an error message when the plot cannot be loaded', async () => {
    vi.mocked(plotsService.getById).mockRejectedValueOnce(new Error('boom'));
    renderPage();
    await waitFor(() => expect(screen.getByText(/Could not load this plot/)).toBeInTheDocument());
  });
});

describe('plotProgress', () => {
  it('should mark Listed and Reserved complete and Enquiries active for an enquiries plot', () => {
    const steps = plotSteps(basePlot);
    expect(steps.map((s) => s.status)).toEqual([
      'completed', 'completed', 'completed', 'active', 'pending', 'pending', 'pending',
    ]);
    expect(plotCompletionPercent(basePlot)).toBe(50);
  });

  it('should return 100 percent and every step complete when legal status is completed', () => {
    const done = { ...basePlot, current_legal_status: 'completed' };
    expect(plotCompletionPercent(done)).toBe(100);
    expect(plotSteps(done).every((s) => s.status === 'completed')).toBe(true);
  });

  it('should leave every step pending for an unpublished, unreserved plot', () => {
    const draft = { ...basePlot, listing_status: 'draft', reservation_status: 'available', current_legal_status: null };
    expect(plotSteps(draft).every((s) => s.status === 'pending')).toBe(true);
    expect(plotCompletionPercent(draft)).toBe(0);
  });

  it('should count whole days to practical completion and floor at zero', () => {
    const now = new Date('2026-09-21T00:00:00Z');
    expect(daysToCompletion({ ...basePlot, expected_practical_completion: '2026-10-01T00:00:00Z' }, now)).toBe(10);
    expect(daysToCompletion({ ...basePlot, expected_practical_completion: '2026-09-01T00:00:00Z' }, now)).toBe(0);
    expect(daysToCompletion(basePlot, now)).toBe(0);
  });
});
