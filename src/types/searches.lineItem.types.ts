/**
 * Line-item state for the seller-2 searches basket.
 *
 * The hybrid searches panel composes a basket from three sources:
 *   1. an integrator package (tmGroup or Landmark) — Step 1
 *   2. postcode-required regional searches — Step 2 (auto-added)
 *   3. opt-in bundles and single-topic add-ons — Step 3
 *
 * Each basket entry is one SearchLineItem. The line items live as an array
 * on the stage's ProviderSelection.lineItems, and ProviderSelection.costPence
 * is the sum of non-skipped lineItems' costPence so the existing TopBar
 * running-total aggregator keeps working without changes.
 */

export type SearchLineItemSource =
  | 'integrator-tmgroup'
  | 'integrator-landmark'
  | 'groundsure-bundle'
  | 'groundsure-single'
  | 'groundsure-regional';

export type SearchLineItemStatus =
  | 'in-basket'
  | 'ordered'
  | 'skipped';

export interface SearchLineItem {
  /** Stable product id matching SearchItem.id in searchProviderData.ts. */
  productId: string;
  /** Display name shown to the user. */
  name: string;
  /** Displayed price in pence (provider RRP). Excluded from totals when status === 'skipped'. */
  costPence: number;
  /** Source category — drives UI grouping in the panel. */
  source: SearchLineItemSource;
  /** True when auto-added by the postcode region mapping. */
  isRegionallyRequired: boolean;
  /** Lifecycle state of this individual line item. */
  status: SearchLineItemStatus;
  /** Set when the user opts out of a postcode-required item via the skip modal. */
  skipReason?: 'user-opted-out';
  /** Set when status === 'ordered'. Milliseconds since epoch. */
  orderedAt?: number;
  /** Supabase search_orders row id returned by searchOrderService.createOrder. */
  orderId?: string;
  /** Display copy for turnaround (e.g. '24 hrs', '48 hrs'). Not used in any logic. */
  turnaround?: string;
}
