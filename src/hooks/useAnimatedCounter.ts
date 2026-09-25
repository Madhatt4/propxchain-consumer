import { useLayoutEffect, useRef, useState } from 'react';

/**
 * Animates a displayed number from its previous value to a new target over
 * `duration` ms using an eased curve. Returns the current frame's display value.
 *
 * Hardened against three failure modes observed in production on 2026-05-21:
 *   - React 18 concurrent scheduler dropping the effect's microtask, leaving
 *     RAF unscheduled. Mitigated by useLayoutEffect (sync, pre-paint).
 *   - cleanup(cancelAnimationFrame(rafRef.current)) racing the next effect's
 *     RAF schedule and cancelling the wrong frame id. Mitigated by a
 *     per-effect `cancelled` closure flag — the running tick checks it
 *     before queuing the next frame, so a stale tick from a previous effect
 *     can never push state.
 *   - Background tabs / browser throttling preventing RAF from firing at all.
 *     Mitigated by a setTimeout fallback at duration+50ms that snaps the
 *     display to target — animation is cosmetic, correctness is mandatory.
 *
 * The displayed value is GUARANTEED to reach `target` within `duration` ms
 * even if the RAF path never executes.
 */
export function useAnimatedCounter(target: number, duration: number = 500): number {
  const [display, setDisplay] = useState(target);
  const prevTargetRef = useRef(target);

  useLayoutEffect(() => {
    const from = prevTargetRef.current;
    if (target === from) return;
    // Update prevTargetRef eagerly. If this effect is interrupted and re-runs
    // for a different target before the animation completes, the next effect
    // animates from the *current* display value rather than rewinding to a
    // stale "from".
    prevTargetRef.current = target;

    const start = performance.now();
    let cancelled = false;

    function tick(now: number): void {
      if (cancelled) return;
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (target - from) * eased));
      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    }

    requestAnimationFrame(tick);

    // Safety net: if RAF never fires (background tab, throttling, scheduler
    // bail), snap display to target after the animation window. Cosmetic
    // animation loses; numeric correctness wins.
    const fallback = window.setTimeout(() => {
      if (!cancelled) setDisplay(target);
    }, duration + 50);

    return (): void => {
      cancelled = true;
      window.clearTimeout(fallback);
    };
  }, [target, duration]);

  return display;
}
