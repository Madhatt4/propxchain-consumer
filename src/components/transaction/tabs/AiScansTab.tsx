// PropXchain - Open Source Blockchain Property Conveyancing Platform
// Copyright (C) 2026 PropXchain Contributors
// SPDX-License-Identifier: Proprietary

/**
 * AI Scans tab — a free layer that runs the three AI scans and renders them
 * through the shared ScanResultCard. Title/HMLR reads the warmed server cache;
 * Survey scans a single manually-uploaded PDF.
 *
 * Searches prefers the provider's own returned results when they exist: an
 * ordered OneSearch search comes back to `onesearch_orders` and can be scanned
 * in place, so nobody has to spot that it arrived or re-upload a document we
 * already hold. Manual upload stays as the fallback for searches ordered
 * outside the platform.
 */
import { useState } from 'react';
import type { TransactionTabProps } from './transactionTabs.config';
import { ScanResultCard } from '@/components/transaction/scans/ScanResultCard';
import { ScanTriggerButton } from '@/components/transaction/scans/ScanTriggerButton';
import {
  useHmlrScan,
  useReturnedOneSearchResults,
  useSearchScan,
  useSurveyScan,
} from '@/hooks/useScan';
import { fileToBase64 } from '@/services/scan.service';
import type { ReturnedOneSearchSearch } from '@/services/onesearchResults';
import type { ScanRunResult } from '@/types/scan.types';

function mutationError(isError: boolean, err: Error | null, data?: ScanRunResult | null): string | null {
  if (isError) return err?.message ?? 'The scan could not be completed.';
  if (data === null) return 'The scan could not be completed. Please try again.';
  return null;
}

function HmlrPanel({ transactionId }: { transactionId: string }): JSX.Element {
  const { data, isLoading, isError, error, refetch } = useHmlrScan(transactionId);
  return (
    <ScanResultCard
      heading="Title (HM Land Registry)"
      description="A plain-English read of the title register from your completed HMLR pull."
      trigger={
        <ScanTriggerButton label="Refresh" isRunning={isLoading} onRun={() => void refetch()} />
      }
      isLoading={isLoading}
      error={isError ? (error as Error).message : null}
      onRetry={() => void refetch()}
      result={data ?? null}
    />
  );
}

interface FilePanelProps {
  transactionId: string;
  propertyRef?: string;
}

function returnedLabel(returned: ReturnedOneSearchSearch): string {
  const codes = returned.productCodes.join(', ') || 'search results';
  const when = new Date(returned.returnedAt).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
  return `Your OneSearch results are back (${codes}, ${when}).`;
}

function SearchPanel({ transactionId, propertyRef }: FilePanelProps): JSX.Element {
  const scan = useSearchScan();
  const { data: returnedSearches } = useReturnedOneSearchResults(transactionId);
  const [label, setLabel] = useState<string | null>(null);

  // Most recent first (the query orders by updated_at desc).
  const returned = returnedSearches?.[0];

  const onFile = async (file: File): Promise<void> => {
    setLabel(`Scanning ${file.name}`);
    const contentBase64 = await fileToBase64(file);
    scan.mutate({
      sourceRef: `search:${transactionId}:${file.name}`,
      transactionId,
      contentBase64,
      filename: file.name,
      ...(propertyRef ? { propertyRef } : {}),
    });
  };

  // Scans the provider's own returned documents through the real onesearch
  // normaliser. sourceRef is keyed on OneSearch's order reference, so
  // search-scan's per-source_ref cache makes a repeat press a free read rather
  // than a second trip to the model.
  const onScanReturned = (): void => {
    if (!returned) return;
    setLabel(`Scanning your returned ${returned.productCodes.join(', ') || 'search'}`);
    scan.mutate({
      sourceRef: `search:onesearch:${returned.ourReference}`,
      transactionId,
      provider: 'onesearch',
      bundle: returned.bundle,
      ...(propertyRef ? { propertyRef } : {}),
    });
  };

  const description =
    label ??
    (returned
      ? `${returnedLabel(returned)} Scan them, or upload a different search PDF.`
      : 'Upload your completed search PDF (LLC1 / CON29 / environmental) to scan it.');

  return (
    <ScanResultCard
      heading="Property searches"
      description={description}
      trigger={
        <>
          {returned && (
            <ScanTriggerButton
              label="Scan my search results"
              isRunning={scan.isPending}
              onRun={onScanReturned}
            />
          )}
          <ScanTriggerButton
            label={returned ? 'Upload a PDF instead' : 'Scan a PDF'}
            isRunning={scan.isPending}
            onFile={(f) => void onFile(f)}
          />
        </>
      }
      isLoading={scan.isPending}
      error={mutationError(scan.isError, scan.error, scan.data)}
      run={scan.data ?? null}
    />
  );
}

function SurveyPanel({ transactionId, propertyRef }: FilePanelProps): JSX.Element {
  const scan = useSurveyScan();
  const [filename, setFilename] = useState<string | null>(null);

  const onFile = async (file: File): Promise<void> => {
    setFilename(file.name);
    const contentBase64 = await fileToBase64(file);
    scan.mutate({
      sourceRef: `survey:${transactionId}:${file.name}`,
      transactionId,
      contentBase64,
      filename: file.name,
      ...(propertyRef ? { propertyRef } : {}),
    });
  };

  return (
    <ScanResultCard
      heading="Survey"
      description={
        filename
          ? `Scanning ${filename}`
          : 'Upload the RICS survey PDF (Level 1 / 2 / 3) to scan it.'
      }
      trigger={
        <ScanTriggerButton
          label="Scan a PDF"
          isRunning={scan.isPending}
          onFile={(f) => void onFile(f)}
        />
      }
      isLoading={scan.isPending}
      error={mutationError(scan.isError, scan.error, scan.data)}
      run={scan.data ?? null}
    />
  );
}

export function AiScansTab({ transactionId, uprn, postcode }: TransactionTabProps): JSX.Element {
  const propertyRef = uprn ?? postcode ?? undefined;
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        AI reads your documents and explains them in plain English, with a separate list for your
        conveyancer. It's free, and personal data is never shown here — only shared with your
        conveyancer.
      </p>
      <HmlrPanel transactionId={transactionId} />
      <SearchPanel transactionId={transactionId} propertyRef={propertyRef} />
      <SurveyPanel transactionId={transactionId} propertyRef={propertyRef} />
    </div>
  );
}
