/**
 * Minimise behaviour for NextStepCard.
 *
 * Kept in its own file rather than bolted onto NextStepCard.test.tsx: that suite
 * asserts the default (non-minimisable) contract, and mixing the two makes it
 * easy to change a shared default without noticing which mounts it affects.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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

vi.mock('../../../hooks/useSubscription', () => ({
  useCanAccessFeature: () => true,
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
      },
    ],
    ...over,
  } as NextStepRecommendation;
}

describe('NextStepCard — minimise', () => {
  beforeEach(() => {
    localStorage.clear();
    mockGetNextStep.mockReset();
    mockGetNextStep.mockResolvedValue({ ok: rec() });
  });

  it('should not offer minimise unless asked', async () => {
    render(<NextStepCard txId="tx-1" />);
    await screen.findByTestId('next-step-card');
    expect(screen.queryByLabelText('Minimise next-step card')).not.toBeInTheDocument();
  });

  it('should offer minimise when minimisable', async () => {
    render(<NextStepCard txId="tx-1" minimisable />);
    await screen.findByTestId('next-step-card');
    expect(screen.getByLabelText('Minimise next-step card')).toBeInTheDocument();
  });

  it('should collapse to an icon when minimised', async () => {
    render(<NextStepCard txId="tx-1" minimisable />);
    await screen.findByTestId('next-step-card');

    fireEvent.click(screen.getByLabelText('Minimise next-step card'));

    await waitFor(() => {
      expect(screen.queryByTestId('next-step-card')).not.toBeInTheDocument();
    });
    expect(screen.getByTestId('next-step-minimised')).toBeInTheDocument();
  });

  it('should restore the full card from the icon', async () => {
    render(<NextStepCard txId="tx-1" minimisable />);
    await screen.findByTestId('next-step-card');
    fireEvent.click(screen.getByLabelText('Minimise next-step card'));

    fireEvent.click(await screen.findByTestId('next-step-minimised'));

    expect(await screen.findByTestId('next-step-card')).toBeInTheDocument();
  });

  it('should stay minimised across a remount while the blocker is unchanged', async () => {
    const { unmount } = render(<NextStepCard txId="tx-1" minimisable />);
    await screen.findByTestId('next-step-card');
    fireEvent.click(screen.getByLabelText('Minimise next-step card'));
    await screen.findByTestId('next-step-minimised');
    unmount();

    render(<NextStepCard txId="tx-1" minimisable />);

    expect(await screen.findByTestId('next-step-minimised')).toBeInTheDocument();
    expect(screen.queryByTestId('next-step-card')).not.toBeInTheDocument();
  });

  it('should reappear in full when the blocker changes', async () => {
    const { unmount } = render(<NextStepCard txId="tx-1" minimisable />);
    await screen.findByTestId('next-step-card');
    fireEvent.click(screen.getByLabelText('Minimise next-step card'));
    await screen.findByTestId('next-step-minimised');
    unmount();

    // The solicitor was appointed; the next blocker takes over.
    mockGetNextStep.mockResolvedValue({
      ok: rec({ blocker: 'no_searches', blockerLabel: 'Searches not ordered' }),
    });
    render(<NextStepCard txId="tx-1" minimisable />);

    expect(await screen.findByTestId('next-step-card')).toBeInTheDocument();
    expect(screen.queryByTestId('next-step-minimised')).not.toBeInTheDocument();
  });

  it('should keep minimise and close as separate states', async () => {
    render(<NextStepCard txId="tx-1" minimisable />);
    await screen.findByTestId('next-step-card');

    fireEvent.click(screen.getByLabelText('Hide next-step card for this transaction'));

    // Closing yields the inline pill, never the corner icon.
    expect(await screen.findByLabelText('Show hidden next step')).toBeInTheDocument();
    expect(screen.queryByTestId('next-step-minimised')).not.toBeInTheDocument();
  });

  it('should portal the closed-state restore control into the slot', async () => {
    const slot = document.createElement('div');
    slot.id = 'test-action-slot';
    document.body.appendChild(slot);

    render(<NextStepCard txId="tx-1" minimisable minimisedPortalId="test-action-slot" />);
    await screen.findByTestId('next-step-card');

    fireEvent.click(screen.getByLabelText('Hide next-step card for this transaction'));

    // The labelled pill was the last thing holding the strip above the stages
    // open — closed state joins the bar's icon buttons instead.
    const restore = await screen.findByTestId('next-step-restore');
    expect(slot).toContainElement(restore);
    expect(screen.queryByText(/Show next step/i)).not.toBeInTheDocument();

    slot.remove();
  });

  it('should scope minimised state per transaction', async () => {
    const { unmount } = render(<NextStepCard txId="tx-1" minimisable />);
    await screen.findByTestId('next-step-card');
    fireEvent.click(screen.getByLabelText('Minimise next-step card'));
    await screen.findByTestId('next-step-minimised');
    unmount();

    render(<NextStepCard txId="tx-2" minimisable />);

    expect(await screen.findByTestId('next-step-card')).toBeInTheDocument();
  });
});

describe('NextStepCard — overlay presentation', () => {
  beforeEach(() => {
    localStorage.clear();
    mockGetNextStep.mockReset();
    mockGetNextStep.mockResolvedValue({ ok: rec() });
  });

  it('should float over the page rather than sit in the flow', async () => {
    render(<NextStepCard txId="tx-1" presentation="overlay" />);
    expect(await screen.findByTestId('next-step-overlay')).toBeInTheDocument();
  });

  it('should stay in the flow by default', async () => {
    render(<NextStepCard txId="tx-1" />);
    await screen.findByTestId('next-step-card');
    expect(screen.queryByTestId('next-step-overlay')).not.toBeInTheDocument();
  });

  it('should be a dialog for assistive tech when floating', async () => {
    render(<NextStepCard txId="tx-1" presentation="overlay" />);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('should offer minimise without being asked, when floating', async () => {
    render(<NextStepCard txId="tx-1" presentation="overlay" />);
    await screen.findByTestId('next-step-card');
    expect(screen.getByLabelText('Minimise next-step card')).toBeInTheDocument();
  });

  it('should minimise when the backdrop is clicked', async () => {
    render(<NextStepCard txId="tx-1" presentation="overlay" />);
    fireEvent.click(await screen.findByTestId('next-step-overlay'));
    expect(await screen.findByTestId('next-step-minimised')).toBeInTheDocument();
  });

  it('should not minimise when the card itself is clicked', async () => {
    render(<NextStepCard txId="tx-1" presentation="overlay" />);
    fireEvent.click(await screen.findByTestId('next-step-card'));
    expect(screen.getByTestId('next-step-card')).toBeInTheDocument();
    expect(screen.queryByTestId('next-step-minimised')).not.toBeInTheDocument();
  });

  it('should minimise on Escape so the modal is not a keyboard trap', async () => {
    render(<NextStepCard txId="tx-1" presentation="overlay" />);
    await screen.findByTestId('next-step-card');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(await screen.findByTestId('next-step-minimised')).toBeInTheDocument();
  });

  it('should leave the minimised icon in the flow, not floating', async () => {
    render(<NextStepCard txId="tx-1" presentation="overlay" />);
    await screen.findByTestId('next-step-card');
    fireEvent.keyDown(window, { key: 'Escape' });
    await screen.findByTestId('next-step-minimised');
    expect(screen.queryByTestId('next-step-overlay')).not.toBeInTheDocument();
  });

  it('should float again when the blocker changes', async () => {
    const { unmount } = render(<NextStepCard txId="tx-1" presentation="overlay" />);
    await screen.findByTestId('next-step-card');
    fireEvent.keyDown(window, { key: 'Escape' });
    await screen.findByTestId('next-step-minimised');
    unmount();

    mockGetNextStep.mockResolvedValue({
      ok: rec({ blocker: 'no_searches', blockerLabel: 'Searches not ordered' }),
    });
    render(<NextStepCard txId="tx-1" presentation="overlay" />);

    expect(await screen.findByTestId('next-step-overlay')).toBeInTheDocument();
  });
});

describe('NextStepCard — overlay focus handling', () => {
  beforeEach(() => {
    localStorage.clear();
    mockGetNextStep.mockReset();
    mockGetNextStep.mockResolvedValue({ ok: rec() });
  });

  it('should move focus into the card when it floats', async () => {
    render(<NextStepCard txId="tx-1" presentation="overlay" />);
    expect(await screen.findByTestId('next-step-card')).toHaveFocus();
  });

  it('should not steal focus when inline', async () => {
    render(<NextStepCard txId="tx-1" />);
    await screen.findByTestId('next-step-card');
    expect(screen.getByTestId('next-step-card')).not.toHaveFocus();
  });

  it('should keep Tab inside the card — aria-modal is a promise', async () => {
    render(<NextStepCard txId="tx-1" presentation="overlay" />);
    const card = await screen.findByTestId('next-step-card');
    const focusable = card.querySelectorAll<HTMLElement>('button:not([disabled])');
    const last = focusable[focusable.length - 1];

    last.focus();
    fireEvent.keyDown(window, { key: 'Tab' });

    expect(focusable[0]).toHaveFocus();
  });

  it('should wrap backwards from the first element to the last', async () => {
    render(<NextStepCard txId="tx-1" presentation="overlay" />);
    const card = await screen.findByTestId('next-step-card');
    const focusable = card.querySelectorAll<HTMLElement>('button:not([disabled])');

    focusable[0].focus();
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });

    expect(focusable[focusable.length - 1]).toHaveFocus();
  });
});

describe('NextStepCard — acting on the advice', () => {
  beforeEach(() => {
    localStorage.clear();
    mockGetNextStep.mockReset();
    mockGetNextStep.mockResolvedValue({ ok: rec() });
  });

  it('should pass the action to the parent', async () => {
    const onAction = vi.fn();
    render(<NextStepCard txId="tx-1" presentation="overlay" onAction={onAction} />);
    fireEvent.click(await screen.findByText('Browse the conveyancer panel'));
    expect(onAction).toHaveBeenCalledWith('browse_conveyancer_panel', expect.anything());
  });

  it('should get out of the way once acted on, so it cannot cover the destination', async () => {
    render(<NextStepCard txId="tx-1" presentation="overlay" onAction={vi.fn()} />);
    fireEvent.click(await screen.findByText('Browse the conveyancer panel'));
    expect(await screen.findByTestId('next-step-minimised')).toBeInTheDocument();
    expect(screen.queryByTestId('next-step-overlay')).not.toBeInTheDocument();
  });

  it('should be one click back after acting', async () => {
    render(<NextStepCard txId="tx-1" presentation="overlay" onAction={vi.fn()} />);
    fireEvent.click(await screen.findByText('Browse the conveyancer panel'));
    fireEvent.click(await screen.findByTestId('next-step-minimised'));
    expect(await screen.findByTestId('next-step-card')).toBeInTheDocument();
  });

  it('should not self-dismiss when inline — nothing is covering anything', async () => {
    render(<NextStepCard txId="tx-1" onAction={vi.fn()} />);
    fireEvent.click(await screen.findByText('Browse the conveyancer panel'));
    expect(screen.getByTestId('next-step-card')).toBeInTheDocument();
  });
});

describe('NextStepCard — dismissal survives a navigating action', () => {
  beforeEach(() => {
    localStorage.clear();
    mockGetNextStep.mockReset();
    mockGetNextStep.mockResolvedValue({ ok: rec() });
  });

  it('should record the dismissal even if the action never returns', async () => {
    // Simulates onAction navigating away: everything after it is unreachable.
    const navigatingAction = vi.fn(() => {
      throw new Error('navigated away');
    });
    render(<NextStepCard txId="tx-1" presentation="overlay" onAction={navigatingAction} />);

    try {
      fireEvent.click(await screen.findByText('Browse the conveyancer panel'));
    } catch {
      // The thrown navigation is the point; the dismissal must already be stored.
    }

    expect(localStorage.getItem('dismissed:nextStep:tx-1')).toBe('min:no_solicitor');
  });
});
