// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Starts a decorative background video only when the visitor has not asked for
 * reduced motion. The `autoPlay` attribute cannot honour that preference, so
 * playback is started here instead; with reduced motion on, the element keeps
 * showing its poster frame.
 */

import { useEffect, useRef, type RefObject } from 'react';

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function useAmbientVideo(): RefObject<HTMLVideoElement> {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video || prefersReducedMotion()) return;
    // A blocked autoplay (data saver, low-power mode) rejects the promise. The
    // poster is an acceptable resting state, so the rejection is swallowed.
    video.play()?.catch(() => undefined);
  }, []);

  return ref;
}
