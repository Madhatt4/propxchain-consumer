import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TitleNumberFinder from '../TitleNumberFinder';

vi.mock('@/services/hmlrTitle.service', () => ({
  findTitleByAddress: vi.fn().mockResolvedValue({ matches: [] }),
}));

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

/**
 * Why this file exists.
 *
 * The next-step card tells a stuck seller to "look up the title number on
 * HMLR" and sends them to this stage. The control that actually does that
 * lookup was 12px text, 16px tall, underlined only on hover — the least
 * visible thing on the page at the exact moment the user needs it. Found by
 * walking the seller flow in a real browser on 2026-07-31, not by any test.
 *
 * These pin the affordance. They deliberately assert the CLASSES rather than
 * computed pixels, because jsdom does not apply Tailwind — a computed-height
 * assertion would pass on anything.
 */
function setup(): void {
  render(
    <TitleNumberFinder
      postcode="SW1A 1AA"
      addressLine1="Buckingham Palace"
      onSelect={vi.fn()}
    />,
  );
}

describe('TitleNumberFinder — the collapsed trigger', () => {
  it('should render as a real button, not plain text', () => {
    setup();
    expect(
      screen.getByRole('button', { name: /know your title number/i }),
    ).toBeInTheDocument();
  });

  it('should carry a 44px minimum target (WCAG 2.5.5)', () => {
    // Not inline in a sentence, so the inline exception does not apply.
    setup();
    const btn = screen.getByRole('button', { name: /know your title number/i });
    expect(btn.className).toMatch(/min-h-11/);
  });

  it('should be underlined at rest, not only on hover', () => {
    // Hover-only underlining is invisible to anyone who has not already
    // found it with a mouse — and useless on touch.
    setup();
    const btn = screen.getByRole('button', { name: /know your title number/i });
    expect(btn.className).toMatch(/(^|\s)underline(\s|$)/);
  });

  it('should show a visible focus ring for keyboard users', () => {
    setup();
    const btn = screen.getByRole('button', { name: /know your title number/i });
    expect(btn.className).toMatch(/focus-visible:outline/);
  });

  it('should still open the finder when clicked', () => {
    // The affordance changes must not break what the control does.
    setup();
    fireEvent.click(screen.getByRole('button', { name: /know your title number/i }));
    expect(screen.getByText(/Find your title number/i)).toBeInTheDocument();
  });
});
