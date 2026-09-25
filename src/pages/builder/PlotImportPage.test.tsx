// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlotImportPage } from './PlotImportPage';

vi.mock('@/services/plot-types.service', () => ({
  plotTypesService: {
    getBySite: vi.fn().mockResolvedValue([
      {
        id: 'pt-1',
        site_id: 'site-1',
        name: 'The Ashbourne',
        base_price_pence: 29500000,
        description: null,
        bedrooms: null,
        bathrooms: null,
        internal_area_sqft: null,
        epc_rating: null,
        floor_plan_image_refs: [],
        exterior_image_refs: [],
        interior_image_refs: [],
        features: [],
        created_at: '',
        updated_at: '',
      },
    ]),
  },
}));

vi.mock('@/services/plots.service', () => ({
  plotsService: {
    getBySite: vi.fn().mockResolvedValue([]),
    bulkCreate: vi
      .fn()
      .mockResolvedValue([
        { id: 'new-1', plot_number: '1' },
        { id: 'new-2', plot_number: '2' },
      ]),
  },
}));

vi.mock('@/services/sites.service', () => ({
  sitesService: {
    getById: vi.fn().mockResolvedValue({ id: 'site-1', slug: 'shawgrass' }),
  },
}));

vi.mock('@/services/listings.service', () => ({
  listingsService: {
    publishPlot: vi.fn().mockResolvedValue(undefined),
  },
}));

function renderPage(): void {
  render(
    <MemoryRouter initialEntries={['/builder/sites/site-1/plots/import']}>
      <Routes>
        <Route
          path="/builder/sites/:siteId/plots/import"
          element={<PlotImportPage />}
        />
        <Route
          path="/builder/sites/:siteId/plots"
          element={<div>Plots list</div>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

async function dropCsv(csv: string): Promise<void> {
  const dropzone = await screen.findByLabelText(/drop csv/i);
  const file = new File([csv], 'plots.csv', { type: 'text/csv' });
  fireEvent.drop(dropzone, { dataTransfer: { files: [file] } });
}

describe('PlotImportPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('imports two valid rows and shows the result panel', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByLabelText(/drop csv/i)).toBeInTheDocument();
    });

    await dropCsv(
      'plot_number,plot_type\n1,The Ashbourne\n2,The Ashbourne',
    );

    await waitFor(() => {
      expect(screen.getByText(/2 valid/, { selector: 'p' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /import 2 valid rows/i }));

    await waitFor(() => {
      expect(screen.getByText(/successfully imported 2 plot/i)).toBeInTheDocument();
    });
  });

  it('shows red rows for invalid entries and imports only valid ones', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByLabelText(/drop csv/i)).toBeInTheDocument());

    await dropCsv(
      'plot_number,plot_type\n1,The Ashbourne\n,The Ashbourne',
    );

    await waitFor(() => {
      expect(screen.getByText(/1 valid/, { selector: 'p' })).toBeInTheDocument();
      expect(screen.getByText(/1 with errors/, { selector: 'span' })).toBeInTheDocument();
    });
    expect(screen.getByText(/plot number is required/i)).toBeInTheDocument();
  });

  it('calls publishPlot for each inserted plot when the publish checkbox is on', async () => {
    const { listingsService } = await import('@/services/listings.service');
    renderPage();
    await waitFor(() => expect(screen.getByLabelText(/drop csv/i)).toBeInTheDocument());

    await dropCsv(
      'plot_number,plot_type\n1,The Ashbourne\n2,The Ashbourne',
    );
    await waitFor(() => expect(screen.getByText(/2 valid/, { selector: 'p' })).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText(/publish all imported plots immediately/i));
    fireEvent.click(screen.getByRole('button', { name: /import 2 valid rows/i }));

    await waitFor(() => {
      expect(listingsService.publishPlot).toHaveBeenCalledTimes(2);
      expect(screen.getByText(/2 plots published/i)).toBeInTheDocument();
    });
  });

  it('surfaces a parse error on the upload panel when CSV is missing headers', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByLabelText(/drop csv/i)).toBeInTheDocument());

    await dropCsv('no_header_at_all\n1');

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/plot_number/);
      expect(screen.getByLabelText(/drop csv/i)).toBeInTheDocument();
    });
  });
});
