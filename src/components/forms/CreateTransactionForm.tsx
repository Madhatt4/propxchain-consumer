import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, MapPin, Hash, FileText, Users, ArrowRight, Search, History, CheckCircle } from 'lucide-react';
import { logger } from '@/utils/logger';
import {
  fetchPriceHistory,
  PricePaidRecord,
  formatPrice,
  formatFullDate,
  getPropertyTypeLabel,
  getTenureLabel,
  isValidPostcode,
  formatPostcode,
} from '@/services/landRegistryService';
import RightmoveImport from './RightmoveImport';
import type { RightmovePropertyListing } from '@/types/rightmove.types';
import { useIsAdmin } from '@/hooks/useIsAdmin';

interface PropertyDetails {
  address: string;
  postcode: string;
  propertyType: 'freehold' | 'leasehold' | '';
  titleNumber: string;
  salePrice: number;
  sellerCount: 1 | 2;
  lastSalePrice?: number;
  lastSaleDate?: string;
  rightmoveListing?: RightmovePropertyListing;
}

interface CreateTransactionFormProps {
  onSubmit: (details: PropertyDetails) => Promise<{ transactionId: string; inviteCode: string }>;
}

const CreateTransactionForm: React.FC<CreateTransactionFormProps> = ({ onSubmit }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<PropertyDetails>({
    address: '',
    postcode: '',
    propertyType: '',
    titleNumber: '',
    salePrice: 0,
    sellerCount: 1,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSessionExpired, setIsSessionExpired] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  // Tier picked on the previous page (StartTransactionPage). Captured once at
  // mount; defaults to 'starter' because Starter is the safer default — the
  // Premium-only pricing copy must never show to a user who didn't pick
  // Premium.
  const [tier] = useState<'starter' | 'premium'>(() =>
    typeof window !== 'undefined' && localStorage.getItem('pendingTier') === 'premium'
      ? 'premium'
      : 'starter'
  );

  // Admins (canister-authoritative — see useIsAdmin) see the full feature
  // surface regardless of which tier they picked, so they can QA every
  // variant without switching accounts.
  const { isAdmin } = useIsAdmin();
  const showPremiumDetails = tier === 'premium' || isAdmin;

  // Land Registry search state
  const [priceHistory, setPriceHistory] = useState<PricePaidRecord[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<PricePaidRecord | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [rightmoveListing, setRightmoveListing] = useState<RightmovePropertyListing | null>(null);

  // Postcode search function
  const handlePostcodeSearch = useCallback(async () => {
    const postcode = formData.postcode.trim();

    if (!postcode) {
      setSearchError('Please enter a postcode');
      return;
    }

    if (!isValidPostcode(postcode)) {
      setSearchError('Invalid postcode format');
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setPriceHistory([]);
    setSelectedProperty(null);
    setHasSearched(true);

    try {
      const result = await fetchPriceHistory(postcode);

      if (result.success) {
        setPriceHistory(result.records);
        if (result.records.length === 0) {
          setSearchError('No properties found for this postcode. You can still enter details manually.');
        }
      } else {
        setSearchError(result.error || 'Failed to search Land Registry');
      }
    } catch (err) {
      setSearchError('Failed to connect to Land Registry. You can still enter details manually.');
      logger.error('Land Registry search error:', err);
    } finally {
      setIsSearching(false);
    }
  }, [formData.postcode]);

  // Select a property from search results
  const handleSelectProperty = useCallback((record: PricePaidRecord) => {
    setSelectedProperty(record);

    // Build full address from record
    const addressParts: string[] = [];
    if (record.saon) addressParts.push(record.saon);
    if (record.paon) addressParts.push(record.paon);
    if (record.street) addressParts.push(record.street);
    if (record.locality) addressParts.push(record.locality);
    if (record.townCity) addressParts.push(record.townCity);
    if (record.county) addressParts.push(record.county);

    const fullAddress = addressParts.join(', ');

    // Determine property type from record
    let propertyType: 'freehold' | 'leasehold' | '' = '';
    if (record.duration === 'F') propertyType = 'freehold';
    else if (record.duration === 'L') propertyType = 'leasehold';

    setFormData(prev => ({
      ...prev,
      address: fullAddress,
      postcode: formatPostcode(record.postcode),
      propertyType: propertyType,
      lastSalePrice: record.price,
      lastSaleDate: record.dateOfTransfer,
    }));
  }, []);

  // Handle Rightmove import — fill form fields from scraped listing
  const handleRightmoveImport = useCallback((listing: RightmovePropertyListing) => {
    let propertyType: 'freehold' | 'leasehold' | '' = '';
    if (listing.tenure === 'freehold') propertyType = 'freehold';
    else if (listing.tenure === 'leasehold') propertyType = 'leasehold';

    setFormData(prev => ({
      ...prev,
      address: listing.address,
      postcode: listing.postcode,
      propertyType,
      salePrice: listing.price,
    }));
    setRightmoveListing(listing);

    // Clear any previous Land Registry search state
    setSelectedProperty(null);
    setPriceHistory([]);
    setHasSearched(false);
    setSearchError(null);
  }, []);

  const handleFieldChange = (field: keyof PropertyDetails, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Address typers naturally include the postcode at the end of the address
  // (e.g. "1 High Street, Sandy, Bedfordshire, SG19 1AA"). Pull it out so the
  // hidden-required postcode field is populated automatically — no need to
  // make the user fill the same data twice.
  // UK postcode regex covers all formats: AA9A 9AA, A9A 9AA, A9 9AA, A99 9AA,
  // AA9 9AA, AA99 9AA. We auto-fill ONLY when postcode is currently empty so we
  // never overwrite something the user typed deliberately.
  const UK_POSTCODE = /\b([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\b/i;
  const handleAddressChange = (value: string) => {
    setFormData((prev) => {
      const next: PropertyDetails = { ...prev, address: value };
      if (!prev.postcode.trim()) {
        const match = value.match(UK_POSTCODE);
        if (match) {
          next.postcode = `${match[1]} ${match[2]}`.toUpperCase();
        }
      }
      return next;
    });
  };

  const handleNext = () => {
    // Validate step 1
    if (!formData.address || !formData.postcode || !formData.propertyType) {
      setError('Please complete all required fields');
      return;
    }
    setError(null);
    setStep(2);
  };

  const handleBack = () => {
    setStep(1);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all fields
    if (!formData.address || !formData.postcode || !formData.propertyType) {
      setError('Please complete all required fields');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const submitData = rightmoveListing
        ? { ...formData, rightmoveListing }
        : formData;
      const result = await onSubmit(submitData);

      // Navigate straight to the canonical transaction flow page.
      // Inline `state` is preserved for any consumer (e.g. confetti banner)
      // that keys off `justCreated` on first render.
      navigate(`/transaction/${result.transactionId}/flow`, {
        state: {
          inviteCode: result.inviteCode,
          justCreated: true,
        },
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create transaction';

      // Detect delegation/signature expiry error
      if (errorMessage.includes('Invalid signature') || errorMessage.includes('signature could not be verified')) {
        setError('Your session has expired. Please log out and log back in to refresh your authentication.');
        setIsSessionExpired(true);
        logger.error('Delegation expiry detected - user needs to re-authenticate');
      } else {
        setError(errorMessage);
        setIsSessionExpired(false);
      }
      logger.error('Transaction creation error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b dark:border-slate-700">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">Create New Property Transaction</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Step {step} of 2: {step === 1 ? 'Property Details' : 'Transaction Details'}
          </p>
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-gray-200 dark:bg-slate-700">
          <div
            className="h-full bg-blue-600 transition-all duration-300"
            style={{ width: `${(step / 2) * 100}%` }}
          />
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6">
          {/* Error message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/50 rounded-md">
              <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
              {isSessionExpired && (
                <button
                  type="button"
                  onClick={() => navigate('/login?expired=true')}
                  className="mt-3 h-11 px-4 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 transition-colors"
                >
                  Log Out & Re-authenticate
                </button>
              )}
            </div>
          )}

          {/* Step 1: Property Details */}
          {step === 1 && (
            <div className="space-y-6">
              {/* Rightmove Import */}
              <RightmoveImport onImport={handleRightmoveImport} />

              {/* Postcode Section — dual-purpose: required postcode field
                  AND a trigger for Land Registry property lookup. The * is
                  important: validation rejects the form if postcode is empty,
                  but the previous label ("Search by Postcode") read as
                  optional and trapped manual-entry users. */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/50 rounded-lg p-4">
                <label
                  htmlFor="property-postcode"
                  className="flex items-center gap-2 text-sm font-medium text-blue-900 dark:text-blue-200 mb-2"
                >
                  <Search className="w-4 h-4" />
                  Postcode <span className="text-red-600">*</span>
                  <span className="text-blue-700 dark:text-blue-300 font-normal text-xs ml-1">
                    (auto-fills from address; press Search to look up Land Registry)
                  </span>
                </label>
                <div className="flex gap-2">
                  <input
                    id="property-postcode"
                    name="postcode"
                    autoComplete="postal-code"
                    type="text"
                    value={formData.postcode}
                    onChange={(e) => handleFieldChange('postcode', e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handlePostcodeSearch())}
                    className="flex-1 h-11 px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 text-base dark:bg-slate-700 dark:border-blue-700 dark:text-gray-100"
                    placeholder="e.g., SW1A 1AA"
                  />
                  <button
                    type="button"
                    onClick={handlePostcodeSearch}
                    disabled={isSearching}
                    className="min-h-11 min-w-[44px] px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isSearching ? (
                      <>
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Searching...
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4" />
                        Search
                      </>
                    )}
                  </button>
                </div>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
                  Enter a postcode to find properties with Land Registry price history
                </p>
              </div>

              {/* Search Error */}
              {searchError && (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/50 rounded-md">
                  <p className="text-sm text-yellow-800 dark:text-yellow-300">{searchError}</p>
                </div>
              )}

              {/* Search Results */}
              {priceHistory.length > 0 && (
                <div className="border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 dark:bg-slate-800/50 px-4 py-3 border-b border-gray-200 dark:border-slate-700">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                      <History className="w-4 h-4" />
                      Properties Found ({priceHistory.length} results)
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Click a property to select it. Data from HM Land Registry.
                    </p>
                  </div>
                  <div className="max-h-64 overflow-y-auto divide-y divide-gray-100 dark:divide-slate-700">
                    {priceHistory.slice(0, 20).map((record, idx) => {
                      const isSelected = selectedProperty?.transactionId === record.transactionId;
                      const addressLine = `${record.paon || ''} ${record.street || ''}`.trim();

                      return (
                        <button
                          key={record.transactionId || idx}
                          type="button"
                          onClick={() => handleSelectProperty(record)}
                          className={`w-full min-h-11 px-4 py-3 text-left hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors ${
                            isSelected ? 'bg-blue-100 dark:bg-blue-900/30 border-l-4 border-blue-600' : ''
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                {isSelected && <CheckCircle className="w-4 h-4 text-blue-600" />}
                                {addressLine}
                                {record.saon && <span className="text-gray-500 dark:text-gray-400">({record.saon})</span>}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                {record.townCity}{record.county ? `, ${record.county}` : ''} - {formatPostcode(record.postcode)}
                              </p>
                            </div>
                            <div className="text-right ml-4">
                              <p className="text-sm font-semibold text-green-700 dark:text-green-300">
                                {formatPrice(record.price)}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {formatFullDate(record.dateOfTransfer)}
                              </p>
                              <p className="text-xs text-gray-400">
                                {getPropertyTypeLabel(record.propertyType)} · {getTenureLabel(record.duration)}
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {priceHistory.length > 20 && (
                    <div className="px-4 py-2 bg-gray-50 dark:bg-slate-800/50 border-t dark:border-slate-700 text-xs text-gray-500 dark:text-gray-400">
                      Showing first 20 of {priceHistory.length} results
                    </div>
                  )}
                </div>
              )}

              {/* Selected Property Banner */}
              {selectedProperty && (
                <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700/50 rounded-lg">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-green-900 dark:text-green-200">Property Selected</p>
                      <p className="text-sm text-green-800 dark:text-green-300 mt-1">{formData.address}</p>
                      <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                        Last sold for {formatPrice(selectedProperty.price)} on {formatFullDate(selectedProperty.dateOfTransfer)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Manual Entry Section (always visible) */}
              <div className={`space-y-4 ${hasSearched && !selectedProperty ? 'opacity-100' : selectedProperty ? 'opacity-60' : 'opacity-100'}`}>
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  <div className="flex-1 h-px bg-gray-200 dark:bg-slate-700" />
                  <span>{selectedProperty ? 'Edit Details' : 'Or Enter Manually'}</span>
                  <div className="flex-1 h-px bg-gray-200 dark:bg-slate-700" />
                </div>

                <div>
                  <label
                    htmlFor="property-address"
                    className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    <MapPin className="w-4 h-4" />
                    Property Address <span className="text-red-600">*</span>
                  </label>
                  <textarea
                    id="property-address"
                    name="address"
                    autoComplete="street-address"
                    value={formData.address}
                    onChange={(e) => handleAddressChange(e.target.value)}
                    required
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 text-base dark:bg-slate-700 dark:border-slate-600 dark:text-gray-100"
                    placeholder="Enter full property address including house number/name, street, town/city, postcode"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Building2 className="w-4 h-4" />
                  Property Type <span className="text-red-600">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <button
                    type="button"
                    onClick={() => handleFieldChange('propertyType', 'freehold')}
                    aria-pressed={formData.propertyType === 'freehold'}
                    className={`min-h-11 p-3 sm:p-4 border-2 rounded-lg transition-all ${
                      formData.propertyType === 'freehold'
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-300 dark:border-slate-600 hover:border-blue-400'
                    }`}
                  >
                    <Building2 className={`w-7 h-7 sm:w-8 sm:h-8 mx-auto mb-2 ${
                      formData.propertyType === 'freehold' ? 'text-blue-600' : 'text-gray-400'
                    }`} />
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Freehold</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Own the property and land</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleFieldChange('propertyType', 'leasehold')}
                    aria-pressed={formData.propertyType === 'leasehold'}
                    className={`min-h-11 p-3 sm:p-4 border-2 rounded-lg transition-all ${
                      formData.propertyType === 'leasehold'
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-300 dark:border-slate-600 hover:border-blue-400'
                    }`}
                  >
                    <FileText className={`w-7 h-7 sm:w-8 sm:h-8 mx-auto mb-2 ${
                      formData.propertyType === 'leasehold' ? 'text-blue-600' : 'text-gray-400'
                    }`} />
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Leasehold</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Lease the property for a fixed term</p>
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="property-title-number"
                  className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  <Hash className="w-4 h-4" />
                  Title Number (optional)
                </label>
                <input
                  id="property-title-number"
                  name="titleNumber"
                  type="text"
                  value={formData.titleNumber}
                  onChange={(e) => handleFieldChange('titleNumber', e.target.value.toUpperCase())}
                  className="w-full h-11 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 text-base dark:bg-slate-700 dark:border-slate-600 dark:text-gray-100"
                  placeholder="e.g., AGL123456"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  If known, this speeds up the Land Registry lookup
                </p>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  type="button"
                  onClick={handleNext}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 h-11 px-6 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-base"
                >
                  Next
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Transaction Details */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <label
                  htmlFor="property-sale-price"
                  className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Sale Price (£) <span className="text-red-600">*</span>
                </label>
                <input
                  id="property-sale-price"
                  name="salePrice"
                  type="number"
                  value={formData.salePrice || ''}
                  onChange={(e) => handleFieldChange('salePrice', parseInt(e.target.value) || 0)}
                  required
                  min="0"
                  className="w-full h-11 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 text-base dark:bg-slate-700 dark:border-slate-600 dark:text-gray-100"
                  placeholder="0"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Agreed sale price for the property
                </p>
              </div>

              {/* Cost Breakdown — Premium users see the full breakdown;
                  admins see it too (regardless of tier) for QA review. */}
              {showPremiumDetails ? (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-200 mb-3">PropXchain Cost Breakdown</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-amber-800 dark:text-amber-300">AI co-pilot (Premium, optional)</span>
                      <span className="font-semibold text-amber-900 dark:text-amber-200">£75</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-amber-800 dark:text-amber-300">Property searches</span>
                      <span className="font-medium text-amber-700 dark:text-amber-300">£50–450</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-amber-800 dark:text-amber-300">Conveyancer (reserved acts)</span>
                      <span className="font-medium text-amber-700 dark:text-amber-300">Quote per transaction</span>
                    </div>
                    <div className="border-t border-amber-300 dark:border-amber-700/50 pt-2 mt-2 flex justify-between">
                      <span className="font-semibold text-amber-900 dark:text-amber-200">Estimated total</span>
                      <span className="font-bold text-amber-900 dark:text-amber-200">£325–425 + conveyancer quote</span>
                    </div>
                  </div>
                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-3">
                    No hidden fees. Every price is shown before you pay. Your conveyancer is paid directly; searches are bought through PropXchain.
                  </p>
                </div>
              ) : (
                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700/50 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-emerald-900 dark:text-emerald-200 mb-2">Starter — no platform fee</h4>
                  <p className="text-sm text-emerald-800 dark:text-emerald-300">
                    Your transaction is created free. You pay only for what you use: £50–450 for
                    searches (bought through PropXchain), £7 per HM Land Registry title pull (it
                    names the registered owner), and your conveyancer's own quote. The optional £75
                    AI co-pilot reads your title and search results for you.
                  </p>
                </div>
              )}

              {/* Who is on the title */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Users className="w-4 h-4" />
                  Who is on the property title? <span className="text-red-600">*</span>
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  This determines how many sets of ID documents are required
                </p>
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <button
                    type="button"
                    onClick={() => handleFieldChange('sellerCount', 1)}
                    aria-pressed={formData.sellerCount === 1}
                    className={`min-h-11 p-3 sm:p-4 border-2 rounded-lg transition-all ${
                      formData.sellerCount === 1
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-300 dark:border-slate-600 hover:border-blue-400'
                    }`}
                  >
                    <div className={`text-2xl mb-2 ${formData.sellerCount === 1 ? 'text-blue-600' : 'text-gray-400'}`}>
                      👤
                    </div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Just me</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Single owner</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleFieldChange('sellerCount', 2)}
                    aria-pressed={formData.sellerCount === 2}
                    className={`min-h-11 p-3 sm:p-4 border-2 rounded-lg transition-all ${
                      formData.sellerCount === 2
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-300 dark:border-slate-600 hover:border-blue-400'
                    }`}
                  >
                    <div className={`text-2xl mb-2 ${formData.sellerCount === 2 ? 'text-blue-600' : 'text-gray-400'}`}>
                      👥
                    </div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Me and my partner</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Joint owners</p>
                  </button>
                </div>
              </div>

              {/* Summary */}
              <div className="p-3 sm:p-4 bg-gray-50 dark:bg-slate-800/50 rounded-md">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Transaction Summary</h4>
                <dl className="space-y-2 text-sm">
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-0.5">
                    <dt className="text-gray-600 dark:text-gray-400">Address:</dt>
                    <dd className="text-gray-900 dark:text-gray-100 font-medium sm:text-right">{formData.address}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600 dark:text-gray-400">Postcode:</dt>
                    <dd className="text-gray-900 dark:text-gray-100 font-medium">{formData.postcode}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600 dark:text-gray-400">Property Type:</dt>
                    <dd className="text-gray-900 dark:text-gray-100 font-medium capitalize">{formData.propertyType}</dd>
                  </div>
                  {formData.titleNumber && (
                    <div className="flex justify-between">
                      <dt className="text-gray-600 dark:text-gray-400">Title Number:</dt>
                      <dd className="text-gray-900 dark:text-gray-100 font-medium">{formData.titleNumber}</dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-gray-600 dark:text-gray-400">Sale Price:</dt>
                    <dd className="text-gray-900 dark:text-gray-100 font-medium">
                      £{formData.salePrice.toLocaleString()}
                    </dd>
                  </div>
                  {formData.lastSalePrice && formData.lastSaleDate && (
                    <div className="flex flex-col sm:flex-row sm:justify-between gap-0.5 bg-green-50 dark:bg-green-900/20 -mx-2 px-2 py-1 rounded">
                      <dt className="text-green-700 dark:text-green-300">Last Sold (Land Registry):</dt>
                      <dd className="text-green-800 dark:text-green-300 font-medium">
                        {formatPrice(formData.lastSalePrice)} ({formatFullDate(formData.lastSaleDate)})
                      </dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-gray-600 dark:text-gray-400">Sellers on title:</dt>
                    <dd className="text-gray-900 dark:text-gray-100 font-medium">{formData.sellerCount === 1 ? 'Single owner' : 'Joint owners (2)'}</dd>
                  </div>
                </dl>
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleBack}
                  className="h-11 px-6 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors text-base"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-11 px-6 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-base"
                >
                  {isSubmitting ? 'Creating Transaction...' : 'Create Transaction'}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>

      {/*
       * "What happens next?" copy lives in the wrapping page
       * (CreateTransactionPage), not here. Keeping a single source of truth
       * for that copy avoids the previous tier-mismatch bug where this
       * component hard-coded Premium copy regardless of the picked tier.
       *
       * Admins see an extra Premium-flow preview card below so they can QA
       * the £75 payment path without switching accounts. End users never
       * see this card.
       */}
      {isAdmin && (
        <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700/50">
          <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-2">
            Admin preview · Premium flow
          </h4>
          <p className="text-xs text-blue-700 dark:text-blue-300 mb-2">
            What a Premium user would see after this step. Hidden from non-admin accounts.
          </p>
          <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
            <li>• You&apos;ll be taken to a secure payment page (£75 one-time fee)</li>
            <li>• After payment, your transaction is created on the blockchain</li>
            <li>• Share the invite code with the buyer to join your transaction</li>
            <li>• Complete your TA6 and TA10 property information forms</li>
            <li>• All data is stored securely on the blockchain</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default CreateTransactionForm;
