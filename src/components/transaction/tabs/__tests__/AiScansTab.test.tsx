import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { SharedSearchScan } from '@/types/scan.types';

const svc = vi.hoisted(() => ({
  fetchSharedSearchScans: vi.fn(),
  fetchReturnedOneSearchResults: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({ supabase: {} }));
vi.mock('@/services/sharedSearchScans', () => ({
  fetchSharedSearchScans: svc.fetchSharedSearchScans,
}));
vi.mock('@/services/onesearchResults', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/onesearchResults')>()),
  fetchReturnedOneSearchResults: svc.fetchReturnedOneSearchResults,
}));
vi.mock('@/services/hmlrTitle.service', () => ({
  hmlrTitleService: { getStoredRegisterForTransaction: async () => null },
}));

import { AiScansTab } from '../AiScansTab';

const SCAN: SharedSearchScan = {
  id: 'scan-1',
  provider: 'onesearch',
  providerOrderId: 'order-1',
  status: 'complete',
  explainer: 'The search found a planning notice.',
  flags: [{ statement: 'A planning notice is recorded.', searchName: 'LLC1', location: 'Part 3' }],
  warnings: ['Page 4 could not be read.'],
  personalFindingsCount: 0,
  personalFindings: null,
};

const RETURNED = {
  id: 'order-1',
  ourReference: 'PXC-1',
  supplierReference: null,
  productCodes: ['LLC1'],
  returnedAt: '2026-10-30T00:00:00Z',
  bundle: { products: [] },
};

function renderTab(): void {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }): JSX.Element => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  render(<AiScansTab transactionId="tx_1" />, { wrapper });
}

function scan(overrides: Partial<SharedSearchScan>): SharedSearchScan {
  return { ...SCAN, ...overrides };
}

describe('AiScansTab searches', () => {
  beforeEach(() => {
    svc.fetchSharedSearchScans.mockReset().mockResolvedValue([]);
    svc.fetchReturnedOneSearchResults.mockReset().mockResolvedValue([]);
  });

  it('should show a party the shared scan without pressing anything', async () => {
    svc.fetchSharedSearchScans.mockResolvedValue([SCAN]);

    renderTab();

    expect(await screen.findByText('The search found a planning notice.')).toBeInTheDocument();
    expect(screen.getByText('Search summary: OneSearch')).toBeInTheDocument();
    expect(screen.getByText('A planning notice is recorded.')).toBeInTheDocument();
    expect(screen.getByText('LLC1, Part 3')).toBeInTheDocument();
    expect(
      screen.getByText('This is an automated summary of your searches, not legal advice.'),
    ).toBeInTheDocument();
  });

  it('should keep warnings apart from flags', async () => {
    svc.fetchSharedSearchScans.mockResolvedValue([SCAN]);

    renderTab();

    const warnings = await screen.findByTestId('scan-warnings');
    expect(within(warnings).getByText("Couldn't read")).toBeInTheDocument();
    expect(within(warnings).getByText('Page 4 could not be read.')).toBeInTheDocument();
    expect(within(warnings).queryByText('A planning notice is recorded.')).not.toBeInTheDocument();
  });

  it('should show a pending scan as being scanned', async () => {
    svc.fetchSharedSearchScans.mockResolvedValue([scan({ status: 'pending', explainer: '' })]);

    renderTab();

    expect(await screen.findByText(/Being scanned/)).toBeInTheDocument();
  });

  it('should show a failed scan without any internal error text', async () => {
    svc.fetchSharedSearchScans.mockResolvedValue([scan({ status: 'error', explainer: '' })]);

    renderTab();

    expect(await screen.findByText(/couldn't scan this search/)).toBeInTheDocument();
    expect(screen.queryByText(/scan_failed/)).not.toBeInTheDocument();
  });

  it('should show why a search is unsupported, with what could not be read', async () => {
    svc.fetchSharedSearchScans.mockResolvedValue([
      scan({ status: 'unsupported', explainer: 'This format is not supported yet.', flags: [] }),
    ]);

    renderTab();

    expect(await screen.findByText('This format is not supported yet.')).toBeInTheDocument();
    expect(screen.getByText('Page 4 could not be read.')).toBeInTheDocument();
  });

  it('should fall back to a plain line when an unsupported scan has no explainer', async () => {
    svc.fetchSharedSearchScans.mockResolvedValue([scan({ status: 'unsupported', explainer: '' })]);

    renderTab();

    expect(await screen.findByText(/can't summarise this type of search/)).toBeInTheDocument();
  });

  it('should show other parties a count of personal details and no values', async () => {
    svc.fetchSharedSearchScans.mockResolvedValue([scan({ personalFindingsCount: 2 })]);

    renderTab();

    expect(await screen.findByText(/2 details that identify a person are/)).toBeInTheDocument();
    expect(screen.queryByText(/only you can see these/)).not.toBeInTheDocument();
  });

  it('should use the singular for one personal detail', async () => {
    svc.fetchSharedSearchScans.mockResolvedValue([scan({ personalFindingsCount: 1 })]);

    renderTab();

    expect(await screen.findByText(/1 detail that identifies a person is/)).toBeInTheDocument();
  });

  it('should show the orderer the personal details themselves', async () => {
    svc.fetchSharedSearchScans.mockResolvedValue([
      scan({
        personalFindingsCount: 1,
        personalFindings: [{
          key: 'applicant',
          label: 'Applicant',
          value: 'Alex Synthetic',
          personal_data: true,
          confidence: 'high',
          provenance: 'LLC1, part 3',
        }],
      }),
    ]);

    renderTab();

    expect(await screen.findByText(/only you can see these/)).toBeInTheDocument();
    expect(screen.getByText(/Applicant: Alex Synthetic/)).toBeInTheDocument();
  });

  it('should word nothing as an enquiry or a next step', async () => {
    svc.fetchSharedSearchScans.mockResolvedValue([
      scan({ personalFindingsCount: 1 }),
      scan({ id: 'scan-2', status: 'pending' }),
      scan({ id: 'scan-3', status: 'error' }),
      scan({ id: 'scan-4', status: 'unsupported', explainer: '' }),
    ]);

    renderTab();
    await screen.findByText(/Being scanned/);

    expect(document.body.textContent).not.toMatch(/enquir|next step|you should/i);
  });

  it('should drop the scan button for an order that has a shared scan', async () => {
    svc.fetchReturnedOneSearchResults.mockResolvedValue([RETURNED]);
    svc.fetchSharedSearchScans.mockResolvedValue([SCAN]);

    renderTab();
    await screen.findByText('Search summary: OneSearch');

    expect(screen.queryByRole('button', { name: 'Scan my search results' })).not.toBeInTheDocument();
  });

  it('should keep the scan button when the shared scan is for another order', async () => {
    svc.fetchReturnedOneSearchResults.mockResolvedValue([RETURNED]);
    svc.fetchSharedSearchScans.mockResolvedValue([scan({ providerOrderId: 'order-2' })]);

    renderTab();

    expect(await screen.findByRole('button', { name: 'Scan my search results' })).toBeInTheDocument();
  });

  it('should behave as today when no shared scan can be read, as before the migration', async () => {
    svc.fetchReturnedOneSearchResults.mockResolvedValue([RETURNED]);

    renderTab();

    expect(await screen.findByRole('button', { name: 'Scan my search results' })).toBeInTheDocument();
    expect(screen.queryByText(/not legal advice/)).not.toBeInTheDocument();
  });

  it('should keep the PDF upload, labelled private', async () => {
    svc.fetchSharedSearchScans.mockResolvedValue([SCAN]);

    renderTab();
    await screen.findByText('Search summary: OneSearch');

    expect(screen.getAllByRole('button', { name: 'Upload a PDF' }).length).toBeGreaterThan(0);
    expect(screen.getByText('Property searches: private to you')).toBeInTheDocument();
    expect(screen.getByText(/Only you will see the result/)).toBeInTheDocument();
  });

  it('should say so when the shared scans cannot be read', async () => {
    svc.fetchSharedSearchScans.mockRejectedValue(new Error('shared search scans could not be read'));

    renderTab();

    expect(await screen.findByText(/couldn't load the search summaries/)).toBeInTheDocument();
  });
});
