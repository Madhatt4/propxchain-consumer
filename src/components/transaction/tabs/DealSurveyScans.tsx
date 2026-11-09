// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Survey scan results shared on the deal (deal_survey_scans, monorepo #418),
 * for the "Documents on this deal" view. The server removes personal findings
 * before they leave the database; this only shows how many were held back.
 * Renders nothing when the RPC is missing (before #418) or there is no scan,
 * because an empty or failed panel would only be noise next to the documents.
 */
import { useEffect, useState } from 'react';
import { ScanResultCard } from '@/components/transaction/scans/ScanResultCard';
import { fetchDealSurveyScans, type DealSurveyScan } from '@/services/dealDocuments.service';

export function DealSurveyScans({ transactionId }: { transactionId: string }): JSX.Element | null {
  const [scans, setScans] = useState<DealSurveyScan[] | null>(null);

  useEffect(() => {
    let active = true;
    void fetchDealSurveyScans(transactionId).then((rows) => {
      if (active) setScans(rows);
    });
    return () => {
      active = false;
    };
  }, [transactionId]);

  if (!scans || scans.length === 0) return null;
  return (
    <section aria-label="Survey scan results" className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">Survey scan results</h3>
      {scans.map((scan, i) => (
        <div key={i} className="space-y-1">
          <ScanResultCard
            heading="Survey scan"
            description="What the survey report says, read by AI. Shared with everyone on the deal."
            trigger={null}
            isLoading={false}
            run={scan.run}
          />
          {scan.personalFindingsCount > 0 && (
            <p className="text-xs text-muted-foreground">
              {scan.personalFindingsCount} personal finding{scan.personalFindingsCount === 1 ? '' : 's'} kept
              private to whoever ran the scan.
            </p>
          )}
        </div>
      ))}
    </section>
  );
}
