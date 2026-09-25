export interface SearchItem {
  id: string;
  name: string;
  pricePence: number;
  included: boolean;      // included in standard pack
  required?: boolean;     // auto-detected from postcode region
  recommended?: boolean;
  category: 'standard' | 'area-specific' | 'optional';
  /** Display copy for delivery turnaround (e.g. '24 hrs', '48 hrs'). */
  turnaround?: string;
  /**
   * PISCES product code, when this item maps to a OneSearch/PISCES product.
   * Used by onesearchService.placeOrder. Items from other providers (tmGroup,
   * Groundsure) leave this undefined.
   */
  productType?: string;
}

export interface SearchProvider {
  id: string;
  name: string;
  logo: string;
  tagline: string;
  tier: 1 | 2;
  turnaround: string;
  turnaroundPriority?: string;
  priorityFeePence?: number;
  regulated: string;
  highlight?: 'Recommended' | 'Budget' | 'Direct';
  instantOrder: boolean;
  standardPackPence: number;
  standardPackSearches: SearchItem[];
  additionalSearches: SearchItem[];
}

// tmGroup catalogue. Product codes, names and providers are the REAL ones, read from
// their live AvailableProducts API on 2026-08-09 (demo20, Residential/Purchase, 98
// products). They replace an invented list — "Local Authority Search £120",
// "Environmental £45", "Water & Drainage £55" — that nobody at tmGroup ever quoted.
//
// EVERY pricePence HERE IS 0 ON PURPOSE, and the card must never present a total.
// tmGroup price PER PROPERTY: Local Authority fees run £100–£300 depending on council
// and water £17–£98 (tmGroup, 2026-07-23), so no fixed number can be honest. The
// real figure comes from a Draft, which returns vatable / nonVatable / vat per product
// — and their sandbox currently 500s on every write, so we cannot quote at all yet.
//
// A price of 0 that reaches a checkout is a free order, so this data must stay behind
// FEATURE_FLAGS.TMGROUP_ENABLED and the builder must not offer an order button.
export const tmGroupProvider: SearchProvider = {
  id: 'tmgroup',
  name: 'tmGroup',
  logo: 'TM',
  tagline: 'Regulated local, drainage and environmental searches — priced per property',
  tier: 1,
  turnaround: '3-5 working days',
  regulated: 'CoPSO Member',
  instantOrder: false,
  standardPackPence: 0,
  standardPackSearches: [
    { id: 'tmg-psreport12', productType: 'PSReport12', name: 'Regulated Personal Local Search', pricePence: 0, included: true, category: 'standard', turnaround: '3-5 working days' },
    { id: 'tmg-con29dw', productType: 'Con29DW', name: 'Drainage & Water Enquiry (Residential)', pricePence: 0, included: true, category: 'standard', turnaround: '3-5 working days' },
    { id: 'tmg-enviroschr', productType: 'EnviroschR', name: 'Landmark Envirosearch Residential', pricePence: 0, included: true, category: 'standard', turnaround: '3-5 working days' },
  ],
  additionalSearches: [
    { id: 'tmg-tmgllc1', productType: 'TMGLLC1', name: 'Register of Local Land Charges (official)', pricePence: 0, included: false, category: 'optional' },
    { id: 'tmg-tmgcon29', productType: 'TMGCon29', name: 'Standard & Optional Enquiries of Local Authority (CON29)', pricePence: 0, included: false, category: 'optional' },
    { id: 'tmg-gsenviro', productType: 'GSEnviro', name: 'Groundsure Homebuyers', pricePence: 0, included: false, category: 'optional' },
    // GSAvistaR and FTResCR were in the 98-product AvailableProducts response all
    // along — lines 214 and 208, confirmed by Halif Saddiquin on 2026-08-28 with a
    // screenshot of our own 2026-08-09 call. They were simply never curated into
    // this list, and were then reported to tmGroup as missing from tmGroup's
    // catalogue: our 11-item subset was checked instead of their 98. Absence from
    // THIS file is not absence from THEIR API.
    // CDSRegWDR was absent from the 2026-08-09 read because it was not activated
    // on our DEMO20 account, not because tmGroup does not sell it. tmGroup
    // asked corporate ops to activate the pack codes on 2026-09-01 and a re-pull
    // the same day returned 100 products where the first read returned 98.
    //
    // Two products arrived in that re-pull. CDSRegWDR is the one below and is
    // deliberately curated in — it is the Regulated Water Authority Search from
    // tmGroup's pack sheet and all three regulated packs need it. CDSRegWDRP, the
    // "PLUS" variant, is deliberately LEFT OUT: tmGroup has never quoted it, and an
    // unquoted product has no price we have agreed. Do not delete the line below
    // thinking it was the excluded one.
    { id: 'tmg-cdsregwdr', productType: 'CDSRegWDR', name: 'Regulated Water and Drainage Report', pricePence: 0, included: false, category: 'optional' },
    { id: 'tmg-gsavistar', productType: 'GSAvistaR', name: 'Groundsure Avista Residential', pricePence: 0, included: false, category: 'optional' },
    { id: 'tmg-ftrescr', productType: 'FTResCR', name: 'Chancel Repair Policy (Successor in Title)', pricePence: 0, included: false, category: 'optional' },
    { id: 'tmg-con29m', productType: 'Con29M', name: 'Coal Authority Mining Report (CON29M)', pricePence: 0, included: false, category: 'area-specific' },
    { id: 'tmg-corntin', productType: 'CornTin', name: 'Metalliferous Mining Search (Tin)', pricePence: 0, included: false, category: 'area-specific' },
    { id: 'tmg-ccheck', productType: 'CCheck', name: 'Chancel Check', pricePence: 0, included: false, category: 'optional' },
    { id: 'tmg-floodr', productType: 'FloodR', name: 'Landmark Flood', pricePence: 0, included: false, category: 'optional' },
    { id: 'tmg-hway', productType: 'CDSHWayEnR', name: 'Local Authority Highways Enquiry', pricePence: 0, included: false, category: 'optional' },
  ],
};

// ───────────────────────────────────────────────────────────────────────────
// OneSearch catalogue — primary instant-order provider. The consumer-facing
// model is now the 3-tier "pick a pack" structure agreed with OneSearch
// — see `onesearchPacks`
// below, which is what OneSearchPackageBuilder renders. The onesearchProvider
// object is retained for the collapsible provider-card metadata (logo, name,
// tagline, "from" price). PISCES product codes live in each item's productType.
// ───────────────────────────────────────────────────────────────────────────

export const onesearchProvider: SearchProvider = {
  id: 'onesearch',
  name: 'OneSearch',
  logo: 'OS',
  tagline: 'Personal local search + Landmark environmental, ordered instantly via PISCES',
  tier: 1,
  turnaround: '1-5 working days',
  regulated: 'CoPSO Member',
  highlight: 'Recommended',
  instantOrder: true,
  // Header "from" price = Standard pack RRP, VAT-INCLUSIVE (£216 net + £43.20
  // VAT = £259.20). Inc-VAT because the card is consumer-facing and
  // PropXchain is merchant of record — advertising a net figure to a consumer
  // when checkout takes 20% more is a price that is not the price. Mirrors
  // onesearch-worker's ONESEARCH_PACK_PRICES_GBP — the worker re-prices
  // server-side and rejects a disagreement, so these two move together or orders
  // start 400ing. The live, ordered pack catalogue is `onesearchPacks` below.
  standardPackPence: 25920,
  standardPackSearches: [
    {
      id: 'onesearch-llc1con29',
      productType: 'LLC1CON29',
      name: 'OneSearch Prime (LLC1 + CON29)',
      pricePence: 10752,
      included: true,
      category: 'standard',
      turnaround: '1-5 working days',
    },
    {
      id: 'onesearch-dw',
      productType: 'ONESEARCHDW',
      name: 'OneSearch Drainage & Water',
      pricePence: 5586,
      included: true,
      category: 'standard',
      turnaround: '1-5 working days',
    },
    {
      id: 'onesearch-envres',
      productType: 'ENVRES',
      name: 'Landmark Envirosearch Residential',
      pricePence: 10680,
      included: true,
      category: 'standard',
      turnaround: '1-5 working days',
    },
  ],
  additionalSearches: [
    {
      id: 'onesearch-homecheckpro',
      productType: 'HOMECHECKPRO',
      name: 'Landmark Homecheck Residential (budget environmental)',
      pricePence: 7440,
      included: false,
      category: 'optional',
      turnaround: '1-5 working days',
    },
    {
      id: 'onesearch-coal-con29m',
      productType: 'LANDMARKCON29M',
      name: 'Landmark Coal (CON29M)',
      pricePence: 5700,
      included: false,
      category: 'area-specific',
      turnaround: '1-5 working days',
    },
  ],
};

// ───────────────────────────────────────────────────────────────────────────
// OneSearch consumer pack tiers — the 3-tier "pick a pack" model agreed with
// OneSearch. PropXchain is merchant of record and charges the RRP.
//
// These MUST equal onesearch-worker's ONESEARCH_PACK_PRICES_GBP in pence. The
// worker re-prices every order server-side and never trusts a client total, so
// drift here does not overcharge — it 400s the order.
//
// KNOWN GAP, deliberately not fixed in this change: the labels say "ex VAT" and
// "+VAT" but the checkout charges the ex-VAT figure unchanged (see
// SearchesPanel's exVatAmounts, which returns vatPence: 0, and payment-worker
// index.js line ~287). PropXchain has been VAT-registered since EDR 08 Feb 2026
// and is principal, so an unlabelled flat charge is treated as VAT-INCLUSIVE by
// HMRC and 1/6th is output tax. Charging VAT on top is a separate money-path
// change and gets its own PR and its own review.
//
// PISCES codes LLC1CON29 / ONESEARCHDW / HOMECHECKPRO are confirmed, and
// the full product list (2026-07-21, PiscesCodesForpropX xlsx in the monorepo's
// onesearch-worker/) confirms RVR as LMKRVResi. The 6-month refresh is absent
// from that list because it is a FEE item rather than a search product; its
// code is REFRESH, confirmed 2026-07-27. All three tiers are orderable as of
// 2026-08-06 — see PACK_ITEM_REFRESH for the gates that had to clear.
// ───────────────────────────────────────────────────────────────────────────

export interface OneSearchPack {
  id: 'standard' | 'standard-refresh' | 'premium';
  name: string;
  tagline: string;
  /**
   * RRP in pence, **VAT-INCLUSIVE** (Marc, 2026-08-21). This IS the price the
   * customer pays and the number we quote — no caller should ever add VAT to it
   * again. It equals what onesearch-worker stamps as the order's retail_gbp.
   */
  rrpPence: number;
  /**
   * The ex-VAT figure inside `rrpPence`, mirroring onesearch-worker's `netGbp`.
   *
   * Carried explicitly rather than derived by dividing the RRP by 1.2, for two
   * reasons: division is lossy on any RRP that is not a clean multiple, and
   * margin must be measured net-against-net. Trade cost is ex-VAT, so comparing
   * it to `rrpPence` would overstate margin by the VAT.
   * `rrpPence === grossPence(netPence)` is asserted in the tests.
   */
  netPence: number;
  /** Itemised contents shown when the pack is expanded ("what's included"). */
  items: SearchItem[];
  /** Optional explanatory line shown under the itemised list. */
  note?: string;
  /** Small chip on the pack card (e.g. "Most popular"). */
  badge?: string;
  /** True when one or more items lack a confirmed PISCES product code. */
  orderCodesPending?: boolean;
}

/**
 * UK standard rate. PropXchain registered for VAT 2026-08-06 (EDR 08 Feb 2026)
 * and sells searches as principal, so output tax is due on the full sale price.
 * Mirrors onesearch-worker's VAT_RATE.
 */
export const VAT_RATE = 0.2;

/** Net pence → VAT in pence, rounded to the penny. */
export function vatPenceOn(netPence: number): number {
  return Math.round(netPence * VAT_RATE);
}

/** Net pence → the gross, VAT-inclusive pence the customer is charged. */
export function grossPence(netPence: number): number {
  return netPence + vatPenceOn(netPence);
}

const ONESEARCH_TURNAROUND = '1-5 working days';

// Pack line items. pricePence is 0 because packs are priced as a whole (RRP
// only) — per-item prices are intentionally not shown. productType carries the
// PISCES code for each item.
const PACK_ITEM_LA: SearchItem = {
  id: 'onesearch-llc1con29',
  productType: 'LLC1CON29',
  name: 'Local Authority Search (LLC1 + CON29)',
  pricePence: 0,
  included: true,
  category: 'standard',
  turnaround: ONESEARCH_TURNAROUND,
};
const PACK_ITEM_WATER: SearchItem = {
  id: 'onesearch-dw',
  productType: 'ONESEARCHDW',
  name: 'Water & Drainage (CON29DW)',
  pricePence: 0,
  included: true,
  category: 'standard',
  turnaround: ONESEARCH_TURNAROUND,
};
const PACK_ITEM_ENV_HOMECHECK: SearchItem = {
  id: 'onesearch-homecheck-res',
  productType: 'HOMECHECKPRO',
  name: 'Environmental (Homecheck Residential)',
  pricePence: 0,
  included: true,
  category: 'standard',
  turnaround: ONESEARCH_TURNAROUND,
};
const PACK_ITEM_REFRESH: SearchItem = {
  id: 'onesearch-refresh',
  // "REFRESH" per OneSearch, 2026-07-27: "just add product code REFRESH to
  // your order. This will add the refresh product fee to your order." It is
  // absent from OneSearch's 2026-07-21 product list because it is a FEE ITEM, not a search product — which is why an
  // earlier pass through that list concluded no code existed.
  //
  // SELLABLE since 2026-08-06. Three gates held these packs back and each
  // lifted separately: the code (REFRESH, above); the fee, agreed 2026-08-03
  // and re-confirmed 2026-08-06; and the copy being honest that the refresh is
  // a manual claim we make rather than something automatic, which shipped in
  // #174. The worker prices both pack signatures, so an order now reaches
  // PISCES instead of 400ing `unpriced_products`.
  //
  // THE OBLIGATION THIS CREATES: the copy commits PropXchain to claiming each
  // refresh with OneSearch before the 6-month expiry. The worker stamps
  // `refresh_due_at` on acceptance; the chase procedure lives in the ops repo
  // at docs/runbooks/onesearch-refresh-chase.md. Selling a pack today creates
  // a task for six months' time — that runbook is what remembers it.
  productType: 'REFRESH',
  name: '6-month refresh — we renew your searches before they expire (6 → 12 months’ validity)',
  pricePence: 0,
  included: true,
  category: 'optional',
  turnaround: ONESEARCH_TURNAROUND,
};
const PACK_ITEM_RVR: SearchItem = {
  id: 'onesearch-rvr',
  // "Landmark RiskView Residential" per OneSearch's PISCES list (2026-07-21).
  productType: 'LMKRVResi',
  name: 'Full Risk View Residential (RVR) — climate, flood, coal & subsidence',
  pricePence: 0,
  included: true,
  category: 'standard',
  turnaround: ONESEARCH_TURNAROUND,
};

// Ordered cheapest first so the picker reads as a price ladder. The default
// selection is named explicitly in OneSearchPackageBuilder rather than taken
// from position, so adding a cheaper entry here never silently changes it.
// The standalone "Water & Drainage only" pack was REMOVED on 2026-08-01 (Marc).
// It only ever existed to exercise the live PISCES link and always carried a
// placeholder trade price, so we could not have known our margin at the point
// of sale. Drainage & Water has not
// gone away: it stays inside the Standard / Standard+Refresh / Premium packs
// via PACK_ITEM_WATER, and the CON29DW products remain requestable through the
// full catalogue below, where a null retailPricePence routes the customer to
// "OneSearch confirms pricing within 24 hours" — i.e. it asks OneSearch for a
// price rather than guessing one.
// Prices are quoted VAT-inclusive: rrpPence = netPence x 1.2. They mirror
// onesearch-worker's ONESEARCH_PACK_PRICES_GBP (which stores the net and
// derives VAT). The worker re-prices every order server-side and rejects a
// mismatch, so if you change a price here, change it there in the same commit.
export const onesearchPacks: OneSearchPack[] = [
  {
    id: 'standard',
    name: 'Standard',
    tagline: 'Covers around 90% of residential cases',
    rrpPence: 25920,
    netPence: 21600,
    items: [PACK_ITEM_LA, PACK_ITEM_WATER, PACK_ITEM_ENV_HOMECHECK],
    badge: 'Most popular',
  },
  {
    id: 'standard-refresh',
    name: 'Standard + Refresh',
    tagline: 'Standard bundle with a 6-month refresh',
    rrpPence: 33600,
    netPence: 28000,
    items: [PACK_ITEM_LA, PACK_ITEM_WATER, PACK_ITEM_ENV_HOMECHECK, PACK_ITEM_REFRESH],
    note: 'Your searches are valid for 6 months. We track the expiry date and arrange the refresh with OneSearch before it lapses, taking validity to 12 months — you don’t need to do anything.',
  },
  {
    id: 'premium',
    name: 'Premium (Full Risk View)',
    tagline: 'Full environmental risk view, plus a refresh',
    rrpPence: 37200,
    netPence: 31000,
    items: [PACK_ITEM_LA, PACK_ITEM_WATER, PACK_ITEM_RVR, PACK_ITEM_REFRESH],
    note: 'Full Risk View Residential covers climate, flood, coal and subsidence. Includes the 6-month refresh — we track the expiry and arrange it with OneSearch, taking validity to 12 months.',
  },
];

// ───────────────────────────────────────────────────────────────────────────
// OneSearch full catalogue — every PISCES product on OneSearch's product list
// (2026-07-21) beyond the 6 codes already sold through
// onesearchProvider/onesearchPacks above (excluded here so nothing appears
// twice). Backs the "Searches" tick-box sub-card for non-standard
// transactions.
//
// Packs stay the front door; this catalogue answers "what does *this*
// property need" underneath them.
//
// PRICING IS NOT WIRED YET. OneSearch has only ever quoted trade cost per
// pack — never per individual product outside a pack. Per OneSearch
// (2026-07-28): tell them when a customer actually picks a product and they
// sort the trade cost from there —
// so this isn't a hard blocker on selling the product, only on knowing our
// margin at the moment of sale. Every item here has tradePricePence: null
// and retailPricePence: null today; the tick-box card (OneSearchProductListCard)
// treats a null retailPricePence as "request it, OneSearch confirms pricing
// within 24 hours" rather than refusing the request outright. orderable
// stays false — it's reserved for a future instant-pay path once a
// retailPricePence exists, which still needs the worker's /order flow (and
// Stripe checkout) extended to arbitrary per-item baskets, not done here.
// Do NOT backfill a placeholder trade price across this list. The one place we
// ever did that — the standalone dw-only pack — is exactly why that pack was
// removed on 2026-08-01: a guessed trade price means an unknown margin at the
// point of sale. Ask OneSearch for a real price instead.
// ───────────────────────────────────────────────────────────────────────────

export interface OneSearchCatalogueItem {
  id: string;
  /** PISCES product code — must match a key in the worker's item price table once priced. */
  code: string;
  name: string;
  segment: 'residential' | 'commercial' | 'agricultural';
  /** Free-text caveat from OneSearch's product list (e.g. DWANGLIAN's generic-code note). */
  notes?: string;
  /**
   * True when this PISCES code sells the same product Groundsure sells
   * directly (see groundsureBundles/Singles/Regionals below) — OneSearch can
   * apparently route Groundsure orders through PISCES too. Whether to sell
   * both routes is an open business question, not one to resolve by data
   * import, so these are flagged rather than silently deduped or exposed.
   * getResidentialOneSearchCatalogue() excludes them by default.
   */
  groundsurePiscesDuplicate?: boolean;
  /** Trade (wholesale) cost in pence. Null until OneSearch confirms a per-product price. */
  tradePricePence: number | null;
  /** RRP in pence, ex-VAT. Null until a trade price exists to base a margin on. */
  retailPricePence: number | null;
  /** True once tradePricePence/retailPricePence are both set — gates the tick-box UI's order path. */
  orderable: boolean;
}

export const onesearchFullCatalogue: OneSearchCatalogueItem[] = [
  { id: "os-10-noise-abatement", code: "NoiseAbatement", name: "10. Noise abatement", segment: "residential", tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-12-enterprise-zones-local-development-orders-bids", code: "EnterpriseZones", name: "12. Enterprise zones, Local Development Orders & Bids", segment: "residential", tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-13-inner-urban-improvement-areas", code: "InnerUrbanImprovement", name: "13. Inner urban improvement areas", segment: "residential", tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-14-simplified-planning-zones", code: "SimplifiedPlanning", name: "14. Simplified planning zones", segment: "residential", tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-15-land-maintenance-notices", code: "LandMaintenance", name: "15. Land maintenance notices", segment: "residential", tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-16-mineral-consultation-and-safeguarding-areas", code: "MineralConsultation", name: "16. Mineral consultation and safeguarding areas", segment: "residential", tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-17-hazardous-substance-consents", code: "HazardousSubstance", name: "17. Hazardous substance consents", segment: "residential", tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-18-environmental-and-pollution-notices", code: "EnvPolNotices", name: "18. Environmental and pollution notices", segment: "residential", tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-19-food-safety-notices", code: "FoodSafetyNotices", name: "19. Food safety notices", segment: "residential", tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-20-hedgerow-notices", code: "HedgerowNotices", name: "20. Hedgerow notices", segment: "residential", tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-21-flood-defence-and-land-drainage-consents", code: "FloodDefence", name: "21. Flood Defence and Land Drainage Consents", segment: "residential", tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-22-common-land-and-town-or-village-green", code: "COMMONREG", name: "22. Common Land and Town or Village Green", segment: "residential", tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-22-common-land-and-town-or-village-green-official", code: "CommonsRegistrationOfficial", name: "22. Common Land and Town or Village Green (Official)", segment: "residential", tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-4-road-proposals-by-private-bodies", code: "ROADPROPBODY", name: "4. Road proposals by private bodies", segment: "residential", tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-5-advertisements", code: "Advertisements", name: "5. Advertisements", segment: "residential", tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-6-completion-notices", code: "CompletionNotices", name: "6. Completion notices", segment: "residential", tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-7-parks-and-countryside", code: "ParksCountryside", name: "7. Parks and countryside", segment: "residential", tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-8-pipelines", code: "Pipelines", name: "8. Pipelines", segment: "residential", tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-9-houses-in-multiple-occupation", code: "HousesMultiple", name: "9. Houses in multiple occupation", segment: "residential", tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-argyll-estatesolutions-farm", code: "ARGYLLESTATEFARM", name: "Argyll EstateSolutions Farm", segment: "agricultural", tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-argyll-sitesolutions-combined-commercial", code: "ARGYLLSITECOMBINEDCOMM", name: "Argyll SiteSolutions Combined Commercial", segment: "commercial", tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-chancelcheck-premium", code: "CHANCELCHECKPREMIUM", name: "ChancelCheck Premium", segment: "residential", tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-coal-report-residential-terrafirma", code: "TERRAFIRMACOALRESI", name: "Coal Report - Residential (Terrafirma)", segment: "residential", tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-con29dw-geodesys-anglian-water", code: "DWANGLIAN", name: "CON29DW Geodesys (Anglian Water)", segment: "residential", notes: "You can use CON29DWRES as the product code for ANY official residential DW, and CON29DWCOM for most commercials (not those with Commercial Plus etc. offerings).", tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-con29dw-independent-water-networks", code: "DWINDEPENDENT", name: "CON29DW Independent water Networks", segment: "residential", tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-con29dw-leep-networks-water-ltd", code: "DWSCOTTISHSOUTHERN", name: "CON29DW Leep Networks (Water) Ltd", segment: "residential", tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-con29dw-northumbrian-water", code: "DWNORTHUMBRIAN", name: "CON29DW Northumbrian Water", segment: "residential", tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-con29dw-safemove-yorkshire-water", code: "DWSAFEMOVE", name: "CON29DW Safemove (Yorkshire Water)", segment: "residential", tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-con29dw-severn-trent-water", code: "DWSEVERNTRENT", name: "CON29DW Severn Trent Water", segment: "residential", tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-con29dw-south-west-water", code: "DWSOUTHWEST", name: "CON29DW South West Water", segment: "residential", tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-con29dw-southern-water", code: "DWSOUTHERN", name: "CON29DW Southern Water", segment: "residential", tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-con29dw-thames-water", code: "DWTHAMES", name: "CON29DW Thames Water", segment: "residential", tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-con29dw-united-utilities", code: "DWUNITEDUTILS", name: "CON29DW United Utilities", segment: "residential", tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-con29dw-welsh-water", code: "DWWELSH", name: "CON29DW Welsh Water", segment: "residential", tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-con29dw-wessex-water", code: "DWWESSEX", name: "CON29DW Wessex Water", segment: "residential", tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-council-sourced-llc1-con29-commercial", code: "COUNCIL_LLC1CON29_COM", name: "Council Sourced LLC1 & Con29 Commercial", segment: "commercial", tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-council-sourced-llc1-con29-residential", code: "COUNCIL_LLC1CON29_RES", name: "Council Sourced LLC1 & Con29 Residential", segment: "residential", tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-fci-commercial-15ha", code: "FCICOMMSMALL", name: "FCI Commercial <15Ha", segment: "commercial", tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-fci-flood-appraisal-residential-up-to-0-25ha", code: "FCIFLOODAPPRAISALRES", name: "FCI Flood Appraisal – Residential (Up to 0.25Ha)", segment: "residential", tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-fci-premium-residential-1ha", code: "FCIPREMIUM", name: "FCI Premium Residential (<1Ha)", segment: "residential", tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-geodesys-anglian-water-commercial", code: "DWCOMANGLIAN", name: "Geodesys (Anglian Water) - Commercial", segment: "commercial", tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-groundsure-agricultural", code: "GROUNDSUREAGRICULTURAL", name: "GroundSure Agricultural", segment: "agricultural", groundsurePiscesDuplicate: true, tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-groundsure-avista", code: "AVISTA", name: "Groundsure Avista", segment: "residential", groundsurePiscesDuplicate: true, tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-groundsure-energy-and-transportation-residential", code: "GROUNDSUREENERGYANDTRANSPORTATIONRESIDENTIAL", name: "Groundsure Energy and Transportation (residential)", segment: "residential", groundsurePiscesDuplicate: true, tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-groundsure-flood", code: "GROUNDSUREFLOOD", name: "GroundSure Flood", segment: "residential", groundsurePiscesDuplicate: true, tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-groundsure-floodview", code: "GROUNDSUREFLOODVIEW", name: "GroundSure Floodview", segment: "residential", groundsurePiscesDuplicate: true, tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-groundsure-homebuyers", code: "GROUNDSUREHMBUYR", name: "Groundsure Homebuyers", segment: "residential", groundsurePiscesDuplicate: true, tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-groundsure-planning", code: "GROUNDSUREPLANNING", name: "GroundSure Planning", segment: "residential", groundsurePiscesDuplicate: true, tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-groundsure-planview", code: "GROUNDSUREPLANVIEW", name: "GroundSure Planview", segment: "residential", groundsurePiscesDuplicate: true, tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-groundsure-screening-with-professional-opinion-up-to-15-hectares", code: "GROUNDSURESCREENING", name: "Groundsure Screening (With Professional Opinion) up to 15 hectares", segment: "residential", groundsurePiscesDuplicate: true, tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-land-registry-plan", code: "LANDREGPLAN", name: "Land Registry Plan", segment: "residential", tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-landmark-chancel-commercial", code: "LANDMARKCHANCEL_COMMERCIAL", name: "Landmark Chancel Commercial", segment: "commercial", tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-landmark-chancel-residential", code: "LANDMARKCHANCEL", name: "Landmark Chancel Residential", segment: "residential", tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-landmark-climate-change-report-residential", code: "CLIMATECHANGERESI", name: "Landmark Climate Change Report - Residential", segment: "residential", tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-landmark-coal", code: "LANDMARKCOAL", name: "Landmark Coal", segment: "residential", tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-landmark-commercial-coal", code: "LANDMARKCOAL_COMMERCIAL", name: "Landmark Commercial Coal", segment: "commercial", tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-landmark-energy-and-infrastructure-report", code: "LANDMARKHS2", name: "Landmark Energy and Infrastructure Report", segment: "residential", tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-landmark-flood", code: "OSFLOOD", name: "Landmark Flood", segment: "residential", tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-landmark-homecheck-mining-and-subsidence", code: "HCPGSR", name: "Landmark Homecheck Mining and Subsidence", segment: "residential", tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-landmark-planning", code: "PLANSEARCHPLUS", name: "Landmark Planning", segment: "residential", tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-landmark-radon-risk-report", code: "LANDMARKRADON", name: "Landmark Radon Risk Report", segment: "residential", tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-landmark-site-solutions-highways-report", code: "SSHIGHWAYS", name: "Landmark Site Solutions Highways Report", segment: "residential", tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-landmark-sitecheck-assess-with-professional-opinion", code: "SITECHECKASSESS", name: "Landmark Sitecheck Assess (With Professional Opinion)", segment: "residential", tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-landmark-sitecheck-combined", code: "SITECHECKCOMBINED", name: "Landmark Sitecheck Combined", segment: "residential", tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-landmark-sitecheck-planning", code: "PLANSEARCHCOM", name: "Landmark Sitecheck Planning", segment: "residential", tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-landmark-utility-report-premium", code: "LANDMARKUTILITYPREMIUM", name: "Landmark Utility Report Premium", segment: "residential", tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-northumbrian-water-commercial", code: "DWCOMNORTHUMBRIAN", name: "Northumbrian Water - Commercial", segment: "commercial", tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-onesearch-duo", code: "HIGHWAYS", name: "OneSearch Duo", segment: "residential", tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-onesearch-prime-commercial", code: "COMLLC1", name: "OneSearch Prime Commercial", segment: "commercial", tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-safemove-yorkshire-water-commercial-plus", code: "DWCOMPLUSSAFEMOVE", name: "Safemove (Yorkshire Water) – Commercial Plus", segment: "commercial", tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-severn-trent-commercial-extra", code: "DWCOMSEVERNTRENTPLUS", name: "Severn Trent - Commercial Extra", segment: "commercial", tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-sim-search", code: "SEARCHOFINDEXMAP", name: "SIM Search", segment: "residential", tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-south-west-water-commercial", code: "DWCOMSOUTHWEST", name: "South West Water - Commercial", segment: "commercial", tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-southern-water-commercial", code: "DWCOMSOUTHERN", name: "Southern Water - Commercial", segment: "commercial", tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-terrasearch-coal-commercial", code: "TERRACOALCOM", name: "TerraSearch Coal - Commercial", segment: "commercial", tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-terrasearch-ground", code: "TERRAGROUND", name: "TerraSearch Ground", segment: "residential", tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-terrasearch-ground-commercial", code: "TERRASEARCHGROUNDCOMMERCIAL", name: "Terrasearch Ground Commercial", segment: "commercial", tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-thames-water-commercial", code: "DWCOMTHAMES", name: "Thames Water - Commercial", segment: "commercial", tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-united-utilities-commercial", code: "DWCOMUNITEDUTILS", name: "United Utilities - Commercial", segment: "commercial", tradePricePence: null, retailPricePence: null, orderable: false },
  { id: "os-wessex-water-commercial", code: "DWCOMWESSEX", name: "Wessex Water - Commercial", segment: "commercial", tradePricePence: null, retailPricePence: null, orderable: false },
];

/** Convenience lookup: every OneSearch full-catalogue item by PISCES code. */
export const onesearchCatalogueByCode: Record<string, OneSearchCatalogueItem> =
  onesearchFullCatalogue.reduce<Record<string, OneSearchCatalogueItem>>((acc, item) => {
    acc[item.code] = item;
    return acc;
  }, {});

/**
 * The residential-conveyancing subset the tick-box sub-card should actually
 * show — excludes commercial/agricultural variants and the Groundsure/PISCES
 * duplicates, mirroring the curation groundsureBundles/Singles/Regionals
 * already apply for the Groundsure card.
 */
export function getResidentialOneSearchCatalogue(): OneSearchCatalogueItem[] {
  return onesearchFullCatalogue.filter(
    (item) => item.segment === 'residential' && !item.groundsurePiscesDuplicate,
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Groundsure-direct catalogue — displayed under PropXchain branding in the
// hybrid searches panel. Prices are RRP per the Groundsure Pricing Schedule
// effective 2026-04-01; the trade-vs-RRP delta is captured in the admin
// budget view, not here. Curation is residential-conveyancing-only: we skip
// commercial, utilities, insights, GS Insight bundle, land-search, site-plan,
// and extended-area variants (default to the smallest residential size).
// ───────────────────────────────────────────────────────────────────────────

/**
 * Groundsure bundle products surfaced in the PropXchain-branded card.
 * Ordered cheap → comprehensive so the picker reads as a price ladder.
 * Enviro All-in-One sits between Homebuyers and Avista on price; its 15-ha
 * coverage matters for rural properties + smallholdings where Homebuyers'
 * 1-ha cap is too tight.
 */
export const groundsureBundles: SearchItem[] = [
  {
    id: 'groundsure-homescreen',
    name: 'Homescreen',
    pricePence: 6295,
    included: false,
    category: 'optional',
    turnaround: '24 hrs',
  },
  {
    id: 'groundsure-homebuyers',
    name: 'Homebuyers',
    pricePence: 9260,
    included: false,
    category: 'optional',
    turnaround: '24 hrs',
  },
  {
    id: 'groundsure-enviro-all-in-one',
    name: 'Enviro All-in-One',
    pricePence: 9820,
    included: false,
    category: 'optional',
    turnaround: '24 hrs',
  },
  {
    id: 'groundsure-avista',
    name: 'Avista',
    pricePence: 13890,
    included: false,
    category: 'optional',
    turnaround: '48 hrs',
  },
];

/** Seven single-topic Groundsure add-ons — tucked behind the collapsible disclosure in Step 3. */
export const groundsureSingles: SearchItem[] = [
  {
    id: 'groundsure-planning',
    name: 'Planning',
    pricePence: 4050,
    included: false,
    category: 'optional',
    turnaround: '24 hrs',
  },
  {
    id: 'groundsure-flood',
    name: 'Flood',
    pricePence: 4050,
    included: false,
    category: 'optional',
    turnaround: '24 hrs',
  },
  {
    id: 'groundsure-energy-transportation-residential',
    name: 'Energy and Transportation (Residential)',
    pricePence: 4050,
    included: false,
    category: 'optional',
    turnaround: '24 hrs',
  },
  {
    id: 'groundsure-georisk-residential',
    name: 'GeoRisk (Residential)',
    pricePence: 4900,
    included: false,
    category: 'optional',
    turnaround: '24 hrs',
  },
  {
    id: 'groundsure-georisk-plus',
    name: 'GeoRisk+ (Residential)',
    pricePence: 6400,
    included: false,
    category: 'optional',
    turnaround: '24 hrs',
  },
  {
    id: 'groundsure-georisk-cert-noncoal-stability',
    name: 'GeoRisk Certificate (Non-coal and Stability)',
    pricePence: 1650,
    included: false,
    category: 'optional',
    turnaround: '24 hrs',
  },
  {
    id: 'groundsure-georisk-cert-coal-brine',
    name: 'GeoRisk Certificate (Coal and Brine)',
    pricePence: 1650,
    included: false,
    category: 'optional',
    turnaround: '24 hrs',
  },
];

/** Postcode-conditional regional searches auto-added by the basket on postcode resolve. */
export const groundsureRegionals: SearchItem[] = [
  {
    id: 'groundsure-con29m-coal',
    name: 'CON29M Official Coal Mining Search',
    pricePence: 4325,
    included: false,
    category: 'area-specific',
    turnaround: '24 hrs',
  },
  {
    id: 'groundsure-cheshire-salt',
    name: 'Cheshire Salt Search',
    pricePence: 3750,
    included: false,
    category: 'area-specific',
    turnaround: '24 hrs',
  },
  {
    id: 'groundsure-metalliferous-mining',
    name: 'Regulated Metalliferous Mining Search',
    pricePence: 7500,
    included: false,
    category: 'area-specific',
    turnaround: '48 hrs',
  },
  {
    id: 'groundsure-stone-mining',
    name: 'Regulated Stone Mining Search',
    pricePence: 7500,
    included: false,
    category: 'area-specific',
    turnaround: '48 hrs',
  },
  {
    id: 'groundsure-uxo-igne-preliminary',
    name: 'Igne Preliminary UXO Risk Assessment',
    pricePence: 17500,
    included: false,
    category: 'area-specific',
    turnaround: '24 hrs',
  },
  {
    id: 'groundsure-radoncheck',
    name: 'RadonCheck',
    pricePence: 350,
    included: false,
    category: 'area-specific',
    turnaround: '24 hrs',
  },
];

/** Convenience lookup: every Groundsure-direct line item by product id. */
export const groundsureCatalogue: Record<string, SearchItem> = [
  ...groundsureBundles,
  ...groundsureSingles,
  ...groundsureRegionals,
].reduce<Record<string, SearchItem>>((acc, item) => {
  acc[item.id] = item;
  return acc;
}, {});

// ───────────────────────────────────────────────────────────────────────────
// Groundsure order codes — maps each panel SearchItem.id to the Groundsure
// `report_type` the worker /order endpoint expects. Pulled from the live PROD
// catalogue (GET /products/) on 2026-06-04. The panel items above carry RRP
// for display; this map carries the order identifier. Keep the keys in sync
// with the ids in groundsureBundles / groundsureSingles / groundsureRegionals.
// ───────────────────────────────────────────────────────────────────────────

/** SearchItem.id → Groundsure `report_type` (for groundsureService.placeOrder). */
export const groundsureProductCodes: Record<string, string> = {
  // Bundles
  'groundsure-homescreen': 'hs',
  'groundsure-homebuyers': 'homebuyers',
  'groundsure-enviro-all-in-one': 'enviro_all_in_one_res',
  'groundsure-avista': 'avista_res',
  // Singles
  'groundsure-planning': 'planning',
  'groundsure-flood': 'flood',
  'groundsure-energy-transportation-residential': 'energy_transport_res',
  'groundsure-georisk-residential': 'georisk_res',
  'groundsure-georisk-plus': 'georisk_plus_res',
  'groundsure-georisk-cert-noncoal-stability': 'georisk_cert_non_coal_res',
  'groundsure-georisk-cert-coal-brine': 'georisk_cert_coal_res',
  // Regionals
  'groundsure-con29m-coal': 'con29m_res',
  'groundsure-cheshire-salt': 'cheshire_salt',
  'groundsure-metalliferous-mining': 'metal',
  'groundsure-stone-mining': 'stone',
  'groundsure-uxo-igne-preliminary': 'igne_uxo',
  'groundsure-radoncheck': 'rc',
};

/** Resolve the Groundsure order code for a panel item id (undefined if not a Groundsure item). */
export function groundsureCodeFor(itemId: string): string | undefined {
  return groundsureProductCodes[itemId];
}
