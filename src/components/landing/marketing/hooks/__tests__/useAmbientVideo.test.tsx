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
});
