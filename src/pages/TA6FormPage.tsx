// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * TA6FormPage — full-page home for the 15-section TA6 6th-edition stepper.
 *
 * The form is far too large for the in-card modal on the transaction flow
 * page, so "Fill form online" navigates here instead; per-section saves
 * happen in place and "Back to transaction" returns to the flow page,
 * which re-derives form status from the canister on mount.
 */

import { useCallback, useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';

import AppTopBar from '@/components/navigation/AppTopBar';

import { icpService } from '@/services/icp.service';
import { recordOnBehalf } from '@/services/onBehalf';
import { logger } from '@/utils/logger';
import { getRightmoveData, storeRightmoveData, syncListingFromChain } from '@/utils/rightmoveStorage';
import { listingFromTa6 } from '@/services/taFormsPrefill';
import type { PropertyListing } from '@/types/listing.types';
import TA6Form from '@/components/forms/TA6Form';
import { stepForSectionName } from '@/components/forms/ta6/sectionMeta';
import { makeTa6Uploader } from '@/components/forms/ta6/widgets/ta6Uploader';
import { calculateTA6Completion } from '@/types/ta6.types';
import type { TA6PropertyInformation } from '@/types/ta6.types';

interface TA6PageLocationState {
  postcode?: string | null;
  propertyAddress?: string;
  readOnly?: boolean;
}

export default function TA6FormPage(): ReactElement {
  const { id = '' } = useParams<{ id: string }>();
  const location = useLocation();
  const state = (location.state ?? {}) as TA6PageLocationState;

  const [loading, setLoading] = useState(true);
  const [initialData, setInitialData] = useState<TA6PropertyInformation | null>(null);
  const [acknowledged, setAcknowledged] = useState<boolean | undefined>(undefined);
  const [completion, setCompletion] = useState<number>(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [listing, setListing] = useState<PropertyListing | null>(() => getRightmoveData(id));

  const readOnly = state.readOnly ?? false;
  const flowPath = `/transaction/${id}/flow`;
  // `?section=section8_environment` opens the stepper there. It rides in the
  // URL rather than in navigation state so the link survives a reload and can
  // be sent to someone. A name the form does not know falls back to §1.
  const sectionParam = new URLSearchParams(location.search).get('section');
  const initialStep = sectionParam === null ? undefined : stepForSectionName(sectionParam) ?? undefined;

  useEffect(() => {
    let cancelled = false;
    const load = async (): Promise<void> => {
      setLoading(true);
      try {
        // Listing first, so the form initialises with its prefill even on a
        // cold device where localStorage is empty and only the chain has it.
        const synced = await syncListingFromChain(id).catch((err: unknown) => {
          logger.warn('TA6FormPage: listing sync failed, prefill from local copy only', err);
          return null;
        });
        if (!cancelled && synced) setListing(synced);
        const data = await icpService.getTA6(id);
        if (cancelled) return;
        setInitialData(data);
        setCompletion(data ? calculateTA6Completion(data) : 0);
        if (!readOnly) {
          try {
            const acked = await icpService.hasAcknowledgedTA6Wording(id);
            if (!cancelled) setAcknowledged(acked);
          } catch (ackErr) {
            logger.warn('TA6FormPage: acknowledgment check failed', ackErr);
          }
        }
      } catch (err) {
        logger.error('TA6FormPage: failed to load TA6 data', err);
        if (!cancelled) setLoadError('Could not load the form from the transaction record.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [id, readOnly]);

  const handleSave = useCallback(
    async (data: TA6PropertyInformation): Promise<void> => {
      await icpService.updateTA6(id, data);
      setCompletion(calculateTA6Completion(data));
      void recordOnBehalf(id, 'seller', 'fill_pack_form', 'ta6');
      // A UPRN typed here fills the listing's blank, so it is typed once.
      const current = getRightmoveData(id);
      if (current) {
        const next = listingFromTa6(current, data);
        if (next !== current) void storeRightmoveData(id, next);
      }
    },
    [id],
  );

  const handleAcknowledge = useCallback(async (): Promise<void> => {
    await icpService.acknowledgeTA6Wording(id);
    setAcknowledged(true);
  }, [id]);

  return (
    <div className="min-h-screen bg-[var(--bg-main)]">
      <AppTopBar
        title={state.propertyAddress || 'Property'}
        subtitle={[state.postcode, 'TA6 form'].filter(Boolean).join(' · ')}
        backTo={flowPath}
        backLabel="Back to transaction"
      />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {completion === 100 && !readOnly && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3">
            <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
              All sections answered and saved.
            </p>
            <Link
              to={flowPath}
              className="shrink-0 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors"
            >
              Back to transaction
            </Link>
          </div>
        )}

        {loading ? (
          <div className="py-24 text-center text-sm text-gray-500 dark:text-slate-400">
            Loading TA6 form…
          </div>
        ) : loadError ? (
          <div className="py-24 text-center text-sm text-red-600 dark:text-red-400">{loadError}</div>
        ) : (
          <TA6Form
            transactionId={id}
            initialData={initialData}
            onSave={handleSave}
            readOnly={readOnly}
            propertyAddress={state.propertyAddress}
            postcode={state.postcode}
            listing={listing}
            hasAcknowledged={acknowledged}
            onAcknowledge={readOnly ? undefined : handleAcknowledge}
            uploadFile={readOnly ? undefined : makeTa6Uploader(id)}
            initialStep={initialStep}
          />
        )}
      </div>
    </div>
  );
}
