// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import React, { useState, useEffect } from 'react';
import { conveyancerService, ConveyancerFirm } from '../../services/conveyancer.service';
import { FEATURE_FLAGS } from '../../config/features';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { logger } from '@/utils/logger';
import ActionError, { actionErrorMessage } from '@/components/common/ActionError';

interface ConveyancerPanelProps {
  transactionId: string;
  propertyPostcode?: string;
  transactionType?: string;
}

const ConveyancerPanel: React.FC<ConveyancerPanelProps> = ({
  transactionId,
  propertyPostcode,
  transactionType,
}) => {
  const [firms, setFirms] = useState<ConveyancerFirm[]>([]);
  const [instructedFirm, setInstructedFirm] = useState<ConveyancerFirm | null>(null);
  const [matterRef, setMatterRef] = useState<string>('');
  const [matterStatus, setMatterStatus] = useState<string>('');
  const [isSearching, setIsSearching] = useState(false);
  const [isInstructing, setIsInstructing] = useState<string | null>(null);
  const [searchPostcode, setSearchPostcode] = useState(propertyPostcode || '');
  // Instructing a firm could fail two ways and both were invisible: a thrown
  // error was logged, and a `success: false` result fell through the if with no
  // else at all. Either way the button just un-stuck.
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!FEATURE_FLAGS.CONVEYANCER_PANEL_ENABLED && propertyPostcode) {
      loadMockFirms();
    }
  }, [propertyPostcode]);

  const loadMockFirms = async (): Promise<void> => {
    const result = await conveyancerService.searchFirms(
      propertyPostcode || '',
      transactionType || 'sale'
    );
    if (result.success && result.firms) {
      setFirms(result.firms);
    }
  };

  const handleSearch = async (): Promise<void> => {
    if (!searchPostcode.trim()) return;
    setIsSearching(true);
    setActionError(null);
    try {
      const result = await conveyancerService.searchFirms(
        searchPostcode,
        transactionType || 'sale'
      );
      if (result.success && result.firms) {
        setFirms(result.firms);
      } else {
        logger.error('Conveyancer search refused', { searchPostcode, error: result.error });
        setActionError(
          actionErrorMessage(
            result.error,
            `Couldn’t look up firms for ${searchPostcode}. Please try again.`,
          ),
        );
      }
    } catch (err) {
      logger.error('Conveyancer search failed:', err);
      setActionError(
        actionErrorMessage(err, `Couldn’t look up firms for ${searchPostcode}. Please try again.`),
      );
    } finally {
      setIsSearching(false);
    }
  };

  const handleInstruct = async (firm: ConveyancerFirm): Promise<void> => {
    setIsInstructing(firm.id);
    setActionError(null);
    try {
      const result = await conveyancerService.instructFirm(firm.id, {
        transactionId,
        postcode: searchPostcode || propertyPostcode,
        transactionType: transactionType || 'sale',
      });
      if (result.success) {
        setInstructedFirm(firm);
        setMatterRef(result.matterRef || '');
        setMatterStatus('instructed');
      } else {
        logger.error('Firm instruction refused', { firmId: firm.id, error: result.error });
        setActionError(
          actionErrorMessage(
            result.error,
            `Couldn’t instruct ${firm.name}. Nothing has been sent to them — please try again.`,
          ),
        );
      }
    } catch (err) {
      logger.error('Firm instruction failed:', err);
      setActionError(
        actionErrorMessage(
          err,
          `Couldn’t instruct ${firm.name}. Nothing has been sent to them — please try again.`,
        ),
      );
    } finally {
      setIsInstructing(null);
    }
  };

  const handleViewStatus = async (): Promise<void> => {
    if (!matterRef) return;
    setActionError(null);
    try {
      const result = await conveyancerService.getMatterStatus(matterRef);
      if (result.success) {
        setMatterStatus(result.status || 'unknown');
      } else {
        logger.error('Matter status refused', { matterRef, error: result.error });
        setActionError(actionErrorMessage(result.error, 'Couldn’t refresh the matter status. Try again shortly.'));
      }
    } catch (err) {
      logger.error('Matter status check failed:', err);
      setActionError(
        actionErrorMessage(err, 'Couldn’t refresh the matter status. Try again shortly.'),
      );
    }
  };

  const renderStars = (rating: number): React.ReactNode => {
    const full = Math.floor(rating);
    const half = rating - full >= 0.5;
    const stars: React.ReactNode[] = [];
    for (let i = 0; i < full; i++) {
      stars.push(
        <svg key={`full-${i}`} className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      );
    }
    if (half) {
      stars.push(
        <svg key="half" className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      );
    }
    return <div className="flex items-center gap-0.5">{stars}<span className="ml-1 text-xs text-gray-600 dark:text-gray-400">{rating}</span></div>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          Find a Conveyancer
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Both branches below can fail — search, instruct and status refresh —
            so this sits above the conditional rather than inside one arm. */}
        <ActionError message={actionError} />
        {/* Demo mode banner */}
        {!FEATURE_FLAGS.CONVEYANCER_PANEL_ENABLED && (
          <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg p-3">
            <p className="text-sm text-amber-700 dark:text-amber-200">
              Conveyancer panel integration pending. Showing demo firms.
            </p>
          </div>
        )}

        {/* Instructed firm view */}
        {instructedFirm ? (
          <div className="space-y-3">
            <div className="bg-gray-100 dark:bg-gray-700/50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-gray-900 dark:text-white font-medium">{instructedFirm.name}</h4>
                <Badge className="bg-green-600 hover:bg-green-600">Instructed</Badge>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">{instructedFirm.address}</p>
              {matterRef && (
                <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">
                  Matter Ref: <span className="font-mono">{matterRef}</span>
                  {matterRef.startsWith('MOCK') && (
                    <span className="text-xs text-amber-600 dark:text-amber-400 ml-1">(demo)</span>
                  )}
                </p>
              )}
              {matterStatus && (
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Status: <span className="capitalize">{matterStatus}</span>
                </p>
              )}
            </div>
            <Button
              size="sm"
              className="bg-gray-700 hover:bg-gray-600"
              onClick={handleViewStatus}
            >
              View Status
            </Button>
          </div>
        ) : (
          <>
            {/* Search input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={searchPostcode}
                onChange={(e) => setSearchPostcode(e.target.value.toUpperCase())}
                placeholder="Enter postcode (e.g. MK40 1NN)"
                className="flex-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-gray-900 dark:text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <Button
                onClick={handleSearch}
                disabled={isSearching || !searchPostcode.trim()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isSearching ? 'Searching...' : 'Search'}
              </Button>
            </div>

            {/* Firm results */}
            {firms.length > 0 && (
              <div className="space-y-3">
                {firms.map(firm => (
                  <div key={firm.id} className="bg-gray-100 dark:bg-gray-700/50 rounded-lg p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-gray-900 dark:text-white font-medium truncate">{firm.name}</h4>
                          {firm.cqsAccredited && (
                            <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200 text-xs flex-shrink-0">
                              CQS
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{firm.address}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{firm.phone}</p>
                        <div className="mt-1">{renderStars(firm.rating)}</div>
                      </div>
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 flex-shrink-0"
                        disabled={isInstructing === firm.id}
                        onClick={() => handleInstruct(firm)}
                      >
                        {isInstructing === firm.id ? 'Instructing...' : 'Instruct'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default ConveyancerPanel;
