import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Logbook } from '../../types/logbook.types';

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// Top bar pulls in stores/theme context; stub it to keep this test on the page.
vi.mock('@/components/navigation/AppTopBar', () => ({ default: () => <nav /> }));

const getMyLogbooks = vi.fn();
vi.mock('../../services/logbook.service', () => ({
  getMyLogbooks: (...a: unknown[]) => getMyLogbooks(...a),
}));

import MyLogbooksPage from '../MyLogbooksPage';

// Midday UTC, nanoseconds — timezone-stable en-GB date of 14 Aug 2026.
const AUG_14_2026_NS = BigInt(Date.UTC(2026, 7, 14, 12, 0, 0)) * 1_000_000n;

const logbookFixture: Logbook = {
  uprn: '100081152294',
  owner: 'owner-principal',
  createdAt: AUG_14_2026_NS,
  entries: [
    {
      id: 0n,
      claim: {
        kind: 'propertyIdentity',
        uprn: '100081152294',
        addressLine: '12 Ivel Road',
        postcode: 'SG19 1AB',
        propertyType: 'Detached house',
      },
      recordedAt: AUG_14_2026_NS,
      recordedByTransaction: 'tx-1',
      evidence: 'systemDerived',
    },
    {
      id: 1n,
      claim: {
        kind: 'priceEvent',
        priceKind: 'sold',
        pricePence: 40_000_000n,
        occurredAt: AUG_14_2026_NS,
      },
      recordedAt: AUG_14_2026_NS,
      recordedByTransaction: 'tx-1',
      evidence: 'onchainAnchor',
    },
    {
      id: 2n,
      claim: {
        kind: 'documentAnchor',
        docType: 'TA6',
        sha256: `${'f'.repeat(60)}ab12`,
        validUntil: null,
        anchoredAt: AUG_14_2026_NS,
      },
      recordedAt: AUG_14_2026_NS,
      recordedByTransaction: null,
      evidence: 'onchainAnchor',
    },
  ],
};

const renderPage = (): void => {
  render(
    <MemoryRouter>
      <MyLogbooksPage />
    </MemoryRouter>,
  );
};

describe('MyLogbooksPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the address title, UPRN chip and plain-English entry timeline', async () => {
    getMyLogbooks.mockResolvedValue({ status: 'ok', logbooks: [logbookFixture] });
    renderPage();

    expect(await screen.findByText('12 Ivel Road, SG19 1AB')).toBeInTheDocument();
    expect(screen.getByText('UPRN 100081152294')).toBeInTheDocument();
    // A single logbook auto-expands, so the timeline is visible immediately.
    expect(screen.getByText('Sold for £400,000 · 14 Aug 2026')).toBeInTheDocument();
    expect(screen.getByText('TA6 anchored · SHA-256 …ab12')).toBeInTheDocument();
    // Evidence badge idiom from the pack viewer.
    expect(screen.getAllByText('Record held on the Internet Computer').length).toBeGreaterThan(0);
  });

  it('should show the empty state when the caller has no logbooks', async () => {
    getMyLogbooks.mockResolvedValue({ status: 'ok', logbooks: [] });
    renderPage();

    expect(
      await screen.findByText(
        'Your property logbook starts automatically when a purchase completes — free, and it stays with the home.',
      ),
    ).toBeInTheDocument();
  });

  it('should show the calm coming-soon state when the service is unavailable', async () => {
    getMyLogbooks.mockResolvedValue({ status: 'unavailable' });
    renderPage();

    expect(await screen.findByText('Property logbooks are coming soon')).toBeInTheDocument();
  });
});
