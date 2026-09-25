// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * TA7FormPage — full-page home for the leasehold information form, matching
 * the TA6/TA10 pages: saves stay on the page, "Back to transaction" returns
 * to the flow card (which re-derives status on mount).
 */

import { useCallback, useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { useLocation, useParams } from 'react-router-dom';

import AppTopBar from '@/components/navigation/AppTopBar';

import { icpService } from '@/services/icp.service';
import { recordOnBehalf } from '@/services/onBehalf';
import { logger } from '@/utils/logger';
import TA7Form from '@/components/forms/TA7Form';
import type { TA7LeaseholdInformation } from '@/types/ta7.types';
import type { PropertyListing } from '@/types/listing.types';
import { getRightmoveData, storeRightmoveData, syncListingFromChain } from '@/utils/rightmoveStorage';
import { listingFromTa7 } from '@/services/taFormsPrefill';

interface TA7PageLocationState {
  propertyAddress?: string;
  postcode?: string | null;
  readOnly?: boolean;
  /** The stage only offers TA7 for leasehold tenures, so default true. */
  isLeasehold?: boolean;
}

export default function TA7FormPage(): ReactElement {
  const { id = '' } = useParams<{ id: string }>();
  const location = useLocation();
  const state = (location.state ?? {}) as TA7PageLocationState;

  const [loading, setLoading] = useState(true);
  const [initialData, setInitialData] = useState<TA7LeaseholdInformation | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [listing, setListing] = useState<PropertyListing | null>(() => getRightmoveData(id));

  const readOnly = state.readOnly ?? false;
  const flowPath = `/transaction/${id}/flow`;

  useEffect(() => {
    let cancelled = false;
    const load = async (): Promise<void> => {
      setLoading(true);
      try {
        // Listing first, so the form initialises with its prefill even on a
        // cold device where localStorage is empty and only the chain has it.
        const synced = await syncListingFromChain(id).catch((err: unknown) => {
          logger.warn('TA7FormPage: listing sync failed, prefill from local copy only', err);
          return null;
        });
        if (!cancelled && synced) setListing(synced);
        const data = await icpService.getTA7(id);
        if (!cancelled) setInitialData(data);
      } catch (err) {
        logger.error('TA7FormPage: failed to load TA7 data', err);
        if (!cancelled) setLoadError('Could not load the form from the transaction record.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleSave = useCallback(
    async (data: TA7LeaseholdInformation): Promise<void> => {
      await icpService.updateTA7(id, data);
      void recordOnBehalf(id, 'seller', 'fill_pack_form', 'ta7');
      // Lease figures typed here fill the listing's blanks (material info),
      // so the sales pack and Stage 1 see them without a second entry.
      const current = getRightmoveData(id);
      if (current) {
        const next = listingFromTa7(current, data);
        if (next !== current) void storeRightmoveData(id, next);
      }
    },
    [id],
  );

  return (
    <div className="min-h-screen bg-[var(--bg-main)]">
      <AppTopBar
        title={state.propertyAddress || 'Property'}
        subtitle={[state.postcode, 'TA7 form'].filter(Boolean).join(' · ')}
        backTo={flowPath}
        backLabel="Back to transaction"
      />
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        {loading ? (
          <div className="py-24 text-center text-sm text-gray-500 dark:text-slate-400">
            Loading TA7 form…
          </div>
        ) : loadError ? (
          <div className="py-24 text-center text-sm text-red-600 dark:text-red-400">{loadError}</div>
        ) : (
          <TA7Form
            transactionId={id}
            initialData={initialData}
            onSave={handleSave}
            readOnly={readOnly}
            isLeasehold={state.isLeasehold ?? true}
            propertyAddress={state.propertyAddress}
            postcode={state.postcode}
            listing={listing}
          />
        )}
      </div>
    </div>
  );
}
