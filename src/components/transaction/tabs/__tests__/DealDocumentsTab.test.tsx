// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * "Documents on this deal": every party sees the deal's property documents,
 * grouped by kind, uploaders by role, and never a personal document. Mocks sit
 * at the boundaries (document_storage via icpService, Supabase) so the real
 * service and classifier run.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

const getDocumentsByTransaction = vi.fn();
const getTransaction = vi.fn();
const rpc = vi.fn();
const download = vi.fn();

vi.mock('@/services/icp.service', () => ({
  icpService: {
    getDocumentsByTransaction: (...a: unknown[]) => getDocumentsByTransaction(...a),
    getTransaction: (...a: unknown[]) => getTransaction(...a),
  },
}));
vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...a: unknown[]) => rpc(...a),
    storage: { from: () => ({ download: (...a: unknown[]) => download(...a) }) },
  },
}));
vi.mock('@/stores/authStore', () => ({ getStorePrincipalId: () => 'BUYER' }));

import { DealDocumentsTab } from '../DealDocumentsTab';

const LOC = (folder: string): string => `supabase://propxchain-documents/transactions/tx_1/${folder}/abc.pdf`;

const ROWS = [
  { id: 'doc_1', type: 'ta6_attachment', fileName: 'ta6_attachment.pdf', uploadedBy: 'SELLER', uploadedAt: '2026-11-01T10:00:00.000Z', storageLocation: LOC('ta6'), hash: 'a'.repeat(64) },
  { id: 'doc_2', type: 'surveyReport', fileName: 'surveyReport.pdf', uploadedBy: 'BUYER', uploadedAt: '2026-11-02T10:00:00.000Z', storageLocation: LOC('survey'), hash: 'b'.repeat(64) },
  { id: 'doc_3', type: 'sales_pack_floor_plan', fileName: 'sales_pack_floor_plan.pdf', uploadedBy: 'CONV', uploadedAt: '2026-11-03T10:00:00.000Z', storageLocation: LOC('sales-pack'), hash: 'c'.repeat(64) },
  { id: 'doc_4', type: 'proofOfFunds', fileName: 'Barclays statement.pdf', uploadedBy: 'BUYER', storageLocation: LOC('funding') },
  { id: 'doc_5', type: 'mortgageAgreement', fileName: 'mortgage.pdf', uploadedBy: 'BUYER', storageLocation: LOC('funding') },
  { id: 'doc_6', type: 'proof_of_identity', fileName: 'Passport - Jane.pdf', uploadedBy: 'SELLER', storageLocation: 'onchain' },
];

function rpcReturns(sides: unknown, scans: { data?: unknown; error?: unknown }): void {
  rpc.mockImplementation((name: string) =>
    Promise.resolve(name === 'get_share_party_sides' ? { data: sides, error: null } : { data: null, error: null, ...scans }),
  );
}

const MISSING_RPC = { error: { code: 'PGRST202', message: 'Could not find the function' } };

describe('DealDocumentsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTransaction.mockResolvedValue({ seller: 'SELLER', buyer: 'BUYER', solicitor: [], accessList: [] });
    rpcReturns([{ icp_principal: 'CONV', party_role: 'conveyancer', side: 'seller' }], MISSING_RPC);
  });

  it('should list property documents grouped by kind with role labels', async () => {
    getDocumentsByTransaction.mockResolvedValue(ROWS);
    render(<DealDocumentsTab transactionId="tx_1" />);

    const forms = await screen.findByRole('region', { name: 'Forms (TA6, TA7, TA10)' });
    expect(within(forms).getByText('TA6 attachment')).toBeInTheDocument();
    expect(within(forms).getByText(/^Seller/)).toBeInTheDocument();
    const survey = screen.getByRole('region', { name: 'Survey' });
    expect(within(survey).getByText(/Buyer \(you\)/)).toBeInTheDocument();
    const pack = screen.getByRole('region', { name: 'Sales pack' });
    expect(within(pack).getByText(/Seller's conveyancer/)).toBeInTheDocument();
  });

  it('should never list personal document types', async () => {
    getDocumentsByTransaction.mockResolvedValue(ROWS);
    render(<DealDocumentsTab transactionId="tx_1" />);

    await screen.findByRole('region', { name: 'Survey' });
    expect(screen.queryByText(/Barclays/)).not.toBeInTheDocument();
    expect(screen.queryByText(/mortgage/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Passport/)).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Open / })).toHaveLength(3);
  });

  it('should download the file from storage when Open is clicked', async () => {
    getDocumentsByTransaction.mockResolvedValue(ROWS);
    download.mockResolvedValue({ data: new Blob(['%PDF-'], { type: 'application/pdf' }), error: null });
    const createObjectURL = vi.fn(() => 'blob:x');
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    render(<DealDocumentsTab transactionId="tx_1" />);

    fireEvent.click(await screen.findByRole('button', { name: 'Open Survey report' }));

    await waitFor(() => expect(download).toHaveBeenCalledWith('transactions/tx_1/survey/abc.pdf'));
    await waitFor(() => expect(createObjectURL).toHaveBeenCalled());
  });

  it("should say the file can't be opened yet when storage refuses it", async () => {
    getDocumentsByTransaction.mockResolvedValue(ROWS);
    download.mockResolvedValue({ data: null, error: { message: 'Object not found' } });
    render(<DealDocumentsTab transactionId="tx_1" />);

    fireEvent.click(await screen.findByRole('button', { name: 'Open TA6 attachment' }));

    expect(await screen.findByRole('alert')).toHaveTextContent("can't be opened from your account yet");
    expect(screen.getByRole('region', { name: 'Forms (TA6, TA7, TA10)' })).toBeInTheDocument();
  });

  it('should hide the survey scan section when deal_survey_scans is missing', async () => {
    getDocumentsByTransaction.mockResolvedValue(ROWS);
    render(<DealDocumentsTab transactionId="tx_1" />);

    await screen.findByRole('region', { name: 'Survey' });
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('deal_survey_scans', { p_transaction_id: 'tx_1' }));
    expect(screen.queryByRole('region', { name: 'Survey scan results' })).not.toBeInTheDocument();
  });

  it('should show shared survey scan results when the RPC returns them', async () => {
    getDocumentsByTransaction.mockResolvedValue([]);
    rpcReturns([], {
      data: [{
        status: 'complete',
        findings: [{ key: 'roof', label: 'Roof', value: 'Condition 3', personal_data: false, confidence: 'high', provenance: 'p4' }],
        explainer: 'The roof needs work.',
        flags_for_conveyancer: [],
        personal_findings_count: 2,
      }],
    });
    render(<DealDocumentsTab transactionId="tx_1" />);

    expect(await screen.findByRole('region', { name: 'Survey scan results' })).toBeInTheDocument();
    expect(screen.getByText('The roof needs work.')).toBeInTheDocument();
    expect(screen.getByText(/2 personal findings kept/)).toBeInTheDocument();
  });

  it('should show the empty state when the deal has no property documents', async () => {
    getDocumentsByTransaction.mockResolvedValue([ROWS[3], ROWS[5]]);
    render(<DealDocumentsTab transactionId="tx_1" />);

    expect(await screen.findByText('No documents shared on this deal yet.')).toBeInTheDocument();
  });

  it('should offer a retry when the document list fails to load', async () => {
    getDocumentsByTransaction.mockRejectedValueOnce(new Error('canister down')).mockResolvedValue([]);
    render(<DealDocumentsTab transactionId="tx_1" />);

    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('No documents shared on this deal yet.')).toBeInTheDocument();
  });
});
