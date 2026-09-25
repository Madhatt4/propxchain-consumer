// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Scroll-reveal port. Observes every `.reveal` inside the given root and adds
 * `.in` as it enters the viewport, staggering siblings that share a parent by
 * ~60ms each. Threshold 0.12, with a small bottom rootMargin so reveals fire a
 * touch before the element is fully on screen. Reduced motion is handled in CSS
 * (final state shown immediately).
 */

import { RefObject, useEffect } from 'react';

const STAGGER_MS = 60;

export function useScrollReveal(rootRef: RefObject<HTMLElement>): void {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          const parent = el.parentElement;
          if (parent) {
            const siblings = Array.from(
              parent.querySelectorAll(':scope > .reveal'),
            );
            const idx = siblings.indexOf(el);
            el.style.transitionDelay = `${Math.max(0, idx) * STAGGER_MS}ms`;
          }
          el.classList.add('in');
          observer.unobserve(el);
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    );

    root.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [rootRef]);
}
