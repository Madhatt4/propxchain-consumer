export interface ServiceProvider {
  id: string;
  name: string;
  category: 'aml_kyc' | 'searches' | 'survey' | 'conveyancer';
  description: string;
  priceInPence: number;
  currency: 'GBP';
  averageRating: number;
  totalReviews: number;
  averageTurnaroundMinutes: number;
  isActive: boolean;
  logoInitials: string;
}

export interface ProviderReview {
  providerId: string;
  transactionId: string;
  rating: number;
  comment?: string;
  createdAt: number;
}

import type { SearchLineItem } from './searches.lineItem.types';

export interface ProviderSelection {
  stageId: string;
  providerId: string;
  /**
   * Total cost the stage contributes to the running total. For legacy
   * single-provider stages (AML, conveyancer, survey) this is the provider's
   * priceInPence. For the seller-2 searches basket this is the sum of
   * non-skipped lineItems' costPence — maintained by setBasketLineItems so
   * the existing totalCostPence aggregator continues to work unchanged.
   */
  costPence: number;
  selectedAt: number;
  completedAt?: number;
  review?: ProviderReview;
  /**
   * Present on basket-style stages (currently only seller-2). Undefined on
   * legacy single-provider stages.
   */
  lineItems?: SearchLineItem[];
}
