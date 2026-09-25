/**
 * useModalFocus — keep focus inside a floating card, and put it back after.
 *
 * `aria-modal="true"` is a promise to assistive tech: nothing behind this is
 * reachable. Rendering a backdrop does not keep that promise — a keyboard user
 * tabs straight through to the page underneath while a screen reader still says
 * "dialog". This is the piece that makes the attribute honest.
 *
 * Extracted because two surfaces now float the same way (NextStepCard and the
 * Move Narrator AI card, which supersedes it on premium). Two copies of focus
 * handling drift, and the tier toggle is exactly where that drift would show.
 */

import { useEffect, type RefObject } from 'react';

const FOCUSABLE =
  'button:not([disabled]), a[href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

export function useModalFocus(
  ref: RefObject<HTMLElement | null>,
  isActive: boolean,
  onEscape?: () => void,
): void {
  // Send focus in, and return it to whatever had it when we close.
  useEffect(() => {
    if (!isActive) return undefined;
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    return () => {
      // Only restore if the element is still around — the page may have moved on.
      if (previous && document.contains(previous)) previous.focus();
    };
  }, [isActive, ref]);

  useEffect(() => {
    if (!isActive) return undefined;
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        onEscape?.();
        return;
      }
      if (e.key !== 'Tab' || !ref.current) return;
      const focusable = ref.current.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === ref.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isActive, ref, onEscape]);
}
