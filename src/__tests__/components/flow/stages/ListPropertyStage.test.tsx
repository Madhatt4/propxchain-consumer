import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ListPropertyStage } from '../../../../components/transaction/flow/stages/ListPropertyStage';
import type { StageConfig } from '../../../../types/stage.types';
import type { PropertyListing } from '../../../../types/listing.types';
import { lookupEpc } from '../../../../services/epc.service';
import { getPropertyIntelligence } from '../../../../services/propertyIntelligenceService';

vi.mock('../../../../services/rightmove.service', () => ({
  rightmoveService: {
    scrapeRightmoveListing: vi.fn().mockResolvedValue({
      address: '42 Oak Lane, Sandy',
      price: 350000,
      bedrooms: 3,
      propertyType: 'Semi-detached',
      agentName: 'Purple Bricks',
    }),
  },
}));

vi.mock('../../../../services/epc.service', () => ({
  lookupEpc: vi.fn().mockResolvedValue({
    address: '20 Ivel Road, SANDY', postcode: 'SG19 1AX', uprn: '100080078747',
    currentBand: 'C', potentialBand: 'B', currentRating: 69, potentialRating: 82,
    floorAreaSqm: 93, lodgementDate: '2023-06-13', meetsMees: true,
  }),
}));
vi.mock('../../../../services/propertyIntelligenceService', () => ({
  getPropertyIntelligence: vi.fn().mockResolvedValue({}),
}));

const mockStage: StageConfig = {
  id: 'seller-1',
  order: 1,
  title: 'List Property',
  description: 'Import listing',
  status: 'active',
  journeyRole: 'seller',
  prerequisiteStageIds: [],
  hasProviderMarketplace: false,
  serviceMode: 'real-read',
  serviceKey: 'rightmove',
};

/** Fixture listing with a postcode + address, but no EPC band yet — used to
 *  drive the auto-scan tests. Seeded directly into the localStorage shape
 *  `rightmoveStorage` reads, matching the real (unmocked) storage util. */
const FIXTURE_LISTING: PropertyListing = {
  url: '',
  listingId: 'fixture-1',
  source: 'manual',
  address: '20 Ivel Road, Sandy, SG19 1AX',
  addressLine1: '20 Ivel Road',
  town: 'Sandy',
  postcode: 'SG19 1AX',
  uprn: '100000000000',
  price: 350000,
  propertyType: 'Semi-detached',
  bedrooms: 3,
  tenure: 'freehold',
  priceQualifier: '',
  bathrooms: 1,
  description: '',
  keyFeatures: [],
  images: [],
  floorplanUrl: null,
  epcRating: null,
  agentName: '',
  agentBranch: '',
  agentLogoUrl: null,
  councilTaxBand: null,
  propertyPhrase: '',
  provenance: {},
};

function seedFixtureListing(transactionId: string, over: Partial<PropertyListing> = {}): void {
  localStorage.setItem(
    'rightmoveListings',
    JSON.stringify({ [transactionId]: { ...FIXTURE_LISTING, ...over } }),
  );
}

function renderStage(opts: { isEditing?: boolean } = {}) {
  return render(
    <ListPropertyStage stage={mockStage} transactionId="tx-auto-scan-1" isEditing={opts.isEditing} />,
  );
}

describe('ListPropertyStage', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('should render URL input', () => {
    render(<ListPropertyStage stage={mockStage} />);
    expect(screen.getByPlaceholderText(/paste/i)).toBeInTheDocument();
  });

  it('should render import button', () => {
    render(<ListPropertyStage stage={mockStage} />);
    expect(screen.getByRole('button', { name: /import/i })).toBeInTheDocument();
  });

  it('should validate URL before importing', () => {
    render(<ListPropertyStage stage={mockStage} />);
    const input = screen.getByPlaceholderText(/paste/i);
    const button = screen.getByRole('button', { name: /import/i });
    fireEvent.change(input, { target: { value: 'not-a-url' } });
    fireEvent.click(button);
    expect(screen.getByText(/valid/i)).toBeInTheDocument();
  });

  describe('auto property scan', () => {
    beforeEach(() => {
      seedFixtureListing('tx-auto-scan-1');
      vi.clearAllMocks();
    });

    it('should auto-run the free scan when a listing with a postcode is present', async () => {
      vi.useFakeTimers();
      renderStage();
      await vi.advanceTimersByTimeAsync(900);
      expect(lookupEpc).toHaveBeenCalledWith('SG19 1AX', expect.anything());
      expect(getPropertyIntelligence).toHaveBeenCalledWith('SG19 1AX', expect.anything(), expect.anything());
      vi.useRealTimers();
    });

    it('should hide the Autofill button once EPC and UPRN are both filled', async () => {
      vi.useFakeTimers();
      renderStage();
      await vi.advanceTimersByTimeAsync(900); // auto-scan fills both
      vi.useRealTimers();
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /autofill/i })).not.toBeInTheDocument();
      });
    });

    it('should stay silent when the auto-scan finds no records', async () => {
      vi.mocked(lookupEpc).mockResolvedValueOnce(null);
      vi.useFakeTimers();
      renderStage();
      await vi.advanceTimersByTimeAsync(900);
      vi.useRealTimers();
      await waitFor(() => {
        expect(lookupEpc).toHaveBeenCalled();
      });
      expect(screen.queryByText(/no epc found for this address/i)).not.toBeInTheDocument();
    });

    it('should offer the EPC register address when the form address is street-only, and fill it on tap', async () => {
      // Imported listings have no house number; the matched EPC certificate
      // does ("20 Ivel Road, SANDY") — one tap fixes the HMLR title-search
      // dead-end and pins the dwelling.
      seedFixtureListing('tx-auto-scan-1', { addressLine1: 'Ivel Road', address: 'Ivel Road, Sandy, SG19 1AX' });
      vi.useFakeTimers();
      renderStage();
      await vi.advanceTimersByTimeAsync(900);
      vi.useRealTimers();

      const useButton = await screen.findByRole('button', { name: /use this/i });
      expect(screen.getByText('20 Ivel Road')).toBeInTheDocument();
      fireEvent.click(useButton);
      expect(screen.getByDisplayValue('20 Ivel Road')).toBeInTheDocument();
      // Accepted → nothing left to suggest
      expect(screen.queryByRole('button', { name: /use this/i })).not.toBeInTheDocument();
    });

    it('should not offer a suggestion when the address already has a house number', async () => {
      vi.useFakeTimers();
      renderStage(); // fixture addressLine1 is '20 Ivel Road'
      await vi.advanceTimersByTimeAsync(900);
      vi.useRealTimers();
      await waitFor(() => {
        expect(lookupEpc).toHaveBeenCalled();
      });
      expect(screen.queryByRole('button', { name: /use this/i })).not.toBeInTheDocument();
    });

    it('should clear a stale success banner when a new postcode scans and misses', async () => {
      // Postcode A succeeds → green banner; user changes to postcode B whose
      // scan misses quietly → the postcode-A banner must not survive.
      vi.useFakeTimers();
      renderStage();
      await vi.advanceTimersByTimeAsync(900);
      vi.useRealTimers();
      await waitFor(() => {
        expect(screen.getByText(/found .* from public records/i)).toBeInTheDocument();
      });

      vi.mocked(lookupEpc).mockResolvedValueOnce(null);
      vi.useFakeTimers();
      fireEvent.change(screen.getByDisplayValue('SG19 1AX'), { target: { value: 'SG18 0AA' } });
      await vi.advanceTimersByTimeAsync(900);
      vi.useRealTimers();
      await waitFor(() => {
        expect(lookupEpc).toHaveBeenCalledTimes(2);
      });
      expect(screen.queryByText(/found .* from public records/i)).not.toBeInTheDocument();
    });

    it('should not auto-scan while editing a confirmed listing', async () => {
      vi.useFakeTimers();
      renderStage({ isEditing: true });
      await vi.advanceTimersByTimeAsync(2000);
      vi.useRealTimers();
      await waitFor(() => {
        expect(lookupEpc).not.toHaveBeenCalled();
      });
    });

    it('should not auto-scan on a completed stage', async () => {
      const completedStage: StageConfig = { ...mockStage, status: 'completed' };
      vi.useFakeTimers();
      render(<ListPropertyStage stage={completedStage} transactionId="tx-auto-scan-1" />);
      await vi.advanceTimersByTimeAsync(2000);
      vi.useRealTimers();
      await waitFor(() => {
        expect(lookupEpc).not.toHaveBeenCalled();
      });
    });
  });
});
