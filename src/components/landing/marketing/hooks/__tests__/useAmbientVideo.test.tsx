// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAmbientVideo } from '../useAmbientVideo';

function Harness(): JSX.Element {
  const ref = useAmbientVideo();
  return <video ref={ref} muted />;
}

function mockReducedMotion(isReduced: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: isReduced && query.includes('reduce'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

describe('useAmbientVideo', () => {
  let play: ReturnType<typeof vi.fn<() => Promise<void>>>;

  beforeEach(() => {
    play = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(play);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('should start playback when the visitor allows motion', () => {
    mockReducedMotion(false);

    render(<Harness />);

    expect(play).toHaveBeenCalledTimes(1);
  });

  it('should leave the poster showing when the visitor prefers reduced motion', () => {
    mockReducedMotion(true);

    render(<Harness />);

    expect(play).not.toHaveBeenCalled();
  });

  it('should not throw when the browser blocks autoplay', async () => {
    mockReducedMotion(false);
    play.mockRejectedValue(new DOMException('blocked', 'NotAllowedError'));

    expect(() => render(<Harness />)).not.toThrow();
    await Promise.resolve();
    expect(play).toHaveBeenCalledTimes(1);
  });

  describe('when a source fails to decode', () => {
    function SourcesHarness(): JSX.Element {
      const ref = useAmbientVideo();
      return (
        <video ref={ref} muted data-testid="video">
          <source src="/v/mobile.mp4" type="video/mp4" media="(max-width: 767px)" />
          <source src="/v/hero.webm" type="video/webm" />
          <source src="/v/hero.mp4" type="video/mp4" />
        </video>
      );
    }

    function failOn(video: HTMLVideoElement, src: string): void {
      Object.defineProperty(video, 'currentSrc', { configurable: true, get: () => new URL(src, window.location.href).href });
      video.dispatchEvent(new Event('error'));
    }

    beforeEach(() => {
      mockReducedMotion(false);
      vi.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockReturnValue('maybe');
      vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
    });

    it('should switch to the next usable source and play it', () => {
      const { getByTestId } = render(<SourcesHarness />);
      const video = getByTestId('video') as HTMLVideoElement;

      failOn(video, '/v/hero.webm');

      expect(new URL(video.src).pathname).toBe('/v/hero.mp4');
      expect(play).toHaveBeenCalledTimes(2);
    });

    it('should skip a source whose media query does not match', () => {
      const { getByTestId } = render(<SourcesHarness />);
      const video = getByTestId('video') as HTMLVideoElement;

      failOn(video, '/v/hero.mp4');

      // The mobile source is excluded (desktop viewport), and hero.mp4 has
      // already failed, so the only one left is the webm.
      expect(new URL(video.src).pathname).toBe('/v/hero.webm');
    });

    it('should leave the poster up once every source has failed', () => {
      const { getByTestId } = render(<SourcesHarness />);
      const video = getByTestId('video') as HTMLVideoElement;

      failOn(video, '/v/hero.webm');
      failOn(video, '/v/hero.mp4');

      expect(play).toHaveBeenCalledTimes(2);
    });
  });
});
