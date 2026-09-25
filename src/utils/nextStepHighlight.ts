/**
 * Briefly ring the thing the user was just sent to.
 *
 * Acting on a next-step recommendation moves the page. Without a marker the
 * user arrives somewhere new with no signal about which of the several panels
 * on screen was the point — the scroll happened, but the answer to "what am I
 * looking at?" did not.
 *
 * Deliberately inline styles, not Tailwind classes. Tailwind only emits classes
 * it can see in source; a class name assembled in a string at runtime is
 * invisible to that scan and would silently produce no styling in the
 * production build while working perfectly in dev.
 *
 * If a field inside the target declares `data-next-step-target`, that wins over
 * the panel — this is the hook for field-level precision as stages get tagged.
 */

const HIGHLIGHT_MS = 2400;
const RING = '3px solid rgb(90 122 106)'; // sage-dark, matching the card's urgency accent

export function flashNextStepTarget(container: HTMLElement | null | undefined): void {
  if (!container) return;

  const field = container.querySelector<HTMLElement>('[data-next-step-target]');
  const target = field ?? container;

  const previousOutline = target.style.outline;
  const previousOffset = target.style.outlineOffset;
  const previousRadius = target.style.borderRadius;

  target.style.outline = RING;
  target.style.outlineOffset = '4px';
  if (!previousRadius) target.style.borderRadius = '8px';

  // Put the caret where the eye is, but only for something actually typeable —
  // focusing a panel would announce the whole thing to a screen reader.
  if (field && typeof (field as HTMLInputElement).focus === 'function') {
    const tag = field.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') {
      (field as HTMLInputElement).focus({ preventScroll: true });
    }
  }

  window.setTimeout(() => {
    target.style.outline = previousOutline;
    target.style.outlineOffset = previousOffset;
    target.style.borderRadius = previousRadius;
  }, HIGHLIGHT_MS);
}
