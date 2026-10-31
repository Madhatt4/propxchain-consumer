import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import QuoteFormPage from '../QuoteFormPage';

const ESTIMATE_VIEW = {
  practiceName: 'Example Conveyancers',
  propertyAddress: '1 Example Road',
  titleNumber: 'EX1234',
  tenure: 'freehold',
  transactionType: 'purchase',
  scope: {
    items: [
      {
        key: 'flood_insurability_enquiry',
        category: 'enquiry',
        title: 'Flood risk: confirm insurability',
        detail: 'Confirm buildings insurance is available.',
        trigger: 'Low',
        provenance: 'Environmental report',
        confidence: 'high',
      },
    ],
    notAvailable: [],
    derivedAt: '2026-10-31T10:00:00.000Z',
    schemaVersion: 1,
    searchSummary: {
      sections: [{ provider: 'OneSearch', explainer: 'A planning notice is recorded.', flags: [] }],
      truncated: false,
    },
  },
};

describe('QuoteFormPage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(ESTIMATE_VIEW))));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should show a firm the search summary and hide canned enquiries', async () => {
    render(
      <MemoryRouter initialEntries={['/quote/token-1']}>
        <Routes>
          <Route path="/quote/:token" element={<QuoteFormPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Search results summary (automated)')).toBeInTheDocument();
    expect(screen.getByText('A planning notice is recorded.')).toBeInTheDocument();
    expect(screen.queryByText('Flood risk: confirm insurability')).not.toBeInTheDocument();
  });
});
