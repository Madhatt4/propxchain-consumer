// Transaction Types for PropXchain DIY Conveyancing System

import {
  LandRegistryAddress,
  LandRegistryData
} from '../services/landRegistryService';
import type { SolicitorRecord } from './solicitor.types';
import type { LandRegistryIntegration } from '@/types/landRegistry';

export type TransactionMode = 'diy' | 'hybrid' | 'professional';
// The five on-chain states, one source of truth; see transactionStatus.ts.
import type { TransactionStatus } from './transactionStatus';
export type { TransactionStatus };
export type DocumentStatus = 'required' | 'uploaded' | 'verified' | 'rejected';
export type VerificationLevel = 0 | 1 | 2 | 3;
export type PartyRole = 'seller' | 'buyer' | 'seller-solicitor' | 'buyer-solicitor' | 'solicitor' | 'estate-agent';

export interface ComplexityAssessment {
  // Critical factors
  hasBuyerMortgage: boolean;
  hasSellerMortgage: boolean;

  // Complexity factors
  propertyType: 'freehold' | 'leasehold' | 'shared-ownership' | 'commonhold' | '';
  propertyCategory: 'residential' | 'commercial' | '';
  buildingHeight: 'under-18m' | '18m-plus' | '';
  heritageStatus: 'none' | 'listed-grade1' | 'listed-grade2' | 'conservation-area' | '';
  isNewBuild: boolean;
  hasDisputes: boolean;

  // Calculated risk
  complexityScore: number; // 0-100
  recommendedMode: TransactionMode;
  riskWarnings: string[];
  canDoDIY: boolean;
}

export interface Party {
  userId: string;
  role: PartyRole;
  email: string;
  name: string;
  verified: boolean;
  invitedAt?: string;
  joinedAt?: string;
}

export interface Document {
  id: string;
  transactionId: string;
  type: string;
  category: 'seller' | 'buyer' | 'shared';
  name: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedBy: string;
  uploadedAt: string;
  status: DocumentStatus;
  verifiedBy?: string;
  verifiedAt?: string;
  notes?: string;
  required: boolean;
  storageDocumentId?: number; // ICP document_storage canister ID
  verificationDocumentId?: number; // ICP document_verification canister ID
  hash: string; // SHA-256 file hash for integrity verification
}

export interface DocumentRequirement {
  type: string;
  name: string;
  description: string;
  category: 'seller' | 'buyer' | 'shared';
  required: boolean;
  requiredFor: TransactionMode[];
  estimatedCost?: string;
  processingTime?: string;
  howToObtain?: string;
}

export interface Milestone {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed' | 'skipped';
  completedAt?: string;
  dueDate?: string;
  order: number;
}

export interface Transaction {
  id: string;

  // Basic info
  propertyAddress: string;
  propertyType: string;
  propertyCategory?: string;
  transactionType: 'sale' | 'purchase' | 'lease';

  // Mode and complexity
  mode: TransactionMode;
  complexityAssessment?: ComplexityAssessment;

  // Status
  status: TransactionStatus;
  createdAt: string | number;
  updatedAt?: string;
  completedAt?: string;

  // User info
  userRole?: string;
  buildingHeight?: string;
  heritageStatus?: string;
  constructionAge?: string;

  // Parties (legacy single buyer/seller)
  createdBy: string;
  parties: Party[];
  seller?: string;
  buyer?: string;
  solicitor?: string;

  // Multi-party support (N buyers and N sellers)
  buyers?: import('./multiParty.types').TransactionParty[];
  sellers?: import('./multiParty.types').TransactionParty[];

  // Property details
  propertyId?: string;
  postcode?: string;
  titleNumber?: string;
  amount?: number;

  // Additional transaction fields
  oldStatus?: string;
  inviteCode?: string;
  accessList?: string[];
  chainedTransactions?: any[];
  chainPosition?: number | null;
  blockchainCompletedAt?: number | null;
  landRegistryRegisteredAt?: number | null;
  landRegistryIntegration?: LandRegistryIntegration; // HMLR integration status (applications, requisitions) for display
  blockchainTransactionId?: string;
  deposit?: number;
  mortgageAmount?: number;
  completionDate?: string;
  specialConditions?: string;
  fixturesFittings?: any;
  apportionments?: string;
  previousOwner?: string;

  // Wizard data (from existing system)
  wizardData?: any;

  // Documents
  documents: Document[];

  // Process tracking
  milestones: Milestone[];

  // TA6 Data (supports both old string format and new structured format)
  ta6Data?: {
    propertyAddress: string | LandRegistryAddress;  // Can be string (old) or structured (new)
    landRegistryData?: LandRegistryData;            // Land Registry price history data
    sellerNames: string;
    propertyTenure: string;
    boundaries: string;
    disputes: { type: string; details: string };
    notices: { type: string; details: string };
    alterations: { type: string; details: string };
    guarantees: string;
    insurance: string;
    environmentalMatters: { issues: any[]; details: string };
    rightsAndEasements: string;
    services: string;
    connectionAgreements: string;
    transactionDetails: string;
  };

  // TA7 Data (Leasehold Information Form)
  ta7Data?: {
    leaseDetails?: any;
    serviceCharges?: any;
    groundRent?: any;
    buildingInsurance?: any;
    managingAgent?: any;
    majorWorks?: any;
    restrictions?: any;
  };

  // TA10 Data (Fittings and Contents Form)
  ta10Data?: {
    fixturesIncluded?: any;
    fittingsIncluded?: any;
    contentsIncluded?: any;
    itemsExcluded?: any;
  };

  // Encumbrances
  encumbrances?: {
    mortgages: { type: string; details: string };
    restrictiveCovenants: string;
    easements: string;
    rightsOfWay: any[];
    planningPermissions: string;
    buildingRegulations: string;
    partyWalls: string;
    chancelRepair: string;
  };

  // Contracts
  draftContract?: any;
  finalContract?: any;

  // Financial
  financialTerms: {
    purchasePrice: number;
    deposit: number;
    completionDate: string;
    hasMortgage?: boolean; // True if buyer has mortgage, false if cash buyer
    mortgageAmount?: number;
    specialConditions?: string;
    fixturesFittings?: {
      standardItems: string[];
      additionalItems: string;
    };
    apportionments?: string;
  };

  // Solicitor assignments
  buyerSolicitor?: SolicitorRecord | null;
  sellerSolicitor?: SolicitorRecord | null;

  // Notes and communication
  notes?: string;
  lastActivity?: string;
}

export interface TransactionSummary {
  id: string;
  propertyAddress: string;
  status: TransactionStatus;
  mode: TransactionMode;
  createdAt: string;
  updatedAt: string;
  progressPercentage: number;
  nextAction: string;
}

// Document requirements by mode (aligned with UK property conveyancing standards)
export const DOCUMENT_REQUIREMENTS: DocumentRequirement[] = [
  // === SELLER DOCUMENTS (Required) ===
  {
    type: 'seller-id',
    name: 'Proof of Identity',
    description: 'Valid photo ID (Passport or UK Driving License)',
    category: 'seller',
    required: true,
    requiredFor: ['diy', 'hybrid', 'professional'],
    howToObtain: 'Scan or photograph your passport or driving license'
  },
  {
    type: 'seller-proof-of-address',
    name: 'Proof of Address',
    description: 'Recent utility bill or bank statement (less than 3 months old)',
    category: 'seller',
    required: true,
    requiredFor: ['diy', 'hybrid', 'professional'],
    howToObtain: 'Scan a recent utility bill or bank statement'
  },
  {
    type: 'title-deeds',
    name: 'Title Deeds',
    description: 'Official register from HM Land Registry',
    category: 'seller',
    required: true,
    requiredFor: ['diy', 'hybrid', 'professional'],
    estimatedCost: '£3-£7',
    howToObtain: 'Download from GOV.UK Land Registry portal'
  },
  {
    type: 'ta6-form',
    name: 'TA6 Property Information Form',
    description: 'Law Society standard property questionnaire',
    category: 'seller',
    required: true,
    requiredFor: ['diy', 'hybrid', 'professional'],
    howToObtain: 'Complete through PropXchain wizard (Phase 3) or download template'
  },
  {
    type: 'ta10-form',
    name: 'TA10 Fittings & Contents Form',
    description: 'List of fixtures staying vs fittings included in sale',
    category: 'seller',
    required: true,
    requiredFor: ['diy', 'hybrid', 'professional'],
    howToObtain: 'Upload completed TA10 form or use PropXchain template'
  },
  {
    type: 'epc-certificate',
    name: 'Energy Performance Certificate (EPC)',
    description: 'Valid EPC (less than 10 years old)',
    category: 'seller',
    required: true,
    requiredFor: ['diy', 'hybrid', 'professional'],
    estimatedCost: '£60-£120',
    howToObtain: 'Order from accredited assessor or check existing at epcregister.com'
  },

  // === SELLER DOCUMENTS (Optional) ===
  {
    type: 'local-authority-search',
    name: 'Local Authority Search (LLC1 & CON29)',
    description: 'Planning, building control, roads, and environmental checks',
    category: 'seller',
    required: false,
    requiredFor: ['diy', 'hybrid', 'professional'],
    estimatedCost: '£100-£300',
    processingTime: '10-20 working days',
    howToObtain: 'Order from local council website'
  },
  {
    type: 'environmental-search',
    name: 'Environmental Search',
    description: 'Contamination, flooding, radon risks',
    category: 'seller',
    required: false,
    requiredFor: ['diy', 'hybrid', 'professional'],
    estimatedCost: '£50-£100',
    processingTime: '5-10 working days',
    howToObtain: 'Order from search provider'
  },
  {
    type: 'water-drainage-search',
    name: 'Water & Drainage Search',
    description: 'Water supply and sewerage information',
    category: 'seller',
    required: false,
    requiredFor: ['diy', 'hybrid', 'professional'],
    estimatedCost: '£40-£80',
    processingTime: '5-10 working days',
    howToObtain: 'Order from water company'
  },

  // === BUYER DOCUMENTS (Required) ===
  {
    type: 'buyer-id',
    name: 'Proof of Identity',
    description: 'Valid photo ID (Passport or UK Driving License)',
    category: 'buyer',
    required: true,
    requiredFor: ['diy', 'hybrid', 'professional'],
    howToObtain: 'Scan or photograph your passport or driving license'
  },
  {
    type: 'buyer-proof-of-address',
    name: 'Proof of Address',
    description: 'Recent utility bill or bank statement (less than 3 months old)',
    category: 'buyer',
    required: true,
    requiredFor: ['diy', 'hybrid', 'professional'],
    howToObtain: 'Scan a recent utility bill or bank statement'
  },
  {
    type: 'proof-of-funds',
    name: 'Proof of Funds',
    description: 'Bank statements showing available funds or evidence of gift',
    category: 'buyer',
    required: true,
    requiredFor: ['diy', 'hybrid', 'professional'],
    howToObtain: 'Download recent bank statements (last 3 months) or gift letter'
  },

  // === BUYER DOCUMENTS (Conditional - Mortgage) ===
  {
    type: 'mortgage-agreement',
    name: 'Mortgage Agreement in Principle',
    description: 'Formal mortgage offer from lender',
    category: 'buyer',
    required: false,
    requiredFor: ['professional'], // Only if mortgage involved
    howToObtain: 'Obtain from your mortgage lender'
  },

  // === SHARED DOCUMENTS ===
  {
    type: 'property-searches',
    name: 'Property Searches',
    description: 'Local authority (LLC1 & CON29), environmental, water/drainage searches',
    category: 'shared',
    required: true,
    requiredFor: ['diy', 'hybrid', 'professional'],
    estimatedCost: '£250-£500',
    processingTime: '10-20 working days',
    howToObtain: 'Order from local council or search provider'
  },
  {
    type: 'survey-report',
    name: 'Survey Report',
    description: 'Structural survey or homebuyer report (optional but recommended)',
    category: 'shared',
    required: false,
    requiredFor: ['diy', 'hybrid', 'professional'],
    estimatedCost: '£400-£1,500',
    processingTime: '1-2 weeks',
    howToObtain: 'Commission from RICS surveyor'
  }
];

// Default milestones by mode
export const getDefaultMilestones = (mode: TransactionMode): Milestone[] => {
  const baseMilestones: Milestone[] = [
    {
      id: 'milestone-1',
      name: 'Initial Information Collected',
      description: 'Property wizard completed',
      status: 'completed',
      order: 1,
      completedAt: new Date().toISOString()
    },
    {
      id: 'milestone-2',
      name: 'Documents Collected',
      description: 'All required documents uploaded',
      status: 'pending',
      order: 2
    },
    {
      id: 'milestone-3',
      name: 'Searches Ordered',
      description: 'Property searches commissioned',
      status: 'pending',
      order: 3
    },
    {
      id: 'milestone-4',
      name: 'Searches Completed',
      description: 'All search results received',
      status: 'pending',
      order: 4
    },
    {
      id: 'milestone-5',
      name: 'Draft Contract Prepared',
      description: 'Contract drafted and reviewed',
      status: 'pending',
      order: 5
    }
  ];

  if (mode === 'diy') {
    return [
      ...baseMilestones,
      {
        id: 'milestone-6',
        name: 'Contract Exchange',
        description: 'Contracts signed and deposit paid',
        status: 'pending',
        order: 6
      },
      {
        id: 'milestone-7',
        name: 'Completion',
        description: 'Final payment and keys exchanged',
        status: 'pending',
        order: 7
      },
      {
        id: 'milestone-8',
        name: 'Land Registry Application',
        description: 'Transfer registered with HM Land Registry',
        status: 'pending',
        order: 8
      }
    ];
  }

  return baseMilestones;
};
