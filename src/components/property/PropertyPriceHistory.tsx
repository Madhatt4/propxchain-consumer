import React, { useState, useEffect } from 'react';
import {
  PricePaidRecord,
  LandRegistryAddress,
  fetchPriceHistory,
  findExactPropertyMatch,
  formatPrice,
  formatDate,
  formatFullDate,
  getPropertyTypeLabel,
  getTenureLabel,
  calculatePriceChange,
  isValidPostcode
} from '../../services/landRegistryService';

interface PropertyPriceHistoryProps {
  // Either provide pre-fetched data or address to fetch from
  exactMatches?: PricePaidRecord[];
  areaHistory?: PricePaidRecord[];
  propertyAddress?: LandRegistryAddress;
  // Compact mode for smaller displays
  compact?: boolean;
  // Show area comparison table
  showAreaComparison?: boolean;
  // Dark mode styling for dark-themed dashboards
  darkMode?: boolean;
}

const PropertyPriceHistory: React.FC<PropertyPriceHistoryProps> = ({
  exactMatches: initialExactMatches,
  areaHistory: initialAreaHistory,
  propertyAddress,
  compact = false,
  showAreaComparison = true,
  darkMode = false
}) => {
  const [exactMatches, setExactMatches] = useState<PricePaidRecord[]>(initialExactMatches || []);
  const [areaHistory, setAreaHistory] = useState<PricePaidRecord[]>(initialAreaHistory || []);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAllMatches, setShowAllMatches] = useState(false);
  const [showAllArea, setShowAllArea] = useState(false);

  // Fetch data if address provided but no pre-fetched data
  useEffect(() => {
    if (propertyAddress && isValidPostcode(propertyAddress.postcode) && !initialExactMatches && !initialAreaHistory) {
      const fetchData = async () => {
        setIsLoading(true);
        setError(null);

        const result = await fetchPriceHistory(propertyAddress.postcode);

        if (result.success) {
          setAreaHistory(result.records);
          if (propertyAddress.paon) {
            setExactMatches(findExactPropertyMatch(result.records, propertyAddress));
          }
        } else {
          setError(result.error || 'Failed to fetch price history');
        }

        setIsLoading(false);
      };

      fetchData();
    }
  }, [propertyAddress, initialExactMatches, initialAreaHistory]);

  // Update from props if provided
  useEffect(() => {
    if (initialExactMatches) setExactMatches(initialExactMatches);
    if (initialAreaHistory) setAreaHistory(initialAreaHistory);
  }, [initialExactMatches, initialAreaHistory]);

  if (isLoading) {
    return (
      <div className={`rounded-lg shadow-sm border p-6 ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white'}`}>
        <div className="flex items-center justify-center py-8">
          <svg className={`animate-spin h-8 w-8 ${darkMode ? 'text-slate-300' : 'text-gray-700'}`} viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className={`ml-3 ${darkMode ? 'text-slate-400' : 'text-gray-600'}`}>Loading Land Registry data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`rounded-lg shadow-sm border p-6 ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white'}`}>
        <div className={`flex items-center ${darkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>Unable to fetch Land Registry data: {error}</span>
        </div>
      </div>
    );
  }

  if (exactMatches.length === 0 && areaHistory.length === 0) {
    return (
      <div className={`rounded-lg shadow-sm border p-6 ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white'}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className={`text-lg font-semibold flex items-center ${darkMode ? 'text-slate-100' : 'text-gray-900'}`}>
            <svg className={`w-5 h-5 mr-2 ${darkMode ? 'text-slate-400' : 'text-gray-700'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            Land Registry Data
          </h3>
        </div>
        <div className={`p-4 rounded-lg border ${darkMode ? 'bg-slate-700/50 border-slate-600' : 'bg-gray-50 border-gray-200'}`}>
          <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-gray-600'}`}>
            No price history found for this property.
            This could be a new build or first registration.
          </p>
        </div>
      </div>
    );
  }

  const displayedMatches = showAllMatches ? exactMatches : exactMatches.slice(0, 3);
  const displayedAreaHistory = showAllArea ? areaHistory : areaHistory.slice(0, 5);

  return (
    <div className={`rounded-lg shadow-sm border ${compact ? 'p-4' : 'p-6'} ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white'}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className={`font-semibold flex items-center ${compact ? 'text-base' : 'text-lg'} ${darkMode ? 'text-slate-100' : 'text-gray-900'}`}>
          <svg className={`w-5 h-5 mr-2 ${darkMode ? 'text-slate-400' : 'text-gray-700'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          Land Registry Data
        </h3>
        <span className={`text-xs px-2 py-1 rounded ${darkMode ? 'text-slate-400 bg-slate-700' : 'text-gray-500 bg-gray-100'}`}>
          Official Price Paid Data
        </span>
      </div>

      {/* This Property's History */}
      {exactMatches.length > 0 && (
        <div className="mb-6">
          <h4 className={`text-sm font-medium mb-3 flex items-center ${darkMode ? 'text-slate-300' : 'text-gray-700'}`}>
            <svg className={`w-4 h-4 mr-1 ${darkMode ? 'text-green-400' : 'text-green-600'}`} fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Previous Sales - This Property
          </h4>
          <div className="space-y-3">
            {displayedMatches.map((record, idx) => {
              const previousRecord = exactMatches[idx + 1];
              const priceChange = previousRecord
                ? calculatePriceChange(record.price, previousRecord.price)
                : null;

              return (
                <div
                  key={record.transactionId || idx}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    darkMode
                      ? 'bg-gradient-to-r from-green-900/30 to-emerald-900/30 border-green-700/50'
                      : 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200'
                  }`}
                >
                  <div>
                    <p className={`font-semibold text-lg ${darkMode ? 'text-green-300' : 'text-green-800'}`}>
                      {formatPrice(record.price)}
                    </p>
                    <p className={`text-sm ${darkMode ? 'text-green-400' : 'text-green-600'}`}>
                      {formatFullDate(record.dateOfTransfer)}
                    </p>
                    {priceChange && (
                      <p className={`text-xs mt-1 ${priceChange.isIncrease ? (darkMode ? 'text-green-400' : 'text-green-600') : (darkMode ? 'text-red-400' : 'text-red-600')}`}>
                        {priceChange.isIncrease ? '+' : ''}{formatPrice(priceChange.amount)} ({priceChange.isIncrease ? '+' : ''}{priceChange.percentage}%)
                      </p>
                    )}
                  </div>
                  <div className={`text-right text-sm ${darkMode ? 'text-slate-400' : 'text-gray-600'}`}>
                    <p>{getTenureLabel(record.duration)}</p>
                    <p className={`text-xs ${darkMode ? 'text-slate-500' : 'text-gray-400'}`}>
                      {record.oldNew === 'Y' ? 'New Build' : 'Resale'}
                    </p>
                    {record.propertyType && (
                      <p className={`text-xs ${darkMode ? 'text-slate-500' : 'text-gray-400'}`}>
                        {getPropertyTypeLabel(record.propertyType)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {exactMatches.length > 3 && (
            <button
              onClick={() => setShowAllMatches(!showAllMatches)}
              className={`mt-2 text-sm font-medium ${darkMode ? 'text-slate-400 hover:text-slate-300' : 'text-gray-700 hover:text-gray-800'}`}
            >
              {showAllMatches ? 'Show less' : `Show all ${exactMatches.length} sales`}
            </button>
          )}
        </div>
      )}

      {/* No Exact Matches Message */}
      {exactMatches.length === 0 && areaHistory.length > 0 && (
        <div className={`mb-6 p-4 rounded-lg border ${darkMode ? 'bg-slate-700/50 border-slate-600' : 'bg-gray-50 border-gray-200'}`}>
          <div className={`flex items-center text-sm ${darkMode ? 'text-slate-400' : 'text-gray-600'}`}>
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            No previous sales found for this exact property.
          </div>
          <p className={`text-xs mt-1 ${darkMode ? 'text-slate-500' : 'text-gray-500'}`}>
            This could be a new build or first registration.
          </p>
        </div>
      )}

      {/* Area Comparison Table */}
      {showAreaComparison && areaHistory.length > 0 && (
        <div>
          <h4 className={`text-sm font-medium mb-3 flex items-center ${darkMode ? 'text-slate-300' : 'text-gray-700'}`}>
            <svg className={`w-4 h-4 mr-1 ${darkMode ? 'text-slate-400' : 'text-gray-700'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            </svg>
            Recent Sales in Area ({areaHistory[0]?.postcode?.split(' ')[0] || 'Nearby'})
          </h4>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className={`text-left border-b ${darkMode ? 'text-slate-400 border-slate-600' : 'text-gray-500'}`}>
                  <th className="pb-2 font-medium">Address</th>
                  <th className="pb-2 font-medium">Price</th>
                  <th className="pb-2 font-medium">Date</th>
                  <th className="pb-2 font-medium">Type</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${darkMode ? 'divide-slate-700' : 'divide-gray-100'}`}>
                {displayedAreaHistory.map((record, idx) => (
                  <tr
                    key={record.transactionId || idx}
                    className={`${darkMode ? 'text-slate-300' : 'text-gray-700'} ${
                      exactMatches.some(m => m.transactionId === record.transactionId)
                        ? (darkMode ? 'bg-green-900/20' : 'bg-green-50')
                        : ''
                    }`}
                  >
                    <td className="py-2">
                      <span className="font-medium">{record.paon}</span>
                      {record.saon && <span className={`ml-1 ${darkMode ? 'text-slate-500' : 'text-gray-500'}`}>({record.saon})</span>}
                      <span className={`ml-1 ${darkMode ? 'text-slate-500' : 'text-gray-500'}`}>{record.street}</span>
                    </td>
                    <td className={`py-2 font-medium ${darkMode ? 'text-slate-100' : 'text-gray-900'}`}>
                      {formatPrice(record.price)}
                    </td>
                    <td className={`py-2 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                      {formatDate(record.dateOfTransfer)}
                    </td>
                    <td className={`py-2 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                      {getPropertyTypeLabel(record.propertyType)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {areaHistory.length > 5 && (
            <button
              onClick={() => setShowAllArea(!showAllArea)}
              className={`mt-2 text-sm font-medium ${darkMode ? 'text-slate-400 hover:text-slate-300' : 'text-gray-700 hover:text-gray-800'}`}
            >
              {showAllArea ? 'Show less' : `Show all ${areaHistory.length} sales in area`}
            </button>
          )}
          <p className={`mt-3 text-xs ${darkMode ? 'text-slate-500' : 'text-gray-400'}`}>
            Source: HM Land Registry Price Paid Data (Open Government Licence)
          </p>
        </div>
      )}
    </div>
  );
};

export default PropertyPriceHistory;
