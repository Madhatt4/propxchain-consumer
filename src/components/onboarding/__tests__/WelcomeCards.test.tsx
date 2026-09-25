import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WelcomeCards from '../WelcomeCards';
import { WELCOME_CARDS } from '../welcomeCardsContent';

const noop = (): void => undefined;

describe('WelcomeCards', () => {
  it('should render nothing when closed', () => {
    const { container } = render(<WelcomeCards isOpen={false} onClose={noop} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('should open on the first card', () => {
    render(<WelcomeCards isOpen onClose={noop} />);
    expect(screen.getByRole('heading', { name: WELCOME_CARDS[0].heading })).toBeInTheDocument();
  });

  it('should disable Back on the first card', () => {
    render(<WelcomeCards isOpen onClose={noop} />);
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();
  });

  it('should advance to the next card', () => {
    render(<WelcomeCards isOpen onClose={noop} />);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('heading', { name: WELCOME_CARDS[1].heading })).toBeInTheDocument();
  });

  it('should go back to the previous card', () => {
    render(<WelcomeCards isOpen onClose={noop} />);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('heading', { name: WELCOME_CARDS[0].heading })).toBeInTheDocument();
  });

  it('should show Get started instead of Next on the last card', () => {
    render(<WelcomeCards isOpen onClose={noop} />);
    for (let i = 0; i < WELCOME_CARDS.length - 1; i += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    }
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Get started' })).toBeInTheDocument();
  });

  it('should close with dontShowAgain true by default', () => {
    const onClose = vi.fn();
    render(<WelcomeCards isOpen onClose={onClose} />);
    fireEvent.click(screen.getByTestId('welcome-cards-backdrop'));
    expect(onClose).toHaveBeenCalledWith(true);
  });

  it('should close with dontShowAgain false when the user asks to be reminded', () => {
    const onClose = vi.fn();
    render(<WelcomeCards isOpen onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Show this again next time'));
    fireEvent.click(screen.getByTestId('welcome-cards-backdrop'));
    expect(onClose).toHaveBeenCalledWith(false);
  });

  it('should close on Escape so keyboard users are not trapped', () => {
    const onClose = vi.fn();
    render(<WelcomeCards isOpen onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledWith(true);
  });

  it('should not close when the panel itself is clicked', () => {
    const onClose = vi.fn();
    render(<WelcomeCards isOpen onClose={onClose} />);
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('should focus the heading on open', () => {
    render(<WelcomeCards isOpen onClose={noop} />);
    expect(screen.getByRole('heading', { name: WELCOME_CARDS[0].heading })).toHaveFocus();
  });

  it('should move focus to the new heading when the card changes', () => {
    render(<WelcomeCards isOpen onClose={noop} />);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('heading', { name: WELCOME_CARDS[1].heading })).toHaveFocus();
  });

  it('should announce progress for screen readers', () => {
    render(<WelcomeCards isOpen onClose={noop} />);
    expect(screen.getByText(`Step 1 of ${WELCOME_CARDS.length}`)).toBeInTheDocument();
  });
});

describe('welcome card content', () => {
  it('should never name a UI element — the copy explains the process, not the screen', () => {
    const banned = /\bbutton\b|\btab\b|\bclick\b|\bsidebar\b|\bmenu\b|top right/i;
    for (const card of WELCOME_CARDS) {
      const text = [card.heading, card.intro, card.outro ?? '', ...(card.steps ?? []).flatMap((s) => [s.title, s.why])].join(' ');
      expect(banned.test(text), `card "${card.id}" mentions a UI element`).toBe(false);
    }
  });

  it('should give every step a reason, not just a label', () => {
    for (const card of WELCOME_CARDS) {
      for (const step of card.steps ?? []) {
        expect(step.why.length, `step "${step.title}" has no why`).toBeGreaterThan(20);
      }
    }
  });

  it('should teach both journeys', () => {
    const ids = WELCOME_CARDS.map((c) => c.id);
    expect(ids).toContain('selling');
    expect(ids).toContain('buying');
  });
});
