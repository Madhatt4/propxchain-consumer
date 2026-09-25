import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  claimPendingRightmoveData,
  clearPendingRightmoveData,
  getRightmoveData,
} from '../rightmoveStorage';
import type { RightmovePropertyListing } from '@/types/rightmove.types';

vi.mock('@/services/icp.service', () => ({
  icpService: {
    setListingData: vi.fn().mockResolvedValue(undefined),
    getListingData: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

function listing(over: Partial<RightmovePropertyListing> = {}): RightmovePropertyListing {
  return {
    url: 'https://www.rightmove.co.uk/properties/91242243',
    listingId: '91242243',
    source: 'rightmove',
    address: '1 Brickhill Road, Sandy, Bedfordshire, SG19',
    postcode: 'SG19 1JH',
    price: 545000,
    propertyType: 'Detached',
    bedrooms: 3,
    tenure: 'freehold',
    priceQualifier: '',
    bathrooms: 2,
    description: '',
    keyFeatures: [],
    images: [{ url: 'https://media.rightmove.co.uk/91242243.jpeg', caption: '' }],
    floorplanUrl: null,
    epcRating: null,
    agentName: '',
    agentBranch: '',
    agentLogoUrl: null,
    councilTaxBand: null,
    propertyPhrase: '',
    provenance: {},
    ...over,
  } as RightmovePropertyListing;
}

function stash(l: RightmovePropertyListing): void {
  localStorage.setItem('pendingRightmoveListing', JSON.stringify(l));
}

describe('claimPendingRightmoveData', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('should attach the listing when the postcode matches the transaction', async () => {
    stash(listing());
    claimPendingRightmoveData('tx_1', { address: '1 Brickhill Road', postcode: 'SG19 1JH' });

    expect(getRightmoveData('tx_1')?.address).toContain('Brickhill Road');
    expect(localStorage.getItem('pendingRightmoveListing')).toBeNull();
  });

  it('should tolerate postcode spacing and case differences', () => {
    stash(listing({ postcode: 'sg191jh' }));
    claimPendingRightmoveData('tx_1', { postcode: 'SG19 1JH' });

    expect(getRightmoveData('tx_1')).not.toBeNull();
  });

  // THE BUG. A listing left behind by an abandoned checkout was claimed by the
  // next transaction to complete, so opening "Merlin Drive" showed Brickhill
  // Road's photos, address and price.
  it('should NOT attach a stale listing for a different property', () => {
    stash(listing()); // Brickhill Road, SG19 1JH
    claimPendingRightmoveData('tx_merlin', {
      address: 'Merlin Drive, Sandy',
      postcode: 'SG19 2LT',
    });

    expect(getRightmoveData('tx_merlin')).toBeNull();
  });

  it('should discard the stale listing rather than leave it for the next transaction', () => {
    stash(listing());
    claimPendingRightmoveData('tx_merlin', { postcode: 'SG19 2LT' });

    // If it survived, the transaction created after this one would inherit it —
    // which is exactly how one bad listing spread across several transactions.
    expect(localStorage.getItem('pendingRightmoveListing')).toBeNull();
  });

  it('should still attach when the transaction has no postcode to compare', () => {
    // Ambiguous rather than wrong — dropping a legitimate listing here would
    // be a regression for anyone who did not enter a postcode.
    stash(listing());
    claimPendingRightmoveData('tx_1', { address: 'somewhere' });

    expect(getRightmoveData('tx_1')).not.toBeNull();
  });

  it('should do nothing when there is no stashed listing', () => {
    claimPendingRightmoveData('tx_1', { postcode: 'SG19 1JH' });
    expect(getRightmoveData('tx_1')).toBeNull();
  });

  it('should not throw on a corrupt stashed value', () => {
    localStorage.setItem('pendingRightmoveListing', 'not json');
    expect(() => claimPendingRightmoveData('tx_1', { postcode: 'SG19 1JH' })).not.toThrow();
    expect(getRightmoveData('tx_1')).toBeNull();
  });
});

describe('clearPendingRightmoveData', () => {
  beforeEach(() => localStorage.clear());

  it('should remove a stashed listing so the next checkout cannot inherit it', () => {
    stash(listing());
    clearPendingRightmoveData();
    expect(localStorage.getItem('pendingRightmoveListing')).toBeNull();
  });

  it('should be safe to call when nothing is stashed', () => {
    expect(() => clearPendingRightmoveData()).not.toThrow();
  });
});
