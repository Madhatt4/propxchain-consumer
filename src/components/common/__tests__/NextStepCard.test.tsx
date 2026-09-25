import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import NextStepCard from '../NextStepCard';
import type { NextStepRecommendation } from '../../../services/next-step.service';

const mockGetNextStep = vi.fn();

vi.mock('../../../services/next-step.service', async () => {
  const actual =
    await vi.importActual<typeof import('../../../services/next-step.service')>(
      '../../../services/next-step.service',
    );
  return {
    ...actual,
    getNextStep: (...args: unknown[]) => mockGetNextStep(...args),
  };
});

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

let mockCanAccess = true;
vi.mock('../../../hooks/useSubscription', () => ({
  useCanAccessFeature: () => mockCanAccess,
}));

function rec(over: Partial<NextStepRecommendation> = {}): NextStepRecommendation {
  return {
    blocker: 'no_solicitor',
    blockerLabel: 'Solicitor not yet assigned',
    urgency: 'blocking',
    why: 'Contract drafting cannot proceed without a solicitor.',
    partial: false,
    options: [
      {
        action: 'browse_conveyancer_panel',
        displayLabel: 'Browse the conveyancer panel',
        whyThis: 'Pre-vetted CLC firms ready to quote',
        estimatedDelayIfSkipped: 5,
        panelMatchCount: 42,
      },
      {
        action: 'invite_solicitor_by_email',
        displayLabel: 'Invite an existing solicitor',
        whyThis: 'Send the invite code to your firm',
        estimatedDelayIfSkipped: 3,
      },
    ],
    ...over,
  };
}

describe('NextStepCard', () => {
  beforeEach(() => {
    mockGetNextStep.mockReset();
    mockCanAccess = true;
  });

  it('renders nothing for users without next_step_recommendations entitlement', () => {
    mockCanAccess = false;
    mockGetNextStep.mockResolvedValue({ ok: rec() });
    const { container } = render(<NextStepCard txId="tx_test" />);
    expect(container.firstChild).toBeNull();
    expect(mockGetNextStep).not.toHaveBeenCalled();
  });

  it('renders the loading skeleton initially', () => {
    mockGetNextStep.mockReturnValue(new Promise(() => {})); // never resolves
    render(<NextStepCard txId="tx_test" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders the empty state when blocker = none', async () => {
    mockGetNextStep.mockResolvedValue({
      ok: rec({ blocker: 'none', blockerLabel: "You're up to date", options: [] }),
    });
    render(<NextStepCard txId="tx_test" />);
    await waitFor(() => expect(screen.getByTestId('next-step-empty')).toBeInTheDocument());
  });

  it('renders the success state with all options in full variant', async () => {
    mockGetNextStep.mockResolvedValue({ ok: rec() });
    render(<NextStepCard txId="tx_test" variant="full" />);
    await waitFor(() => expect(screen.getByTestId('next-step-card')).toBeInTheDocument());
    expect(screen.getByText('Solicitor not yet assigned')).toBeInTheDocument();
    expect(screen.getByText(/Browse the conveyancer panel/)).toBeInTheDocument();
    expect(screen.getByText(/Invite an existing solicitor/)).toBeInTheDocument();
    expect(screen.getByText(/42 firms/)).toBeInTheDocument();
  });

  it('renders only the top option in compact variant', async () => {
    mockGetNextStep.mockResolvedValue({ ok: rec() });
    render(<NextStepCard txId="tx_test" variant="compact" />);
    await waitFor(() => expect(screen.getByTestId('next-step-card')).toBeInTheDocument());
    expect(screen.getByText(/Browse the conveyancer panel/)).toBeInTheDocument();
    expect(screen.queryByText(/Invite an existing solicitor/)).not.toBeInTheDocument();
  });

  it('shows the partial banner when canister flagged degraded signals', async () => {
    mockGetNextStep.mockResolvedValue({ ok: rec({ partial: true }) });
    render(<NextStepCard txId="tx_test" />);
    await waitFor(() => expect(screen.getByTestId('next-step-card')).toBeInTheDocument());
    expect(screen.getByText(/Showing partial recommendations/)).toBeInTheDocument();
  });

  it('renders the error state on canister failure', async () => {
    mockGetNextStep.mockResolvedValue({
      err: { code: 'not_found', message: 'Transaction not found' },
    });
    render(<NextStepCard txId="tx_test" />);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByText('Transaction not found')).toBeInTheDocument();
  });

  it('exposes the urgency on the data attribute for downstream styling', async () => {
    mockGetNextStep.mockResolvedValue({ ok: rec({ urgency: 'soon' }) });
    render(<NextStepCard txId="tx_test" />);
    await waitFor(() => {
      const card = screen.getByTestId('next-step-card');
      expect(card.getAttribute('data-urgency')).toBe('soon');
    });
  });

  // Until 2026-07-28 the options rendered as <li> text with no handler
  // anywhere: the card named the next step and gave the user nothing to
  // click. These lock the affordance in.
  // See docs/2026-07-28-consumer-ux-audit.md.
  describe('actionable options', () => {
    it('should render each option as a button when onAction is provided', async () => {
      mockGetNextStep.mockResolvedValue({ ok: rec() });
      render(<NextStepCard txId="tx_test" onAction={vi.fn()} />);

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /Browse the conveyancer panel/ }),
        ).toBeInTheDocument();
      });
      expect(
        screen.getByRole('button', { name: /Invite an existing solicitor/ }),
      ).toBeInTheDocument();
    });

    it('should pass the action string and the full option to the handler', async () => {
      const onAction = vi.fn();
      mockGetNextStep.mockResolvedValue({ ok: rec() });
      render(<NextStepCard txId="tx_test" onAction={onAction} />);

      const btn = await screen.findByRole('button', {
        name: /Browse the conveyancer panel/,
      });
      btn.click();

      expect(onAction).toHaveBeenCalledTimes(1);
      expect(onAction.mock.calls[0][0]).toBe('browse_conveyancer_panel');
      // The option travels too, so a parent can use panelMatchCount or
      // estimatedDelayIfSkipped without refetching.
      expect(onAction.mock.calls[0][1]).toMatchObject({
        action: 'browse_conveyancer_panel',
        panelMatchCount: 42,
      });
    });

    it('should NOT render options as buttons when no handler is given', async () => {
      // The builder mounts a card per plot and has nowhere to send the user.
      // A button there would promise navigation that never happens, which is
      // worse than plain text.
      mockGetNextStep.mockResolvedValue({ ok: rec() });
      render(<NextStepCard txId="tx_test" />);

      await waitFor(() => {
        expect(screen.getByText('Browse the conveyancer panel')).toBeInTheDocument();
      });
      expect(
        screen.queryByRole('button', { name: /Browse the conveyancer panel/ }),
      ).not.toBeInTheDocument();
    });

    it('should still show only the top option on the compact variant', async () => {
      mockGetNextStep.mockResolvedValue({ ok: rec() });
      render(<NextStepCard txId="tx_test" variant="compact" onAction={vi.fn()} />);

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /Browse the conveyancer panel/ }),
        ).toBeInTheDocument();
      });
      expect(
        screen.queryByRole('button', { name: /Invite an existing solicitor/ }),
      ).not.toBeInTheDocument();
    });
  });
});
