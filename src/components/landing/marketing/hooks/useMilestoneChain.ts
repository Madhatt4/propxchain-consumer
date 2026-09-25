// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Drives the hero's animated milestone chain. `activeIndex` cycles 0 → 6 every
 * 1800ms (index 6 is the "all complete" beat before the reset to 0). Under
 * prefers-reduced-motion the chain freezes at a mid-state and no timer runs.
 */

import { useEffect, useState } from 'react';

const STEP_MS = 1800;
/** 7 states: six milestones plus the "all done" beat at index 6. */
const STATE_COUNT = 7;
/** Frozen mid-state shown when the user prefers reduced motion. */
const FROZEN_INDEX = 3;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function useMilestoneChain(): number {
  const [activeIndex, setActiveIndex] = useState<number>(() =>
    prefersReducedMotion() ? FROZEN_INDEX : 0,
  );

  useEffect(() => {
    if (prefersReducedMotion()) return undefined;
    const id = window.setInterval(() => {
      setActiveIndex((i) => (i + 1) % STATE_COUNT);
    }, STEP_MS);
    return () => window.clearInterval(id);
  }, []);

  return activeIndex;
}
