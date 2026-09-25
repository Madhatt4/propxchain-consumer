export interface Provider {
  id: string;
  name: string;
  logo: string;
  tagline: string;
  tier: 1 | 2;
  /** Absent when no partner has quoted a figure — never fill it in by estimate. */
  price?: number;
  turnaround: string;
  rating: number;
  reviews: number;
  features: [string, string, string, string];
  highlight?: HighlightType;
  regulated: string;
  location?: string;
  postcode?: string;
  slaLoad?: number;
  distanceMiles?: number;
  /** Lender-panel badge state, stamped by decorateProviders when the buyer's
   *  lender is known. Absent everywhere else (sellers, builder, cash). */
  lenderPanelStatus?: 'on' | 'off';
  lenderPanelName?: string;
  /** Search-acceptance compatibility, stamped by decorateSearchCompatibility
   *  when the transaction's original pack-search issue date is known. Absent
   *  when the feature isn't wired in at the call site. */
  searchCompatibility?: 'accepts' | 'reorders' | 'unknown' | 'not_applicable';
  /** Short human-readable reason for the badge, e.g. "Accepts your existing searches". */
  searchCompatibilityReason?: string;
}

/** "Quote on request" when no partner has quoted — the UI never shows £0.00 or an estimate. */
export function formatProviderPrice(provider: Pick<Provider, 'price'>, priceLabel?: string): string {
  if (provider.price === undefined || provider.price <= 0) return 'Quote on request';
  return priceLabel ? `£${provider.price.toFixed(2)} ${priceLabel}` : `£${provider.price.toFixed(2)}`;
}

export type HighlightType =
  | 'Recommended'
  | 'Best Value'
  | 'Fastest'
  | 'Top Rated'
  | 'Local'
  | 'Local Expert'
  | 'Budget';

export type PriceLabel = 'inc VAT' | '+ disbursements' | 'from';

export interface ProviderPanelProps {
  title: string;
  subtitle: string;
  stageNumber: number;
  badge?: string;
  description: string;
  providers: Provider[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onSelect: (providerId: string) => void;
  selectedId?: string;
  onContinue: (providerId: string) => void;
  callout?: React.ReactNode;
  extraContent?: React.ReactNode;
  skippable?: boolean;
  onSkip?: () => void;
  priceLabel?: PriceLabel;
  compareIds?: string[];
  onCompareToggle?: (providerId: string) => void;
  onCompareClear?: () => void;
  /** Display layout: default 'grid' (2-column card grid), 'rows' for compact
   *  horizontal rows (used by ConveyancerPanel where users scan many providers). */
  layout?: 'grid' | 'rows';
}

export interface ConveyancerQuote {
  id: string;
  transactionId: string;
  conveyancerId: string;
  conveyancerName: string;
  status: 'requested' | 'quoted' | 'accepted' | 'declined' | 'expired';
  propertyAddress: string;
  titleNumber?: string;
  tenure?: string;
  transactionType: string;
  legalFee?: number;
  disbursementsEstimate?: number;
  vat?: number;
  estimatedWeeks?: number;
  conditions?: string;
  quotedAt?: string;
  acceptedAt?: string;
  createdAt: string;
}

export interface RequestQuotesPayload {
  transactionId: string;
  conveyancerIds: string[];
  transactionType: 'sale' | 'purchase' | 'new-build';
  partyName: string;
  partyEmail: string;
  propertyAddress: string;
  titleNumber?: string;
  tenure?: string;
  // Non-PII property outline rendered into the conveyancer quote email by the
  // request-conveyancer-quotes edge function. Sourced from the parsed HMLR
  // register (HmlrRegisterExtract) + EPC / PPD intel. Registered proprietor
  // NAMES are PII and intentionally excluded here — owner identity unlocks
  // only on quote acceptance. All optional; omit to send the bare email.
  classOfTitle?: string;
  chargesCount?: number;
  hasRestrictions?: boolean;
  leaseCount?: number;
  epcBand?: string;
  lastSalePrice?: string;
  lastSaleDate?: string;
}
