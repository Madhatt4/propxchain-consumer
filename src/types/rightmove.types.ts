export type {
  ListingSource,
  FieldProvenance,
  ListingImage,
  PropertyListing,
  ProvenanceFieldKey,
  ProvenanceMap,
  RightmovePropertyListing,
} from './listing.types';

export { REQUIRED_FIELDS } from './listing.types';

export interface RightmoveScrapeResponse {
  success: boolean;
  data: import('./listing.types').PropertyListing;
}

export interface RightmoveScrapeError {
  error: string;
}

/** @deprecated use ListingImage from listing.types */
export type { ListingImage as RightmoveImage } from './listing.types';
