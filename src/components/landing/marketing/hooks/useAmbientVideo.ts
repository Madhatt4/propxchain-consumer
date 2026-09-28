// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Starts a decorative background video only when the visitor has not asked for
 * reduced motion. The `autoPlay` attribute cannot honour that preference, so
 * playback is started here instead; with reduced motion on, the element keeps
 * showing its poster frame.
 *
 * Browsers only fall through `<source>` children when a source fails to load.
 * A file that loads but then fails to decode leaves the element frozen on its
 * first frame, so on an `error` event this hook moves to the next listed
 * source the browser can use and plays that instead.
 */

import { useEffect, useRef, type RefObject } from 'react';

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function sourceApplies(source: HTMLSourceElement, video: HTMLVideoElement): boolean {
  if (source.media && typeof window.matchMedia === 'function' && !window.matchMedia(source.media).matches) {
    return false;
  }
  return !source.type || video.canPlayType(source.type) !== '';
}

function nextSource(video: HTMLVideoElement, tried: Set<string>): string | null {
  for (const source of Array.from(video.querySelectorAll('source'))) {
    if (!tried.has(source.src) && sourceApplies(source, video)) return source.src;
  }
  return null;
}

export function useAmbientVideo(): RefObject<HTMLVideoElement> {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video || prefersReducedMotion()) return;

    // A blocked autoplay (data saver, low-power mode) rejects the promise. The
    // poster is an acceptable resting state, so the rejection is swallowed.
    const start = (): void => {
      video.play()?.catch(() => undefined);
    };

    const tried = new Set<string>();
    const onError = (): void => {
      if (video.currentSrc) tried.add(video.currentSrc);
      const fallback = nextSource(video, tried);
      if (!fallback) return; // Nothing left to try: the poster stays up.
      tried.add(fallback);
      video.src = fallback;
      video.load();
      start();
    };

    video.addEventListener('error', onError);
    // The error can land before this effect runs; catch that case too.
    if (video.error) onError();
    else start();

    return () => video.removeEventListener('error', onError);
  }, []);

  return ref;
}
