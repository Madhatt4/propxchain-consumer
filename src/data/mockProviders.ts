import type { ServiceProvider } from '../types/provider.types';

const MOCK_PROVIDERS: ServiceProvider[] = [
  // AML/KYC providers
  {
    id: 'aml-shieldpay',
    name: 'ShieldPay',
    category: 'aml_kyc',
    description: 'Fast automated AML and KYC checks with instant results.',
    priceInPence: 300,
    currency: 'GBP',
    averageRating: 4.8,
    totalReviews: 89,
    averageTurnaroundMinutes: 10,
    isActive: true,
    logoInitials: 'SP',
  },
  {
    id: 'aml-binderr',
    name: 'Binderr',
    category: 'aml_kyc',
    description: 'Comprehensive identity verification and AML screening.',
    priceInPence: 250,
    currency: 'GBP',
    averageRating: 4.2,
    totalReviews: 142,
    averageTurnaroundMinutes: 15,
    isActive: true,
    logoInitials: 'BI',
  },
  {
    id: 'aml-smartsearch',
    name: 'SmartSearch',
    category: 'aml_kyc',
    description: 'Thorough AML checks with detailed audit trail.',
    priceInPence: 180,
    currency: 'GBP',
    averageRating: 3.4,
    totalReviews: 67,
    averageTurnaroundMinutes: 120,
    isActive: true,
    logoInitials: 'SS',
  },
  // Search providers
  {
    id: 'search-searchflow',
    name: 'SearchFlow / Landmark',
    category: 'searches',
    description: 'Official local authority and environmental property searches.',
    priceInPence: 18000,
    currency: 'GBP',
    averageRating: 4.5,
    totalReviews: 203,
    averageTurnaroundMinutes: 4320,
    isActive: true,
    logoInitials: 'SF',
  },
  // Survey providers
  {
    id: 'survey-sdl',
    name: 'SDL Surveying',
    category: 'survey',
    description: 'RICS-accredited surveyors with nationwide coverage.',
    priceInPence: 45000,
    currency: 'GBP',
    averageRating: 4.3,
    totalReviews: 156,
    averageTurnaroundMinutes: 7200,
    isActive: true,
    logoInitials: 'SDL',
  },
  {
    id: 'survey-homecheck',
    name: 'HomeCheck',
    category: 'survey',
    description: 'Digital-first surveying with rapid turnaround.',
    priceInPence: 38000,
    currency: 'GBP',
    averageRating: 4.0,
    totalReviews: 78,
    averageTurnaroundMinutes: 4320,
    isActive: true,
    logoInitials: 'HC',
  },
  {
    id: 'survey-localsurvey',
    name: 'LocalSurvey',
    category: 'survey',
    description: 'Locally-based surveyors with deep regional knowledge.',
    priceInPence: 29500,
    currency: 'GBP',
    averageRating: 3.8,
    totalReviews: 45,
    averageTurnaroundMinutes: 10080,
    isActive: true,
    logoInitials: 'LS',
  },
  // Conveyancer fallback providers
  {
    id: 'conv-fallback-1',
    name: 'Smith & Partners',
    category: 'conveyancer',
    description: 'Established conveyancing firm with decades of experience.',
    priceInPence: 0,
    currency: 'GBP',
    averageRating: 4.6,
    totalReviews: 112,
    averageTurnaroundMinutes: 0,
    isActive: true,
    logoInitials: 'S&P',
  },
  {
    id: 'conv-fallback-2',
    name: 'Quick Convey',
    category: 'conveyancer',
    description: 'Streamlined online conveyancing for faster completions.',
    priceInPence: 0,
    currency: 'GBP',
    averageRating: 4.1,
    totalReviews: 89,
    averageTurnaroundMinutes: 0,
    isActive: true,
    logoInitials: 'QC',
  },
];

export const MOCK_AML_PROVIDERS: ServiceProvider[] = MOCK_PROVIDERS.filter(
  (p) => p.category === 'aml_kyc',
);

export const MOCK_SURVEY_PROVIDERS: ServiceProvider[] = MOCK_PROVIDERS.filter(
  (p) => p.category === 'survey',
);

export const MOCK_CONVEYANCER_PROVIDERS: ServiceProvider[] = MOCK_PROVIDERS.filter(
  (p) => p.category === 'conveyancer',
);

export function getProvidersByCategory(
  category: ServiceProvider['category'],
): ServiceProvider[] {
  return MOCK_PROVIDERS.filter((p) => p.category === category && p.isActive);
}

export default MOCK_PROVIDERS;
