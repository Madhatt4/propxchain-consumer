// 'onthemarket' is emitted by the worker's OnTheMarket adapter
// (rightmove-worker/adapters/onthemarket.js) and was missing here, so a
// perfectly valid OnTheMarket import produced a listing whose `source` did not
// satisfy its own declared type.
export type ListingSource = 'rightmove' | 'purplebricks' | 'onthemarket' | 'jsonld' | 'llm' | 'manual';

export type FieldProvenance =
  | 'adapter' | 'jsonld' | 'llm' | 'user' | 'missing'
  | 'epc-register' | 'hmlr-register' | 'land-registry-ppd' | 'agent';

export interface ListingImage {
  url: string;
  caption: string;
}

export type Tenure = 'freehold' | 'leasehold' | 'shareOfFreehold' | 'unknown';

export interface PropertyListing {
  url: string;
  listingId: string;
  source: ListingSource;

  /** Canonical single-line address used by topbar / cards / search. When the
   *  user enters structured fields manually, this is computed by joining
   *  `addressLine1`, `addressLine2`, `town`, `county`, `postcode`. URL
   *  imports populate it as-is from the listing source. Always present. */
  address: string;
  postcode: string;
  price: number;
  propertyType: string;
  bedrooms: number;
  tenure: Tenure;

  /** Structured address fields. Optional for backwards-compatibility with
   *  imports that only return a flat `address` string, but populated
   *  whenever the user fills the manual form (and Required-validated when
   *  saving the form). */
  addressLine1?: string;
  addressLine2?: string;
  town?: string;
  county?: string;

  /** Unique Property Reference Number — the canonical GB property identifier
   *  (Ordnance Survey / Local Land & Property Gazetteer). Optional, 1–12
   *  digits. Identifies the *property*, never the owner — ownership is
   *  established by the HMLR title pull. Phase 1 captures it manually. */
  uprn?: string;

  /** Lease-specific fields — required when `tenure === 'leasehold'`. */
  leaseYearsRemaining?: number;
  groundRentPerYear?: number;
  serviceChargePerYear?: number;

  priceQualifier: string;
  bathrooms: number;
  receptions?: number;
  description: string;
  keyFeatures: string[];
  images: ListingImage[];
  floorplanUrl: string | null;
  epcRating: string | null;
  agentName: string;
  agentBranch: string;
  agentLogoUrl: string | null;
  councilTaxBand: string | null;
  propertyPhrase: string;

  provenance: ProvenanceMap;
}

export type ProvenanceFieldKey =
  | 'listingId' | 'source' | 'address' | 'postcode' | 'price' | 'propertyType'
  | 'bedrooms' | 'tenure' | 'priceQualifier' | 'bathrooms' | 'receptions'
  | 'description' | 'keyFeatures' | 'images' | 'floorplanUrl' | 'epcRating'
  | 'agentName' | 'agentBranch' | 'agentLogoUrl' | 'councilTaxBand'
  | 'propertyPhrase' | 'addressLine1' | 'addressLine2' | 'town' | 'county'
  | 'leaseYearsRemaining' | 'groundRentPerYear' | 'serviceChargePerYear'
  | 'uprn';

export type ProvenanceMap = Partial<Record<ProvenanceFieldKey, FieldProvenance>>;

export const REQUIRED_FIELDS: readonly ProvenanceFieldKey[] = [
  'address', 'postcode', 'price', 'tenure',
] as const;

/** @deprecated use PropertyListing */
export type RightmovePropertyListing = PropertyListing;
