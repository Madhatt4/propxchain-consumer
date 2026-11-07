import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { CompletionStage } from '../CompletionStage';
import { COMPLETION_POLL_MS } from '../completion/useCompletionStatus';
import type { ComponentProps } from 'react';
import type { StageConfig, JourneyRole } from '../../../../../types/stage.types';
import type { CompletionStatus } from '@/services/completionStatus';

const mockGetStatus = vi.fn();
const mockInitiate = vi.fn();
const mockConfirmKeys = vi.fn();
const mockGetEvents = vi.fn();
const mockLedger = { available: true };
vi.mock('@/services/icp.service', () => ({
  icpService: {
    getCompletionStatus: (...a: unknown[]) => mockGetStatus(...a),
    initiateCompletion: (...a: unknown[]) => mockInitiate(...a),
    confirmKeysReleased: (...a: unknown[]) => mockConfirmKeys(...a),
    get ledgerManager() {
      return mockLedger.available ? { getEventsByTransaction: (...a: unknown[]) => mockGetEvents(...a) } : null;
    },
  },
}));
const mockScheduleExpiry = vi.fn();
vi.mock('@/services/documentShare.service', () => ({
  documentShareService: { scheduleExpiryForDeal: (...a: unknown[]) => mockScheduleExpiry(...a) },
}));
vi.mock('@/utils/logger', () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() } }));

const AT = new Date('2026-11-06T12:00:00Z');
const BY_CONVEYANCER = { at: AT, byConveyancer: true };
const BY_CLIENT = { at: AT, byConveyancer: false };

function makeStatus(overrides: Partial<CompletionStatus> = {}): CompletionStatus {
  return {
    buyer: null,
    seller: null,
    conveyancerActing: { buyer: false, seller: false },
    keysReleased: null,
    status: 'exchanged',
    ...overrides,
  };
}

function makeStage(role: JourneyRole): StageConfig {
  const stage: StageConfig = {
    id: role === 'buyer' ? 'buyer-7' : 'seller-7',
    order: 7,
    title: 'Completion',
    description: '',
    status: 'active',
    journeyRole: role,
    prerequisiteStageIds: [],
    hasProviderMarketplace: false,
    serviceMode: 'real-readwrite',
  };
  return stage;
}

type StageProps = ComponentProps<typeof CompletionStage>;

function renderStage(role: JourneyRole, overrides: Partial<StageProps> = {}): ReturnType<typeof render> {
  return render(
    <CompletionStage
      stage={makeStage(role)}
      journeyRole={role}
      viewerRole={role}
      viewerIsParty
      transactionId="tx-1"
      propertyAddress="1 Test Street"
      purchasePrice={250000}
      keysRole="none"
      onComplete={vi.fn()}
      {...overrides}
    />,
  );
}

describe('CompletionStage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLedger.available = true;
    mockGetEvents.mockResolvedValue([]);
    mockScheduleExpiry.mockResolvedValue('ok');
  });

  it('should show read-only text and no button when a conveyancer acts for the viewer side', async () => {
    mockGetStatus.mockResolvedValue(makeStatus({ conveyancerActing: { buyer: true, seller: false } }));
    renderStage('buyer');
    expect(await screen.findByText('Your conveyancer confirms this on PropXchain.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirm funds sent' })).not.toBeInTheDocument();
  });

  it('should call initiateCompletion with SHA-256 hashes when a buyer with no conveyancer confirms funds sent', async () => {
    mockGetStatus.mockResolvedValue(makeStatus());
    mockInitiate.mockResolvedValue({ success: true, message: 'Waiting for the seller side.' });
    renderStage('buyer');
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm funds sent' }));
    await waitFor(() => expect(mockInitiate).toHaveBeenCalledTimes(1));
    const [txId, fundsHash, completionHash] = mockInitiate.mock.calls[0] as [string, string, string];
    expect(txId).toBe('tx-1');
    expect(fundsHash).toMatch(/^[0-9a-f]{64}$/);
    expect(completionHash).toMatch(/^[0-9a-f]{64}$/);
    await waitFor(() => expect(mockGetStatus).toHaveBeenCalledTimes(3));
  });

  it('should never give a delegate such as the estate agent a money button', async () => {
    mockGetStatus.mockResolvedValue(makeStatus({ buyer: BY_CONVEYANCER }));
    renderStage('seller', { viewerIsParty: false, keysRole: 'agent' });
    await screen.findByText(/Seller's side/);
    expect(screen.queryByRole('button', { name: 'Confirm funds received' })).not.toBeInTheDocument();
    expect(screen.queryByText('Your conveyancer confirms this on PropXchain.')).not.toBeInTheDocument();
  });

  it('should disable the seller button until the buyer side has confirmed', async () => {
    mockGetStatus.mockResolvedValue(makeStatus());
    renderStage('seller');
    expect(await screen.findByRole('button', { name: 'Confirm funds received' })).toBeDisabled();
    expect(screen.getByText("Waiting for the buyer's side to confirm funds sent.")).toBeInTheDocument();
  });

  it('should enable the seller button once the buyer side has confirmed', async () => {
    mockGetStatus.mockResolvedValue(makeStatus({ buyer: BY_CONVEYANCER }));
    renderStage('seller');
    expect(await screen.findByRole('button', { name: 'Confirm funds received' })).toBeEnabled();
    expect(screen.getByText(/Confirmed by the buyer's conveyancer on 6 November 2026/)).toBeInTheDocument();
  });

  it.each([
    ['price is missing', { purchasePrice: undefined }],
    ['price is zero', { purchasePrice: 0 }],
    ['address is a placeholder', { propertyAddress: 'Unknown property' }],
    ['address is blank', { propertyAddress: '  ' }],
  ])('should disable the confirm button and never hash when the %s', async (_label, overrides) => {
    mockGetStatus.mockResolvedValue(makeStatus());
    renderStage('buyer', overrides);
    const button = await screen.findByRole('button', { name: 'Confirm funds sent' });
    expect(button).toBeDisabled();
    expect(screen.getByText('The agreed price or address is missing — ask your conveyancer or support.')).toBeInTheDocument();
    fireEvent.click(button);
    expect(mockInitiate).not.toHaveBeenCalled();
  });

  it('should label a side client-confirmed when no conveyancer confirmed it', async () => {
    mockGetStatus.mockResolvedValue(makeStatus({ buyer: BY_CLIENT }));
    renderStage('seller');
    expect(await screen.findByText(/Client-confirmed, not verified by a conveyancer, on 6 November 2026/)).toBeInTheDocument();
  });

  it('should show the canister error text verbatim', async () => {
    mockGetStatus.mockResolvedValue(makeStatus());
    mockInitiate.mockResolvedValue({ success: false, message: 'Your conveyancer confirms completion for your side.' });
    renderStage('buyer');
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm funds sent' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Your conveyancer confirms completion for your side.');
  });

  it('should offer keys released only to the agent or a seller without an agent, after completion', async () => {
    mockGetStatus.mockResolvedValue(makeStatus({ status: 'blockchain_completed', buyer: BY_CONVEYANCER, seller: BY_CONVEYANCER }));
    const roles: Array<[StageProps['keysRole'], boolean]> = [['agent', true], ['seller', true], ['seller-with-agent', false], ['none', false]];
    for (const [keysRole, offered] of roles) {
      const { unmount } = renderStage('seller', { keysRole });
      await screen.findByText('Keys released');
      expect(Boolean(screen.queryByRole('button', { name: 'Confirm keys released' }))).toBe(offered);
      unmount();
    }
  });

  it('should not offer keys released before completion', async () => {
    mockGetStatus.mockResolvedValue(makeStatus({ buyer: BY_CONVEYANCER }));
    renderStage('seller', { keysRole: 'agent' });
    await screen.findByText(/Seller's side/);
    expect(screen.queryByText('Keys released')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirm keys released' })).not.toBeInTheDocument();
  });

  it('should call confirmKeysReleased and show who released the keys', async () => {
    const done = makeStatus({ status: 'blockchain_completed', buyer: BY_CONVEYANCER, seller: BY_CONVEYANCER });
    mockGetStatus.mockResolvedValueOnce(done).mockResolvedValue({ ...done, keysReleased: { at: AT, byAgent: true } });
    mockConfirmKeys.mockResolvedValue({ success: true, message: "Keys released, confirmed by the seller's agent" });
    renderStage('seller', { keysRole: 'agent', viewerIsParty: false });
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm keys released' }));
    expect(await screen.findByText(/Confirmed by the seller's agent on 6 November 2026/)).toBeInTheDocument();
    expect(mockConfirmKeys).toHaveBeenCalledWith('tx-1');
  });

  it('should show the completion record only when the canister status is completed', async () => {
    mockGetStatus.mockResolvedValue(makeStatus({ buyer: BY_CONVEYANCER, seller: BY_CONVEYANCER }));
    const { unmount } = renderStage('seller');
    await screen.findByText(/Seller's side/);
    expect(screen.queryByText('Completion record')).not.toBeInTheDocument();
    unmount();

    const onComplete = vi.fn();
    mockGetStatus.mockResolvedValue(makeStatus({ status: 'land_registry_registered', buyer: BY_CONVEYANCER, seller: BY_CONVEYANCER }));
    renderStage('seller', { onComplete });
    expect(await screen.findByText('Completion record')).toBeInTheDocument();
    expect(onComplete).toHaveBeenCalledWith('seller-7');
  });

  it('should say on the completion record which side was only client-confirmed', async () => {
    mockGetStatus.mockResolvedValue(makeStatus({ status: 'blockchain_completed', buyer: BY_CLIENT, seller: BY_CONVEYANCER }));
    renderStage('seller');
    expect(await screen.findByText(/^Buyer's side: Client-confirmed, not verified by a conveyancer/)).toBeInTheDocument();
    expect(screen.getByText(/^Seller's side: Confirmed by the seller's conveyancer/)).toBeInTheDocument();
    expect(screen.queryByText('Congratulations!')).not.toBeInTheDocument();
  });

  it('should say so when the completion status cannot be loaded', async () => {
    mockGetStatus.mockRejectedValue(new Error('network'));
    renderStage('buyer');
    expect(await screen.findByText(/Could not load completion from PropXchain/)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('CompletionStage completion statement', () => {
  const SELLER_CONV = 'rrkah-fqaaa-aaaaa-aaaaq-cai';
  const FILE_HASH = 'd'.repeat(64);
  const statementEvent = {
    eventType: 'doc_registered',
    details: `Document completion_statement registered by ${SELLER_CONV}`,
    metadata: [`docHash=${FILE_HASH};docType=completion_statement`],
    timestamp: BigInt(AT.getTime()) * 1_000_000n,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockLedger.available = true;
    mockScheduleExpiry.mockResolvedValue('ok');
  });

  it('should show the client a read-only line when the seller\'s conveyancer has uploaded it', async () => {
    mockGetStatus.mockResolvedValue(makeStatus({ conveyancerActing: { buyer: true, seller: true } }));
    mockGetEvents.mockResolvedValue([statementEvent]);
    renderStage('buyer', { sellerConveyancer: SELLER_CONV });
    expect(await screen.findByTestId('completion-statement-line')).toHaveTextContent(
      "Completion statement: uploaded by the seller's conveyancer on 6 November 2026. Its fingerprint is recorded on PropXchain.",
    );
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('should say it is not uploaded yet before completion', async () => {
    mockGetStatus.mockResolvedValue(makeStatus());
    mockGetEvents.mockResolvedValue([]);
    renderStage('seller', { sellerConveyancer: SELLER_CONV });
    expect(await screen.findByTestId('completion-statement-line')).toHaveTextContent(
      "Completion statement: not uploaded yet by the seller's conveyancer.",
    );
  });

  it('should show no statement line when no seller\'s conveyancer is on the deal', async () => {
    mockGetStatus.mockResolvedValue(makeStatus());
    renderStage('buyer');
    await screen.findByRole('button', { name: 'Confirm funds sent' });
    expect(screen.queryByTestId('completion-statement-line')).not.toBeInTheDocument();
    expect(mockGetEvents).not.toHaveBeenCalled();
  });

  it('should anchor the uploaded statement\'s file hash when a client confirms', async () => {
    mockGetStatus.mockResolvedValue(makeStatus());
    mockGetEvents.mockResolvedValue([statementEvent]);
    mockInitiate.mockResolvedValue({ success: true, message: 'Waiting for the seller side.' });
    renderStage('buyer', { sellerConveyancer: SELLER_CONV });
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm funds sent' }));
    await waitFor(() => expect(mockInitiate).toHaveBeenCalledTimes(1));
    const [, fundsHash, completionHash] = mockInitiate.mock.calls[0] as [string, string, string];
    expect(completionHash).toBe(FILE_HASH);
    expect(fundsHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("should refuse to confirm when the seller's conveyancer is acting but cannot be resolved", async () => {
    mockGetStatus.mockResolvedValue(makeStatus({ conveyancerActing: { buyer: false, seller: true } }));
    mockGetEvents.mockResolvedValue([statementEvent]);
    renderStage('buyer', { sellerConveyancer: null });
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm funds sent' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("The seller's conveyancer on this deal could not be confirmed");
    expect(mockInitiate).not.toHaveBeenCalled();
  });

  it("should ignore statements and record the deal details when no seller's conveyancer is on the deal", async () => {
    mockGetStatus.mockResolvedValue(makeStatus());
    mockGetEvents.mockResolvedValue([statementEvent]);
    mockInitiate.mockResolvedValue({ success: true, message: 'Waiting for the seller side.' });
    renderStage('buyer', { sellerConveyancer: null });
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm funds sent' }));
    await waitFor(() => expect(mockInitiate).toHaveBeenCalledTimes(1));
    expect(mockInitiate.mock.calls[0][2]).not.toBe(FILE_HASH);
    expect(screen.queryByText(/No completion statement has been uploaded/)).not.toBeInTheDocument();
  });

  it('should refuse to confirm when the audit trail cannot be read', async () => {
    mockGetStatus.mockResolvedValue(makeStatus());
    mockLedger.available = false;
    renderStage('buyer', { sellerConveyancer: SELLER_CONV });
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm funds sent' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not check for a completion statement. Please try again.');
    expect(mockInitiate).not.toHaveBeenCalled();
  });

  it('should say the statement could not be loaded when the read fails', async () => {
    mockGetStatus.mockResolvedValue(makeStatus());
    mockGetEvents.mockRejectedValue(new Error('network'));
    renderStage('buyer', { sellerConveyancer: SELLER_CONV });
    expect(await screen.findByText('Could not load the completion statement.')).toBeInTheDocument();
  });

  it('should warn before confirming when no statement has been uploaded', async () => {
    mockGetStatus.mockResolvedValue(makeStatus());
    mockGetEvents.mockResolvedValue([]);
    renderStage('buyer', { sellerConveyancer: SELLER_CONV });
    expect(await screen.findByText(
      "No completion statement has been uploaded. The deal details will be recorded instead, and a statement can't be added after this.",
    )).toBeInTheDocument();
  });

  it('should not warn when a statement has been uploaded', async () => {
    mockGetStatus.mockResolvedValue(makeStatus());
    mockGetEvents.mockResolvedValue([statementEvent]);
    renderStage('buyer', { sellerConveyancer: SELLER_CONV });
    await screen.findByText(/Its fingerprint is recorded on PropXchain/);
    expect(screen.queryByText(/No completion statement has been uploaded/)).not.toBeInTheDocument();
  });

  it('should show a statement uploaded after the first confirmation as not the recorded one', async () => {
    const lateEvent = { ...statementEvent, timestamp: BigInt(AT.getTime() + 3_600_000) * 1_000_000n };
    mockGetStatus.mockResolvedValue(makeStatus({ buyer: BY_CONVEYANCER, conveyancerActing: { buyer: true, seller: true } }));
    mockGetEvents.mockResolvedValue([lateEvent]);
    renderStage('buyer', { sellerConveyancer: SELLER_CONV });
    const line = await screen.findByTestId('completion-statement-line');
    expect(line).toHaveTextContent('none was uploaded before completion was confirmed, so the deal details were recorded instead.');
    expect(line).toHaveTextContent('A statement uploaded on 6 November 2026: uploaded after completion was confirmed — not the recorded statement.');
    expect(line).not.toHaveTextContent('Its fingerprint is recorded on PropXchain');
  });

  it('should send the statement in force at the first confirmation, never a later one', async () => {
    const LATER_HASH = 'f'.repeat(64);
    const lateEvent = {
      ...statementEvent,
      metadata: [`docHash=${LATER_HASH};docType=completion_statement`],
      timestamp: BigInt(AT.getTime() + 3_600_000) * 1_000_000n,
    };
    mockGetStatus.mockResolvedValue(makeStatus({ buyer: BY_CLIENT }));
    mockGetEvents.mockResolvedValue([statementEvent, lateEvent]);
    mockInitiate.mockResolvedValue({ success: true, message: 'Completed.' });
    renderStage('seller', { sellerConveyancer: SELLER_CONV });
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm funds received' }));
    await waitFor(() => expect(mockInitiate).toHaveBeenCalledTimes(1));
    expect(mockInitiate.mock.calls[0][2]).toBe(FILE_HASH);
  });
});

describe('CompletionStage live updates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  async function flush(): Promise<void> {
    await act(async () => { await Promise.resolve(); });
  }

  it('should re-read every 20 seconds and on window focus until completed, then stop', async () => {
    mockGetStatus.mockResolvedValue(makeStatus());
    renderStage('buyer');
    await flush();
    expect(mockGetStatus).toHaveBeenCalledTimes(1);

    await act(async () => { await vi.advanceTimersByTimeAsync(COMPLETION_POLL_MS); });
    expect(mockGetStatus).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(/Confirmed by the buyer's conveyancer/)).not.toBeInTheDocument();

    mockGetStatus.mockResolvedValue(makeStatus({ status: 'blockchain_completed', buyer: BY_CONVEYANCER, seller: BY_CONVEYANCER }));
    await act(async () => { window.dispatchEvent(new Event('focus')); await Promise.resolve(); });
    expect(mockGetStatus).toHaveBeenCalledTimes(3);
    expect(screen.getByText('Completion record')).toBeInTheDocument();

    await act(async () => { await vi.advanceTimersByTimeAsync(COMPLETION_POLL_MS * 3); });
    window.dispatchEvent(new Event('focus'));
    expect(mockGetStatus).toHaveBeenCalledTimes(3);
  });

  it('should stop polling on unmount', async () => {
    mockGetStatus.mockResolvedValue(makeStatus());
    const { unmount } = renderStage('buyer');
    await flush();
    unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(COMPLETION_POLL_MS * 2); });
    expect(mockGetStatus).toHaveBeenCalledTimes(1);
  });
});
