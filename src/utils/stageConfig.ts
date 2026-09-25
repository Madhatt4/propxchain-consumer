import type { StageConfig, JourneyRole } from '../types/stage.types';

export const PROPXCHAIN_FEE_PENCE = 7500;

// Status is omitted here — it is derived at runtime based on transaction state,
// provider selections, and localStorage (for buyer stages beyond buyer-1/buyer-3 in Phase 1).
type StageConfigTemplate = Omit<StageConfig, 'status'>;

export function getSellerStages(): StageConfigTemplate[] {
  return [
    {
      id: 'seller-1',
      order: 1,
      title: 'List Property',
      description: 'List your property and verify ownership details via the Land Registry.',
      journeyRole: 'seller',
      prerequisiteStageIds: [],
      hasProviderMarketplace: false,
      serviceMode: 'real-read',
      serviceKey: 'rightmove',
    },
    {
      id: 'seller-2',
      order: 2,
      title: 'Property Searches',
      description: 'Order local authority, environmental and drainage searches.',
      journeyRole: 'seller',
      prerequisiteStageIds: [],
      hasProviderMarketplace: true,
      providerCategory: 'searches',
      serviceMode: 'real-read',
      serviceKey: 'searchflow',
    },
    {
      id: 'seller-3',
      order: 3,
      title: 'Property Info Forms',
      description: 'Complete TA6, TA10, and other required property information forms.',
      journeyRole: 'seller',
      prerequisiteStageIds: ['seller-1'],
      hasProviderMarketplace: false,
      serviceMode: 'mock',
    },
    {
      id: 'seller-4',
      order: 4,
      title: 'Buyer Progress',
      description: 'Monitor your buyer\'s progress through their journey.',
      journeyRole: 'seller',
      // SPECIAL CASE: status is derived from transaction.buyer presence, not prerequisites.
      prerequisiteStageIds: [],
      hasProviderMarketplace: false,
      serviceMode: 'mock',
    },
    {
      id: 'seller-5',
      order: 5,
      title: 'Conveyancer Review',
      description: 'Your conveyancer reviews searches, forms and raises enquiries.',
      journeyRole: 'seller',
      prerequisiteStageIds: [],
      hasProviderMarketplace: true,
      providerCategory: 'conveyancer',
      serviceMode: 'real-read',
      serviceKey: 'conveyancer',
    },
    {
      id: 'seller-6',
      order: 6,
      title: 'Contract & Exchange',
      description: 'Sign and exchange contracts to legally commit to the sale.',
      journeyRole: 'seller',
      prerequisiteStageIds: ['seller-5'],
      hasProviderMarketplace: false,
      serviceMode: 'mock',
    },
    {
      id: 'seller-7',
      order: 7,
      title: 'Completion',
      description: 'Transfer ownership and receive funds on completion day.',
      journeyRole: 'seller',
      prerequisiteStageIds: ['seller-6'],
      hasProviderMarketplace: false,
      serviceMode: 'mock',
    },
  ];
}

export function getBuyerStages(): StageConfigTemplate[] {
  return [
    {
      id: 'buyer-1',
      order: 1,
      title: 'Property Matched',
      description: 'Your property match is confirmed and the transaction is initiated.',
      journeyRole: 'buyer',
      prerequisiteStageIds: [],
      hasProviderMarketplace: false,
      serviceMode: 'mock',
    },
    {
      id: 'buyer-2',
      order: 2,
      title: 'Mortgage / Funding',
      description: 'Confirm your mortgage offer or proof of funds.',
      journeyRole: 'buyer',
      prerequisiteStageIds: ['buyer-1'],
      hasProviderMarketplace: false,
      serviceMode: 'mock',
    },
    {
      id: 'buyer-3',
      order: 3,
      title: 'Property Survey',
      description: 'Commission a survey to assess the property\'s condition and value.',
      journeyRole: 'buyer',
      prerequisiteStageIds: ['buyer-1'],
      hasProviderMarketplace: true,
      providerCategory: 'survey',
      serviceMode: 'mock',
    },
    {
      id: 'buyer-4',
      order: 4,
      title: "Review Seller's Pack",
      description: "Review the seller's search results and property information forms.",
      journeyRole: 'buyer',
      // Cross-journey dependency: blocked until the seller completes the
      // property information forms (TA6/TA10 = seller-3). Searches (seller-2)
      // are deliberately NOT a prerequisite — in UK conveyancing searches are
      // ordered later, buyer/solicitor-side, after the buyer instructs a
      // conveyancer (see PhaseIndicator), and on the starter flow seller-2 is a
      // non-self-serve paid step the seller can't complete. Gating on it left
      // the buyer's Review permanently stuck on "Waiting…".
      prerequisiteStageIds: ['seller-3'],
      hasProviderMarketplace: false,
      serviceMode: 'mock',
    },
    {
      id: 'buyer-5',
      order: 5,
      title: 'Conveyancer Enquiries',
      description: 'Your conveyancer raises and resolves enquiries with the seller.',
      journeyRole: 'buyer',
      prerequisiteStageIds: [],
      hasProviderMarketplace: true,
      providerCategory: 'conveyancer',
      serviceMode: 'real-read',
      serviceKey: 'conveyancer',
    },
    {
      id: 'buyer-6',
      order: 6,
      title: 'Contract & Exchange',
      description: 'Sign and exchange contracts to legally commit to the purchase.',
      journeyRole: 'buyer',
      prerequisiteStageIds: ['buyer-5'],
      hasProviderMarketplace: false,
      serviceMode: 'mock',
    },
    {
      id: 'buyer-7',
      order: 7,
      title: 'Completion',
      description: 'Transfer funds and receive the keys on completion day.',
      journeyRole: 'buyer',
      prerequisiteStageIds: ['buyer-6'],
      hasProviderMarketplace: false,
      serviceMode: 'mock',
    },
  ];
}

export function getStagesForJourney(role: JourneyRole): StageConfigTemplate[] {
  return role === 'seller' ? getSellerStages() : getBuyerStages();
}

// Maps canister milestone names to stage IDs.
export const MILESTONE_TO_STAGE_ID: Record<string, string> = {
  property_listed: 'seller-1',
  searches_ordered: 'seller-2',
  property_forms_complete: 'seller-3',
  buyer_found: 'seller-4',
  seller_conveyancer_instructed: 'seller-5',
  contracts_exchanged_seller: 'seller-6',
  completion_seller: 'seller-7',
  buyer_matched: 'buyer-1',
  mortgage_confirmed: 'buyer-2',
  survey_complete: 'buyer-3',
  sellers_pack_reviewed: 'buyer-4',
  buyer_conveyancer_instructed: 'buyer-5',
  contracts_exchanged_buyer: 'buyer-6',
  completion_buyer: 'buyer-7',
};
