// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { AgentListingRow } from '@/types/estateAgentListing.types';
import type { PropertyListing } from '@/types/listing.types';
import type { StartSaleProgress, StartSaleResult } from '@/services/startSale.service';

vi.mock('@/services/startSale.service', () => ({
  startSaleService: { startSale: vi.fn() },
}));

vi.mock('@/services/partyInvite.service', () => ({
  partyInviteService: { send: vi.fn() },
}));

import { startSaleService } from '@/services/startSale.service';
import { partyInviteService } from '@/services/partyInvite.service';
import StartSaleModal from '../StartSaleModal';

const mockStartSale = vi.mocked(startSaleService.startSale);
const mockSend = vi.mocked(partyInviteService.send);

function baseListing(overrides: Partial<PropertyListing>): PropertyListing {
  return {
    url: '',
    listingId: 'l1',
    source: 'manual',
    address: '1 High St, Sandy',
    postcode: 'SG19 1AA',
    price: 250000,
    propertyType: 'Terraced',
    bedrooms: 3,
    tenure: 'freehold',
    priceQualifier: '',
    bathrooms: 1,
    description: '',
    keyFeatures: [],
    images: [],
    floorplanUrl: null,
    epcRating: null,
    agentName: '',
    agentBranch: '',
    agentLogoUrl: null,
    councilTaxBand: null,
    propertyPhrase: '',
    provenance: {},
    ...overrides,
  };
}

function makeRow(overrides: Partial<AgentListingRow>): AgentListingRow {
  return {
    id: 'row-1',
    organisation_id: 'ag',
    slug: null,
    status: 'for_sale',
    source: 'manual',
    source_url: null,
    agent_url: null,
    listing: baseListing({}),
    provenance: {},
    material_info: {
      price: { value: 250000, source: 'listing' },
      tenure: { value: 'freehold', source: 'listing' },
      councilTaxBand: { value: null, source: 'missing' },
      epcRating: { value: null, source: 'missing' },
      epcFloorAreaSqm: { value: null, source: 'missing' },
      leaseYearsRemaining: { value: null, source: 'missing' },
      groundRentPerYear: { value: null, source: 'missing' },
      serviceChargePerYear: { value: null, source: 'missing' },
      floodRisk: { value: null, source: 'missing' },
      conservationArea: { value: null, source: 'missing' },
      listedBuilding: { value: null, source: 'missing' },
    },
    transaction_id: null,
    published_at: null,
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

function fillAndSubmitForm(name = 'Jane Seller', email = 'jane@example.com'): void {
  fireEvent.change(screen.getByLabelText(/seller name/i), { target: { value: name } });
  fireEvent.change(screen.getByLabelText(/seller email/i), { target: { value: email } });
  fireEvent.click(screen.getByRole('button', { name: /start sale/i }));
}

describe('StartSaleModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not submit when the seller name is missing', () => {
    render(<StartSaleModal isOpen listing={makeRow({})} agentPrincipal="agent-1" onClose={vi.fn()} onComplete={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/seller email/i), { target: { value: 'jane@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /start sale/i }));
    expect(mockStartSale).not.toHaveBeenCalled();
  });

  it('shows a validation error for an invalid email and does not submit', () => {
    const { container } = render(
      <StartSaleModal isOpen listing={makeRow({})} agentPrincipal="agent-1" onClose={vi.fn()} onComplete={vi.fn()} />,
    );
    fireEvent.change(screen.getByLabelText(/seller name/i), { target: { value: 'Jane Seller' } });
    fireEvent.change(screen.getByLabelText(/seller email/i), { target: { value: 'not-an-email' } });
    // fireEvent.submit dispatches the 'submit' event directly, bypassing
    // jsdom's native type="email" constraint validation that a real button
    // click would trigger — the app's own EMAIL_RE check is what's under test.
    fireEvent.submit(container.querySelector('form')!);
    expect(screen.getByText(/valid email/i)).toBeInTheDocument();
    expect(mockStartSale).not.toHaveBeenCalled();
  });

  it('calls startSale with the typed seller name and email', async () => {
    mockStartSale.mockImplementation(async (_input, onProgress) => {
      onProgress({ step: 4, status: 'success' });
      return { transactionId: 'tx-1', inviteCode: 'TX-0001-0001' };
    });
    render(
      <StartSaleModal isOpen listing={makeRow({})} agentPrincipal="agent-1" onClose={vi.fn()} onComplete={vi.fn()} />,
    );
    fillAndSubmitForm('Jane Seller', 'jane@example.com');

    await waitFor(() =>
      expect(mockStartSale).toHaveBeenCalledWith(
        expect.objectContaining({
          agentPrincipal: 'agent-1',
          sellerName: 'Jane Seller',
          sellerEmail: 'jane@example.com',
        }),
        expect.any(Function),
      ),
    );
  });

  it('renders progress steps as they report in', async () => {
    let progressCb: ((p: StartSaleProgress) => void) | undefined;
    mockStartSale.mockImplementation(
      (_input, onProgress) =>
        new Promise<StartSaleResult>(() => {
          progressCb = onProgress;
          onProgress({ step: 1, status: 'pending' });
        }),
    );
    render(
      <StartSaleModal isOpen listing={makeRow({})} agentPrincipal="agent-1" onClose={vi.fn()} onComplete={vi.fn()} />,
    );
    fillAndSubmitForm();

    expect(await screen.findByText(/creating the sale record/i)).toBeInTheDocument();
    expect(screen.getByText(/registering you on the deal/i)).toBeInTheDocument();
    expect(screen.getByText(/linking the listing/i)).toBeInTheDocument();
    expect(screen.getByText(/emailing the seller/i)).toBeInTheDocument();
    expect(progressCb).toBeDefined();
  });

  it('shows the transaction code and a re-send button when the invite email step fails', async () => {
    mockStartSale.mockImplementation(async (_input, onProgress) => {
      onProgress({ step: 1, status: 'success' });
      onProgress({ step: 2, status: 'success' });
      onProgress({ step: 3, status: 'success' });
      onProgress({ step: 4, status: 'failed', error: 'smtp down' });
      return { transactionId: 'tx-1', inviteCode: 'TX-0001-0001' };
    });
    render(
      <StartSaleModal isOpen listing={makeRow({})} agentPrincipal="agent-1" onClose={vi.fn()} onComplete={vi.fn()} />,
    );
    fillAndSubmitForm();

    expect(await screen.findByText('TX-0001-0001')).toBeInTheDocument();
    expect(screen.getByText(/invite email failed/i)).toBeInTheDocument();
    const resendButton = screen.getByRole('button', { name: /re-send/i });
    expect(resendButton).toBeInTheDocument();

    mockSend.mockResolvedValue({ ok: true, error: null });
    fireEvent.click(resendButton);

    await waitFor(() =>
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          transactionId: 'tx-1',
          inviteCode: 'TX-0001-0001',
          role: 'seller',
          side: 'seller',
          recipientName: 'Jane Seller',
          recipientEmail: 'jane@example.com',
        }),
      ),
    );
  });

  it('shows retry on a fatal (step 1-3) failure and re-runs the saga', async () => {
    mockStartSale.mockRejectedValueOnce(new Error('chain down'));
    render(
      <StartSaleModal isOpen listing={makeRow({})} agentPrincipal="agent-1" onClose={vi.fn()} onComplete={vi.fn()} />,
    );
    fillAndSubmitForm();

    const retryButton = await screen.findByRole('button', { name: /retry/i });

    mockStartSale.mockImplementation(async (_input, onProgress) => {
      onProgress({ step: 4, status: 'success' });
      return { transactionId: 'tx-2', inviteCode: 'TX-0002-0002' };
    });
    fireEvent.click(retryButton);

    await waitFor(() => expect(mockStartSale).toHaveBeenCalledTimes(2));
  });

  it('guards double-submit: clicking start sale twice in quick succession calls startSale exactly once', async () => {
    mockStartSale.mockImplementation(async (_input, onProgress) => {
      onProgress({ step: 4, status: 'success' });
      return { transactionId: 'tx-1', inviteCode: 'TX-0001-0001' };
    });
    render(
      <StartSaleModal isOpen listing={makeRow({})} agentPrincipal="agent-1" onClose={vi.fn()} onComplete={vi.fn()} />,
    );
    fireEvent.change(screen.getByLabelText(/seller name/i), { target: { value: 'Jane Seller' } });
    fireEvent.change(screen.getByLabelText(/seller email/i), { target: { value: 'jane@example.com' } });
    const submitButton = screen.getByRole('button', { name: /start sale/i });
    fireEvent.click(submitButton);
    fireEvent.click(submitButton);

    await waitFor(() => expect(mockStartSale).toHaveBeenCalledTimes(1));
  });

  it('calls onComplete with the result when Done is clicked', async () => {
    mockStartSale.mockImplementation(async (_input, onProgress) => {
      onProgress({ step: 4, status: 'success' });
      return { transactionId: 'tx-1', inviteCode: 'TX-0001-0001' };
    });
    const onComplete = vi.fn();
    render(
      <StartSaleModal isOpen listing={makeRow({})} agentPrincipal="agent-1" onClose={vi.fn()} onComplete={onComplete} />,
    );
    fillAndSubmitForm();

    const doneButton = await screen.findByRole('button', { name: /^done$/i });
    fireEvent.click(doneButton);

    expect(onComplete).toHaveBeenCalledWith({ transactionId: 'tx-1', inviteCode: 'TX-0001-0001' });
  });
});
