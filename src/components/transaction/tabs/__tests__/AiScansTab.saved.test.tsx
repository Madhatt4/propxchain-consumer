import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ScanRunResult } from '@/types/scan.types';

const svc = vi.hoisted(() => ({
  fetchSavedScans: vi.fn(),
  runSurveyScan: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({ supabase: {} }));
vi.mock('@/services/sharedSearchScans', () => ({ fetchSharedSearchScans: async () => [] }));
vi.mock('@/services/onesearchResults', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/onesearchResults')>()),
  fetchReturnedOneSearchResults: async () => [],
}));
vi.mock('@/services/hmlrTitle.service', () => ({
  hmlrTitleService: { getStoredRegisterForTransaction: async () => null },
}));
vi.mock('@/services/savedScans', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/savedScans')>()),
  fetchSavedScans: svc.fetchSavedScans,
}));
vi.mock('@/services/scan.service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/scan.service')>()),
  fileToBase64: async () => 'cGRm',
  runSurveyScan: svc.runSurveyScan,
}));

import { AiScansTab } from '../AiScansTab';

function run(kind: 'survey' | 'search', sourceRef: string, explainer: string): ScanRunResult {
  return {
    status: 'complete',
    result: {
      scan_type: kind,
      source_ref: sourceRef,
      findings: [],
      explainer,
      flags_for_conveyancer: [],
    },
  };
}

const SAVED_SURVEY = run('survey', 'survey:tx_1:survey.pdf', 'The saved survey says the roof needs work.');
const SAVED_SEARCH = run('search', 'search:tx_1:llc1.pdf', 'The saved search found a planning notice.');

function renderTab(): void {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }): JSX.Element => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  render(<AiScansTab transactionId="tx_1" />, { wrapper });
}

function uploadSurvey(): void {
  // The survey card is last on the tab, so its picker is the last file input.
  const inputs = document.querySelectorAll<HTMLInputElement>('input[type="file"]');
  const input = inputs[inputs.length - 1];
  if (!input) throw new Error('survey file input not rendered');
  fireEvent.change(input, { target: { files: [new File(['pdf'], 'new.pdf', { type: 'application/pdf' })] } });
}

function savedBy(kind: 'survey' | 'search', runs: ScanRunResult[]): void {
  svc.fetchSavedScans.mockImplementation(async (k: string) => (k === kind ? runs : []));
}

describe('AiScansTab saved scans', () => {
  beforeEach(() => {
    svc.fetchSavedScans.mockReset().mockResolvedValue([]);
    svc.runSurveyScan.mockReset();
  });

  it('should show the saved survey scan on open', async () => {
    savedBy('survey', [SAVED_SURVEY]);

    renderTab();

    expect(await screen.findByText('The saved survey says the roof needs work.')).toBeInTheDocument();
    expect(screen.getByText(/Showing your last scan \(survey\.pdf\)\. Upload the RICS/)).toBeInTheDocument();
    expect(svc.fetchSavedScans).toHaveBeenCalledWith('survey', 'tx_1');
  });

  it('should show the saved private search scan on open', async () => {
    savedBy('search', [SAVED_SEARCH]);

    renderTab();

    expect(await screen.findByText('The saved search found a planning notice.')).toBeInTheDocument();
    expect(screen.getByText(/Showing your last scan \(llc1\.pdf\)\..*Only you will see the result/))
      .toBeInTheDocument();
  });

  it('should keep "Nothing scanned yet" on both cards when there is no saved scan', async () => {
    renderTab();

    await waitFor(() => expect(svc.fetchSavedScans).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getAllByText(/Nothing scanned yet/)).toHaveLength(3));
    expect(screen.queryByText(/Showing your last scan/)).not.toBeInTheDocument();
  });

  it('should degrade quietly to "Nothing scanned yet" when the saved read fails', async () => {
    svc.fetchSavedScans.mockRejectedValue(new Error('boom'));

    renderTab();

    await waitFor(() => expect(screen.getAllByText(/Nothing scanned yet/)).toHaveLength(3));
    expect(screen.queryByText(/Scan failed/)).not.toBeInTheDocument();
  });

  it('should replace the saved survey scan with a fresh one', async () => {
    savedBy('survey', [SAVED_SURVEY]);
    svc.runSurveyScan.mockResolvedValue(run('survey', 'survey:tx_1:new.pdf', 'The fresh survey is clean.'));
    renderTab();
    await screen.findByText('The saved survey says the roof needs work.');

    uploadSurvey();

    expect(await screen.findByText('The fresh survey is clean.')).toBeInTheDocument();
    expect(screen.queryByText(/Showing your last scan/)).not.toBeInTheDocument();
    expect(screen.queryByText('The saved survey says the roof needs work.')).not.toBeInTheDocument();
    expect(svc.runSurveyScan).toHaveBeenCalledWith(expect.objectContaining({
      sourceRef: 'survey:tx_1:new.pdf',
      transactionId: 'tx_1',
    }));
  });

  it('should re-read the saved survey scan after a fresh scan succeeds', async () => {
    savedBy('survey', [SAVED_SURVEY]);
    svc.runSurveyScan.mockResolvedValue(run('survey', 'survey:tx_1:new.pdf', 'The fresh survey is clean.'));
    renderTab();
    await screen.findByText('The saved survey says the roof needs work.');
    const surveyReads = (): number =>
      svc.fetchSavedScans.mock.calls.filter(([kind]) => kind === 'survey').length;
    const before = surveyReads();

    uploadSurvey();
    await screen.findByText('The fresh survey is clean.');

    await waitFor(() => expect(surveyReads()).toBe(before + 1));
  });

  it('should not re-read the saved survey scan when a fresh scan fails', async () => {
    svc.runSurveyScan.mockResolvedValue(null);
    renderTab();
    await waitFor(() => expect(svc.fetchSavedScans).toHaveBeenCalledTimes(2));

    uploadSurvey();
    await screen.findByText(/Please try again/);

    expect(svc.fetchSavedScans).toHaveBeenCalledTimes(2);
  });
});
