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
vi.mock('@/services/icp.service', () => ({
  icpService: {
    getCompletionStatus: (...a: unknown[]) => mockGetStatus(...a),
    initiateCompletion: (...a: unknown[]) => mockInitiate(...a),
    confirmKeysReleased: (...a: unknown[]) => mockConfirmKeys(...a),
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
    await waitFor(() => expect(mockGetStatus).toHaveBeenCalledTimes(2));
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
