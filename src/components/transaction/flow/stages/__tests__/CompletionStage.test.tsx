import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CompletionStage } from '../CompletionStage';
import type { StageConfig, JourneyRole } from '../../../../../types/stage.types';
import type { CompletionStatus } from '@/services/completionStatus';
import type { KeysRole } from '@/lib/completionRoles';

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
  return {
    id: role === 'buyer' ? 'buyer-7' : 'seller-7', order: 7, title: 'Completion', description: '',
    journeyRole: role, prerequisiteStageIds: [], hasProviderMarketplace: false, serviceMode: 'mock', status: 'active',
  } as StageConfig;
}

function renderStage(role: JourneyRole, keysRole: KeysRole = 'none', onComplete = vi.fn()): ReturnType<typeof render> {
  return render(
    <CompletionStage
      stage={makeStage(role)}
      journeyRole={role}
      viewerRole={role}
      transactionId="tx-1"
      propertyAddress="1 Test Street"
      purchasePrice={250000}
      keysRole={keysRole}
      onComplete={onComplete}
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

  it('should disable the seller button until the buyer side has confirmed', async () => {
    mockGetStatus.mockResolvedValue(makeStatus());
    renderStage('seller');
    expect(await screen.findByRole('button', { name: 'Confirm funds received' })).toBeDisabled();
    expect(screen.getByText("Waiting for the buyer's side to confirm funds sent.")).toBeInTheDocument();
  });

  it('should enable the seller button once the buyer side has confirmed', async () => {
    mockGetStatus.mockResolvedValue(makeStatus({ buyer: { at: AT, byConveyancer: true } }));
    renderStage('seller');
    expect(await screen.findByRole('button', { name: 'Confirm funds received' })).toBeEnabled();
    expect(screen.getByText(/Confirmed by the buyer's conveyancer on 6 November 2026/)).toBeInTheDocument();
  });

  it('should label a side client-confirmed when no conveyancer confirmed it', async () => {
    mockGetStatus.mockResolvedValue(makeStatus({ buyer: { at: AT, byConveyancer: false } }));
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
    const done = makeStatus({
      status: 'blockchain_completed',
      buyer: { at: AT, byConveyancer: true },
      seller: { at: AT, byConveyancer: true },
    });
    mockGetStatus.mockResolvedValue(done);
    const roles: Array<[KeysRole, boolean]> = [['agent', true], ['seller', true], ['seller-with-agent', false], ['none', false]];
    for (const [keysRole, offered] of roles) {
      const { unmount } = renderStage('seller', keysRole);
      await screen.findByText('Keys released');
      expect(Boolean(screen.queryByRole('button', { name: 'Confirm keys released' }))).toBe(offered);
      unmount();
    }
  });

  it('should not offer keys released before completion', async () => {
    mockGetStatus.mockResolvedValue(makeStatus({ buyer: { at: AT, byConveyancer: true } }));
    renderStage('seller', 'agent');
    await screen.findByRole('button', { name: 'Confirm funds received' });
    expect(screen.queryByText('Keys released')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirm keys released' })).not.toBeInTheDocument();
  });

  it('should call confirmKeysReleased and show who released the keys', async () => {
    const done = makeStatus({ status: 'blockchain_completed', buyer: { at: AT, byConveyancer: true }, seller: { at: AT, byConveyancer: true } });
    mockGetStatus.mockResolvedValueOnce(done).mockResolvedValue({ ...done, keysReleased: { at: AT, byAgent: true } });
    mockConfirmKeys.mockResolvedValue({ success: true, message: "Keys released, confirmed by the seller's agent" });
    renderStage('seller', 'agent');
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm keys released' }));
    expect(await screen.findByText(/Confirmed by the seller's agent on 6 November 2026/)).toBeInTheDocument();
    expect(mockConfirmKeys).toHaveBeenCalledWith('tx-1');
  });

  it('should show the certificate only when the canister status is completed', async () => {
    mockGetStatus.mockResolvedValue(makeStatus({ buyer: { at: AT, byConveyancer: true }, seller: { at: AT, byConveyancer: true } }));
    const { unmount } = renderStage('seller');
    await screen.findByText(/Seller's side/);
    expect(screen.queryByText('Sale Complete')).not.toBeInTheDocument();
    unmount();

    const onComplete = vi.fn();
    mockGetStatus.mockResolvedValue(makeStatus({ status: 'land_registry_registered', seller: { at: AT, byConveyancer: true } }));
    renderStage('seller', 'none', onComplete);
    expect(await screen.findByText('Sale Complete')).toBeInTheDocument();
    expect(onComplete).toHaveBeenCalledWith('seller-7');
  });

  it('should say so when the completion status cannot be loaded', async () => {
    mockGetStatus.mockRejectedValue(new Error('network'));
    renderStage('buyer');
    expect(await screen.findByText(/Could not load completion from PropXchain/)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
