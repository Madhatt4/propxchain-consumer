import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Principal } from '@propxchain/core-client';
import CreateTransactionForm from '../components/forms/CreateTransactionForm';
import AppTopBar from '@/components/navigation/AppTopBar';
import { icpService } from '../services/icp.service';
import { partyRoleService } from '../services/partyRole.service';
import { logger } from '../utils/logger';
import { usePrincipalId } from '../stores/authStore';

import type { RightmovePropertyListing } from '@/types/rightmove.types';
import type { PropertyListing, Tenure } from '@/types/listing.types';
import { storeRightmoveData, storeTitleNumber } from '@/utils/rightmoveStorage';

interface PropertyDetails {
  address: string;
  postcode: string;
  propertyType: 'freehold' | 'leasehold' | '';
  titleNumber: string;
  salePrice: number;
  sellerCount: 1 | 2;
  rightmoveListing?: RightmovePropertyListing;
}

const CreateTransactionPage: React.FC = () => {
  const navigate = useNavigate();
  const principalId = usePrincipalId();

  const handleSubmit = async (details: PropertyDetails): Promise<{ transactionId: string; inviteCode: string }> => {
    const isAuth = await icpService.initAuth();
    if (!isAuth) {
      throw new Error('Authentication required. Please log in again.');
    }

    const pid = principalId || '';

    // Creating a transaction is free (2026-10-15): there is no fee to take
    // first, so the transaction goes straight onto the canister. Searches,
    // HMLR pulls and the chain unlock still charge at the point of use.
    const userPrincipal = Principal.fromText(pid);
    const propertyId = `prop_${Date.now()}`;

    const result = await (await icpService.requireTransactionManager()).createTransactionWithInvite(
      propertyId,
      details.address,
      details.postcode,
      details.titleNumber || '',
      userPrincipal,
      '',
      BigInt(details.salePrice),
      'sale',
      'solicitor',
      details.propertyType || 'freehold',
      'residential',
      'diy',
      BigInt(0),
      BigInt(0),
      ''
    );

    if ('err' in result) {
      throw new Error(result.err);
    }

    const [transactionId, inviteCode] = result.ok;
    logger.info('Transaction created:', { transactionId, inviteCode });

    // The creator gets no off-chain party row otherwise (nobody invites you
    // to your own deal), so the chain-verified writer records it. Best-effort:
    // the transaction page self-heals if this misses.
    void partyRoleService.recordRoleFromChain(transactionId);

    // Store listing data so Stage 1's PropertyDetailsForm can pre-fill on
    // arrival — previously, manual entry left localStorage empty and the
    // user had to retype address/postcode/tenure/price (bug #4).
    if (details.rightmoveListing) {
      storeRightmoveData(transactionId, details.rightmoveListing);
    } else {
      // Synthesise a PropertyListing from the entry-form fields so Stage 1
      // sees the same shape it would from a real import. Fields we don't
      // collect upfront (bedrooms, EPC, agent, etc.) are left blank and
      // the user fills them in Stage 1.
      const tenure: Tenure =
        details.propertyType === 'freehold' ? 'freehold'
        : details.propertyType === 'leasehold' ? 'leasehold'
        : 'unknown';
      const manualListing: PropertyListing = {
        url: '',
        listingId: `manual-${Date.now()}`,
        source: 'manual',
        address: details.address,
        postcode: details.postcode,
        price: details.salePrice,
        propertyType: '',
        bedrooms: 0,
        tenure,
        priceQualifier: '',
        bathrooms: 0,
        description: '',
        keyFeatures: [],
        images: [],
        floorplanUrl: null,
        epcRating: null,
        agentName: '',
        agentBranch: '',
        agentLogoUrl: null,
        councilTaxBand: null,
        propertyPhrase: '',
        provenance: {},
      };
      storeRightmoveData(transactionId, manualListing);
    }

    // Title number lives in its own localStorage key so Stage 1's
    // PropertyDetailsForm can find it independently of the listing object.
    if (details.titleNumber) {
      storeTitleNumber(transactionId, details.titleNumber);
    }

    // Store party counts
    const txPartyCount = JSON.parse(localStorage.getItem('txPartyCount') || '{}');
    txPartyCount[transactionId] = { sellerCount: details.sellerCount, buyerCount: 1 };
    localStorage.setItem('txPartyCount', JSON.stringify(txPartyCount));

    // Clear onboarding flags
    localStorage.removeItem('needsOnboarding');

    return { transactionId, inviteCode };
  };

  const handleBack = () => {
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen">
      <AppTopBar title="New transaction" backTo="/dashboard" backLabel="Back to dashboard" />

      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-4 sm:py-8 px-3 sm:px-4">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6 sm:mb-8">
            <button
              onClick={handleBack}
              className="min-h-11 min-w-[44px] text-gray-600 hover:text-gray-900 flex items-center gap-2 mb-4"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Dashboard
            </button>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">List Your Property</h1>
            <p className="text-gray-600 mt-2 text-sm sm:text-base">
              Tell us about your property to get started. Takes 2 minutes.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-6">
            <CreateTransactionForm onSubmit={handleSubmit} />
          </div>

          {/* Help Section */}
          <div className="mt-6 sm:mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold text-blue-900 mb-3">What happens next?</h3>
            <ul className="space-y-2 text-blue-800">
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>A unique transaction will be created on the blockchain</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Share the invite code with the buyer to join your transaction</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Complete your TA6 and TA10 property information forms</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateTransactionPage;
