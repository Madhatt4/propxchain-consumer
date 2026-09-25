// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * TA10FormPage — full-page home for the fittings & contents form, matching
 * the TA6 page: room lists open in place, saves stay on the page, and
 * "Back to transaction" returns to the flow card (which re-derives status).
 */

import { useCallback, useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { useLocation, useParams } from 'react-router-dom';

import AppTopBar from '@/components/navigation/AppTopBar';

import { icpService } from '@/services/icp.service';
import { recordOnBehalf } from '@/services/onBehalf';
import { logger } from '@/utils/logger';
import TA10Form from '@/components/forms/TA10Form';
import type { TA10FittingsAndContents } from '@/types/ta10.types';

interface TA10PageLocationState {
  propertyAddress?: string;
  readOnly?: boolean;
}

export default function TA10FormPage(): ReactElement {
  const { id = '' } = useParams<{ id: string }>();
  const location = useLocation();
  const state = (location.state ?? {}) as TA10PageLocationState;

  const [loading, setLoading] = useState(true);
  const [initialData, setInitialData] = useState<TA10FittingsAndContents | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const readOnly = state.readOnly ?? false;
  const flowPath = `/transaction/${id}/flow`;

  useEffect(() => {
    let cancelled = false;
    const load = async (): Promise<void> => {
      setLoading(true);
      try {
        const data = await icpService.getTA10(id);
        if (!cancelled) setInitialData(data);
      } catch (err) {
        logger.error('TA10FormPage: failed to load TA10 data', err);
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
    async (data: TA10FittingsAndContents): Promise<void> => {
      await icpService.updateTA10(id, data);
      void recordOnBehalf(id, 'seller', 'fill_pack_form', 'ta10');
    },
    [id],
  );

  return (
    <div className="min-h-screen bg-[var(--bg-main)]">
      <AppTopBar
        title={state.propertyAddress || 'Property'}
        subtitle="TA10 form"
        backTo={flowPath}
        backLabel="Back to transaction"
      />
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        {loading ? (
          <div className="py-24 text-center text-sm text-gray-500 dark:text-slate-400">
            Loading TA10 form…
          </div>
        ) : loadError ? (
          <div className="py-24 text-center text-sm text-red-600 dark:text-red-400">{loadError}</div>
        ) : (
          <TA10Form
            transactionId={id}
            initialData={initialData}
            onSave={handleSave}
            readOnly={readOnly}
            propertyAddress={state.propertyAddress}
          />
        )}
      </div>
    </div>
  );
}
