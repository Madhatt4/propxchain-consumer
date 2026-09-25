// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockCompose = vi.fn();
const mockGet = vi.fn();
const mockSend = vi.fn();

vi.mock('@/services/conveyancerBrief.service', async () => {
  const actual = await vi.importActual<typeof import('@/services/conveyancerBrief.service')>(
    '@/services/conveyancerBrief.service',
  );
  return {
    ...actual,
    composeConveyancerBrief: (...a: unknown[]) => mockCompose(...a),
    getConveyancerBriefDraft: (...a: unknown[]) => mockGet(...a),
    sendConveyancerBrief: (...a: unknown[]) => mockSend(...a),
  };
});

import { ConveyancerBriefTab } from '../ConveyancerBriefTab';
import { ConveyancerBriefError } from '@/services/conveyancerBrief.service';
import type { ConveyancerBriefDraft } from '@/services/conveyancerBrief.service';

const DRAFT: ConveyancerBriefDraft = {
  briefId: 'brief-1',
  subject: '14 Example Road — work arising',
  bodyMd: '## Tasks\n\nRegistered charge 1 of 1 — redemption.',
  itemCount: 1,
  notAvailable: ['Survey scan not yet available'],
  status: 'draft',
};

function renderTab(): void {
  render(<ConveyancerBriefTab transactionId="tx-1" locked={false} requiredTier="starter" />);
}

beforeEach(() => {
  mockCompose.mockReset();
  mockGet.mockReset();
  mockSend.mockReset();
});

describe('ConveyancerBriefTab', () => {
  it('should show the unavailable state when the caller has no accepted conveyancer quote', async () => {
    mockGet.mockRejectedValue(new ConveyancerBriefError(403, 'forbidden'));
    renderTab();

    expect(await screen.findByText(/available once you've instructed a conveyancer/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /compose brief/i })).not.toBeInTheDocument();
  });

  it('should show the compose button when there is no current draft', async () => {
    mockGet.mockResolvedValue(null);
    renderTab();

    expect(await screen.findByRole('button', { name: /compose brief/i })).toBeInTheDocument();
  });

  it('should compose and render the draft with subject, body, item count and notAvailable', async () => {
    mockGet.mockResolvedValue(null);
    mockCompose.mockResolvedValue(DRAFT);
    renderTab();

    fireEvent.click(await screen.findByRole('button', { name: /compose brief/i }));

    expect(await screen.findByText(DRAFT.subject)).toBeInTheDocument();
    expect(screen.getByText('1 item of work arising')).toBeInTheDocument();
    expect(screen.getByTestId('brief-body')).toHaveTextContent('Registered charge 1 of 1');
    expect(screen.getByText('Survey scan not yet available')).toBeInTheDocument();
    expect(mockCompose).toHaveBeenCalledWith('tx-1');
  });

  it('should render an existing draft on load without requiring compose', async () => {
    mockGet.mockResolvedValue(DRAFT);
    renderTab();

    expect(await screen.findByText(DRAFT.subject)).toBeInTheDocument();
    expect(mockCompose).not.toHaveBeenCalled();
  });

  it('should show the no_work_arising empty state and allow checking again', async () => {
    mockGet.mockResolvedValue(null);
    mockCompose.mockResolvedValue({ briefId: null, reason: 'no_work_arising' });
    renderTab();

    fireEvent.click(await screen.findByRole('button', { name: /compose brief/i }));

    expect(await screen.findByText(/nothing to raise with your conveyancer yet/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /check again/i })).toBeInTheDocument();
  });

  it('should disable send while a draft is already in flight (status: sending)', async () => {
    mockGet.mockResolvedValue({ ...DRAFT, status: 'sending' });
    renderTab();

    const button = await screen.findByRole('button', { name: /sending/i });
    expect(button).toBeDisabled();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('should require an explicit confirm before sending, then show the sent confirmation', async () => {
    mockGet.mockResolvedValue(DRAFT);
    mockSend.mockResolvedValue({ sent: true, conveyancerId: 'conv-1' });
    renderTab();

    fireEvent.click(await screen.findByRole('button', { name: /send to conveyancer/i }));
    // Sending must not happen just from the first click — a confirm dialog gates it.
    expect(mockSend).not.toHaveBeenCalled();
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /yes, send/i }));

    await waitFor(() => expect(mockSend).toHaveBeenCalledWith('brief-1'));
    expect(await screen.findByRole('status')).toHaveTextContent('Sent to your conveyancer');
  });

  it('should let the user cancel out of the confirm dialog without sending', async () => {
    mockGet.mockResolvedValue(DRAFT);
    renderTab();

    fireEvent.click(await screen.findByRole('button', { name: /send to conveyancer/i }));
    fireEvent.click(await screen.findByRole('button', { name: /^cancel$/i }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('should treat 409 already_sent and already_sending as "cannot send right now"', async () => {
    mockGet.mockResolvedValueOnce(DRAFT).mockResolvedValueOnce(DRAFT);
    mockSend.mockRejectedValue(new ConveyancerBriefError(409, 'already_sent'));
    renderTab();

    fireEvent.click(await screen.findByRole('button', { name: /send to conveyancer/i }));
    fireEvent.click(await screen.findByRole('button', { name: /yes, send/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/already been sent/i);
  });

  it('should surface a 502 send failure while leaving the draft in place for retry', async () => {
    mockGet.mockResolvedValue(DRAFT);
    mockSend.mockRejectedValue(new ConveyancerBriefError(502, 'send_failed'));
    renderTab();

    fireEvent.click(await screen.findByRole('button', { name: /send to conveyancer/i }));
    fireEvent.click(await screen.findByRole('button', { name: /yes, send/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/draft is unchanged/i);
    // The draft itself is still rendered — nothing was lost.
    expect(screen.getByText(DRAFT.subject)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send to conveyancer/i })).not.toBeDisabled();
  });

  it('should surface a 429 rate limit on send distinctly', async () => {
    mockGet.mockResolvedValue(DRAFT);
    mockSend.mockRejectedValue(new ConveyancerBriefError(429, 'rate_limited', 120));
    renderTab();

    fireEvent.click(await screen.findByRole('button', { name: /send to conveyancer/i }));
    fireEvent.click(await screen.findByRole('button', { name: /yes, send/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/rate limited/i);
  });

  it('should surface a 404 unknown brief by returning to the empty state', async () => {
    mockGet.mockResolvedValue(DRAFT);
    mockSend.mockRejectedValue(new ConveyancerBriefError(404, 'not_found'));
    renderTab();

    fireEvent.click(await screen.findByRole('button', { name: /send to conveyancer/i }));
    fireEvent.click(await screen.findByRole('button', { name: /yes, send/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/no longer exists/i);
    expect(await screen.findByRole('button', { name: /compose brief/i })).toBeInTheDocument();
  });

  it('should flip to unavailable if the accepted quote disappears before send', async () => {
    mockGet.mockResolvedValue(DRAFT);
    mockSend.mockRejectedValue(new ConveyancerBriefError(403, 'forbidden'));
    renderTab();

    fireEvent.click(await screen.findByRole('button', { name: /send to conveyancer/i }));
    fireEvent.click(await screen.findByRole('button', { name: /yes, send/i }));

    expect(await screen.findByText(/available once you've instructed a conveyancer/i)).toBeInTheDocument();
  });

  it('should surface a 429 rate limit on compose without losing the empty state', async () => {
    mockGet.mockResolvedValue(null);
    mockCompose.mockRejectedValue(new ConveyancerBriefError(429, 'rate_limited', 60));
    renderTab();

    fireEvent.click(await screen.findByRole('button', { name: /compose brief/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/composed a brief recently/i);
    expect(screen.getByRole('button', { name: /compose brief/i })).toBeInTheDocument();
  });

  it('should keep the draft on screen when the post-409 resync itself fails', async () => {
    // First call is the initial load, second is the resync triggered by the
    // 409 below — that second call is the one that must not wipe the draft.
    mockGet.mockResolvedValueOnce(DRAFT).mockRejectedValueOnce(new Error('temporarily unavailable'));
    mockSend.mockRejectedValue(new ConveyancerBriefError(409, 'already_sending'));
    renderTab();

    fireEvent.click(await screen.findByRole('button', { name: /send to conveyancer/i }));
    fireEvent.click(await screen.findByRole('button', { name: /yes, send/i }));

    // The draft must still be rendered — a transient resync failure is not a
    // reason to drop back to the empty state.
    expect(await screen.findByText(DRAFT.subject)).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent(/already in progress/i);
  });

  it('should clear a stale error banner once a fresh load succeeds', async () => {
    mockGet.mockResolvedValueOnce(null);
    mockCompose.mockRejectedValueOnce(new ConveyancerBriefError(429, 'rate_limited', 60));
    const { rerender } = render(
      <ConveyancerBriefTab transactionId="tx-1" locked={false} requiredTier="starter" />,
    );

    fireEvent.click(await screen.findByRole('button', { name: /compose brief/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/composed a brief recently/i);

    // Switching to a different transaction re-runs the initial load — the
    // stale banner from tx-1 must not linger next to tx-2's fresh draft.
    mockGet.mockResolvedValueOnce(DRAFT);
    rerender(<ConveyancerBriefTab transactionId="tx-2" locked={false} requiredTier="starter" />);

    expect(await screen.findByText(DRAFT.subject)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
