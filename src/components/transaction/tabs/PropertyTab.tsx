// PropXchain - Open Source Blockchain Property Conveyancing Platform
// Copyright (C) 2025 PropXchain Contributors
// SPDX-License-Identifier: Proprietary

import { useCallback } from 'react';
import { MapPinOff } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { PropertyIntelligenceCard } from '@/components/transaction/PropertyIntelligenceCard';
import type { PropertyIntelligenceReport } from '@/services/propertyIntelligenceService';
import { applyReportEpcToListing } from '@/services/listingEnrichment';
import type { TransactionTabProps } from './transactionTabs.config';

/**
 * "What we know about this property" — free open-gov intelligence layer.
 *
 * PropertyIntelligenceCard renders nothing when there's no postcode, which on a
 * dedicated tab reads as broken. So when the transaction has no postcode yet we
 * show an explicit empty state; otherwise the card handles full postcodes (full
 * intel) and outcode-only postcodes (its own completion prompt).
 */
export function PropertyTab({ transactionId, postcode, propertyAddress, uprn }: TransactionTabProps): JSX.Element {
  const hasPostcode = Boolean(postcode && postcode.trim());
  const queryClient = useQueryClient();

  // What this tab learns for free feeds the sales pack: the report's EPC
  // certificate goes onto the listing, and the readiness meter re-reads it.
  const handleReport = useCallback(
    (report: PropertyIntelligenceReport): void => {
      if (!applyReportEpcToListing(transactionId, report.epc)) return;
      void queryClient.invalidateQueries({ queryKey: ['salesPack', 'readiness', transactionId] });
    },
    [transactionId, queryClient],
  );

  if (!hasPostcode) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-8 text-center">
        <MapPinOff className="h-6 w-6 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">No postcode on this property yet</p>
        <p className="max-w-md text-xs text-muted-foreground">
          Add the property’s postcode in Property details to unlock flood risk, sold prices,
          planning history, heritage and more — all free.
        </p>
      </div>
    );
  }

  return (
    <PropertyIntelligenceCard
      postcode={postcode}
      addressLine={propertyAddress ?? null}
      uprn={uprn ?? null}
      onReport={handleReport}
    />
  );
}
