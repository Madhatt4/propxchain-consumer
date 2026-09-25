import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { SearchesPanel } from '../SearchesPanel';
import { postcodeService } from '../../../services/postcodeService';
import { markExplainerSeen } from '../../explainer/explainerSeen';
import type { LocalAuthorityInfo } from '../../../services/postcodeService';

vi.mock('../../../services/postcodeService', async () => {
  const actual =
    await vi.importActual<typeof import('../../../services/postcodeService')>(
      '../../../services/postcodeService',
    );
  return {
    ...actual,
    postcodeService: {
      ...actual.postcodeService,
      getLocalAuthorityInfo: vi.fn(),
      formatPostcode: (p: string) => p,
    },
  };
});

function laFixture(adminDistrict: string): LocalAuthorityInfo {
  return {
    postcode: 'S70 1AA',
    adminDistrict,
    adminCounty: null,
    region: null,
    country: 'England',
    parish: null,
    ward: null,
    constituency: null,
    latitude: null,
    longitude: null,
    codes: { adminDistrict: null, adminCounty: null },
  };
}

function renderPanel() {
  return render(
    <MemoryRouter>
      <SearchesPanel
        postcode="S70 1AA"
        transactionId="tx-test-1"
        transactionType="sale"
        partyName="Test Seller"
        partyEmail="seller@example.test"
        propertyAddress="1 Test Street, Barnsley"
        orderedBy="seller"
      />
    </MemoryRouter>,
  );
}

describe('SearchesPanel area capabilities', () => {
  beforeEach(() => {
    vi.mocked(postcodeService.getLocalAuthorityInfo).mockReset();
    window.localStorage.clear();
    // These assertions are about the provider cards, which the first-visit
    // explainer modal would sit in front of. Mark it seen so the panel
    // renders in its steady state.
    markExplainerSeen('searches', 'tx-test-1');
  });

  it('should show the local authority name once the lookup resolves', async () => {
    vi.mocked(postcodeService.getLocalAuthorityInfo).mockResolvedValue(laFixture('Barnsley'));
    renderPanel();
    expect(await screen.findByText('Barnsley')).toBeInTheDocument();
  });

  it('should still render the provider cards when the postcode lookup fails', async () => {
    vi.mocked(postcodeService.getLocalAuthorityInfo).mockRejectedValue(new Error('network down'));
    renderPanel();
    await waitFor(() => {
      expect(screen.getByText('OneSearch')).toBeInTheDocument();
    });
  });
});
