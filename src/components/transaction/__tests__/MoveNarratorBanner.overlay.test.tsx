/**
 * The AI update card floats and minimises like the NextStepCard.
 *
 * Why this exists: on premium the AI card SUPERSEDES the NextStepCard (they say
 * the same thing), so a premium user opening a transaction sees this component
 * and not that one. Giving the next-step card the floating treatment while
 * leaving this as an inline banner would mean the tier toggle changed the
 * interaction model, not just the wording — which is exactly what Marc hit.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MoveNarratorBanner from '../MoveNarratorBanner';

const markRead = vi.fn();
let mockNotifications: Array<Record<string, unknown>> = [];
let mockIsPremium = true;

vi.mock('../../../hooks/useMoveNarratorNotifications', () => ({
  useMoveNarratorNotifications: () => ({ notifications: mockNotifications, markRead }),
}));

vi.mock('../../../hooks/useSubscription', () => ({
  useSubscription: () => ({ isPremium: mockIsPremium }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

function card(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'card-1',
    txId: 'tx-1',
    title: 'Your Merlin Drive sale needs a title number',
    body: 'Please look it up on HM Land Registry.',
    urgency: 'blocking',
    ...over,
  };
}

describe('MoveNarratorBanner — floating and minimise', () => {
  beforeEach(() => {
    localStorage.clear();
    markRead.mockReset();
    mockIsPremium = true;
    mockNotifications = [card()];
  });

  it('should float over the page rather than sit in the flow', () => {
    render(<MoveNarratorBanner txId="tx-1" />);
    expect(screen.getByTestId('move-narrator-overlay')).toBeInTheDocument();
  });

  it('should be a dialog for assistive tech', () => {
    render(<MoveNarratorBanner txId="tx-1" />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('should offer both minimise and close', () => {
    render(<MoveNarratorBanner txId="tx-1" />);
    expect(screen.getByLabelText('Minimise AI update')).toBeInTheDocument();
    expect(screen.getByLabelText('Dismiss AI update')).toBeInTheDocument();
  });

  it('should collapse to an icon when minimised', () => {
    render(<MoveNarratorBanner txId="tx-1" />);
    fireEvent.click(screen.getByLabelText('Minimise AI update'));
    expect(screen.getByTestId('move-narrator-minimised')).toBeInTheDocument();
    expect(screen.queryByTestId('move-narrator-overlay')).not.toBeInTheDocument();
  });

  it('should minimise on a backdrop click', () => {
    render(<MoveNarratorBanner txId="tx-1" />);
    fireEvent.click(screen.getByTestId('move-narrator-overlay'));
    expect(screen.getByTestId('move-narrator-minimised')).toBeInTheDocument();
  });

  it('should not minimise when the card itself is clicked', () => {
    render(<MoveNarratorBanner txId="tx-1" />);
    fireEvent.click(screen.getByTestId('move-narrator-banner'));
    expect(screen.queryByTestId('move-narrator-minimised')).not.toBeInTheDocument();
  });

  it('should restore from the icon', () => {
    render(<MoveNarratorBanner txId="tx-1" />);
    fireEvent.click(screen.getByLabelText('Minimise AI update'));
    fireEvent.click(screen.getByTestId('move-narrator-minimised'));
    expect(screen.getByTestId('move-narrator-banner')).toBeInTheDocument();
  });

  it('should stay minimised across a remount for the same card', () => {
    const { unmount } = render(<MoveNarratorBanner txId="tx-1" />);
    fireEvent.click(screen.getByLabelText('Minimise AI update'));
    unmount();

    render(<MoveNarratorBanner txId="tx-1" />);
    expect(screen.getByTestId('move-narrator-minimised')).toBeInTheDocument();
  });

  it('should float again when a newer AI update arrives', () => {
    const { unmount } = render(<MoveNarratorBanner txId="tx-1" />);
    fireEvent.click(screen.getByLabelText('Minimise AI update'));
    unmount();

    mockNotifications = [card({ id: 'card-2', title: 'Searches are back' })];
    render(<MoveNarratorBanner txId="tx-1" />);

    expect(screen.getByTestId('move-narrator-overlay')).toBeInTheDocument();
  });

  it('should still mark the card read when closed rather than minimised', () => {
    render(<MoveNarratorBanner txId="tx-1" />);
    fireEvent.click(screen.getByLabelText('Dismiss AI update'));
    expect(markRead).toHaveBeenCalledWith('card-1');
  });

  it('should render nothing at all on the starter tier', () => {
    mockIsPremium = false;
    const { container } = render(<MoveNarratorBanner txId="tx-1" />);
    expect(container).toBeEmptyDOMElement();
  });

  // The card floats over a bg-black/40 backdrop (see move-narrator-overlay
  // above). A translucent card background there composites with that backdrop
  // into a murky, low-contrast panel — the exact bug this guards against. Both
  // urgency variants must keep an opaque base in both themes.
  it('should give the urgent card an opaque background in both themes', () => {
    mockNotifications = [card({ urgency: 'blocking' })];
    render(<MoveNarratorBanner txId="tx-1" />);
    const el = screen.getByTestId('move-narrator-banner');
    expect(el.className).toMatch(/(^|\s)bg-emerald-50(\s|$)/);
    expect(el.className).toMatch(/(^|\s)dark:bg-emerald-950(\s|$)/);
    expect(el.className).not.toMatch(/bg-emerald-50\/\d/);
    expect(el.className).not.toMatch(/dark:bg-emerald-950\/\d/);
  });

  it('should give the non-urgent card an opaque background in both themes', () => {
    mockNotifications = [card({ urgency: 'later' })];
    render(<MoveNarratorBanner txId="tx-1" />);
    const el = screen.getByTestId('move-narrator-banner');
    expect(el.className).toMatch(/(^|\s)bg-stone-50(\s|$)/);
    expect(el.className).toMatch(/(^|\s)dark:bg-slate-900(\s|$)/);
    expect(el.className).not.toMatch(/bg-stone-50\/\d/);
    expect(el.className).not.toMatch(/dark:bg-slate-900\/\d/);
  });
});
