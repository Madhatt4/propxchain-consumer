/**
 * Legacy entry point — kept for back-compat while callers migrate to listing.service.
 */
export {
  scrapeListing as scrapePropertyListing,
  scrapeListing as scrapeRightmoveListing,
  scrapeListing as scrapePurplebricksListing,
  isValidListingUrl,
  isValidListingUrl as isValidRightmoveUrl,
  isValidListingUrl as isValidPurplebricksUrl,
  listingService as rightmoveService,
  // Was a second hand-written host list here, and it had drifted: it returned
  // null for onthemarket.com, which isValidListingUrl already accepted. Now
  // re-exported like everything else in this shim, so the portal table in
  // listing.service is the only place a portal is declared.
  detectPortal,
} from './listing.service';

export type { Portal } from './listing.service';
