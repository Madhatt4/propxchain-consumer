/**
 * Exchange Signing Page — Shared Type Definitions
 *
 * Used across ExchangeSigningPage and all exchange tab components.
 * Data sourced from on-chain canister; parties array is derived for UI compat.
 */

export interface CurrentUser {
  id: string;
  principal: string;
  firstName: string;
  lastName: string;
  email: string;
  name: string;
}

export interface ExchangeFinancialTerms {
  purchasePrice: number;
  deposit: number;
  completionDate: string;
  hasMortgage?: boolean;
  mortgageAmount?: number;
  lenderName?: string;
}

/** Party entry derived from on-chain data — used by tab components */
export interface ExchangeParty {
  userId: string;
  role: string;
  name: string;
  email: string;
  verified: boolean;
  hasSigned: boolean;
  signedAt?: string;
  signature?: string;
  visualSignature?: string;
}

/** On-chain transaction data for the exchange flow */
export interface ExchangeTransaction {
  id: string;
  propertyAddress: string;
  titleNumber: string;
  propertyType: string;
  status: string;
  financialTerms: ExchangeFinancialTerms;

  /** Buyer and seller principals from on-chain record */
  buyerPrincipal: string;
  sellerPrincipal: string;

  /** Signing state — read directly from canister fields */
  buyerSigned: boolean;
  sellerSigned: boolean;
  buyerSignatureHash: string | null;
  sellerSignatureHash: string | null;

  /** Derived parties array for UI tab components */
  parties: ExchangeParty[];
  allPartiesSigned: boolean;

  /** Timestamps (ms or seconds) */
  exchangeTimestamp?: number;
  contractExchangeTimestamp: number | null;
  contractHash: string;
  blockchainTransactionId?: string;
}

export type ExchangeTabId =
  | 'overview'
  | 'seller'
  | 'buyer'
  | 'solicitors'
  | 'lender'
  | 'escrow';

export interface ExchangeTab {
  id: ExchangeTabId;
  label: string;
  icon: string;
}

export interface ProgressStep {
  id: string;
  label: string;
  isComplete: boolean;
  isActive: boolean;
}

export interface EscrowConfirmation {
  stakeholderRole: string;
  stakeholderName: string;
  confirmationCode: string;
  isConfirmed: boolean;
  confirmedAt?: string;
}

export interface LenderConfirmation {
  lenderName: string;
  confirmationCode: string;
  isConfirmed: boolean;
  confirmedAt?: string;
  mortgageAdvanceReady: boolean;
  dischargeConsentGiven: boolean;
}

/** Shared props passed to most tab components */
export interface BaseTabProps {
  transaction: ExchangeTransaction;
  currentUserRole: 'buyer' | 'seller' | 'unknown';
  themeClasses: Record<string, string>;
}
