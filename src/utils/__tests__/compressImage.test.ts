// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  compressImage,
  ImageTooLargeError,
  InvalidImageError,
} from '../compressImage';

import type { CompressImageResult } from '../compressImage';

// -- Helpers ------------------------------------------------------------------

function makeFile(sizeBytes: number, type: string, name: string): File {
  return new File([new ArrayBuffer(sizeBytes)], name, { type });
}

function makeJpeg(sizeBytes: number): File {
  return makeFile(sizeBytes, 'image/jpeg', 'test.jpg');
}

// -- Mocks --------------------------------------------------------------------

function stubImageBitmap(width = 800, height = 600): void {
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn().mockResolvedValue({ width, height, close: vi.fn() })
  );
}

/**
 * Stub OffscreenCanvas so `convertToBlob` returns a blob of `blobSize` bytes.
 * Optionally accepts a sequence of sizes for progressive quality testing.
 */
function stubOffscreenCanvas(blobSizes: number | number[]): void {
  const sizes = Array.isArray(blobSizes) ? [...blobSizes] : [blobSizes];
  let callIndex = 0;

  const mockConvertToBlob = vi.fn().mockImplementation(async () => {
    const size = sizes[Math.min(callIndex, sizes.length - 1)];
    callIndex++;
    return new Blob([new ArrayBuffer(size)], { type: 'image/jpeg' });
  });

  const mockGetContext = vi.fn().mockReturnValue({
    drawImage: vi.fn(),
  });

  vi.stubGlobal('OffscreenCanvas', class {
    width: number;
    height: number;
    constructor(w: number, h: number) {
      this.width = w;
      this.height = h;
    }
    getContext = mockGetContext;
    convertToBlob = mockConvertToBlob;
  });
}

// -- Tests --------------------------------------------------------------------

describe('compressImage', () => {
  beforeEach(() => {
    stubImageBitmap();
    stubOffscreenCanvas(500_000);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('passthrough for small files', () => {
    it('should return file unchanged when under size and dimension thresholds', async () => {
      const file = makeJpeg(500_000);
      stubImageBitmap(1200, 900);

      const result: CompressImageResult = await compressImage(file);

      expect(result.wasCompressed).toBe(false);
      expect(result.blob).toBe(file);
      expect(result.originalSize).toBe(500_000);
      expect(result.compressedSize).toBe(500_000);
      expect(result.width).toBe(1200);
      expect(result.height).toBe(900);
    });

    it('should compress when file is under size but over dimension threshold', async () => {
      const file = makeJpeg(500_000);
      stubImageBitmap(3000, 2000);

      const result = await compressImage(file);

      expect(result.wasCompressed).toBe(true);
      expect(result.width).toBeLessThanOrEqual(2400);
      expect(result.height).toBeLessThanOrEqual(2400);
    });

    it('should compress when file is over size but under dimension threshold', async () => {
      const file = makeJpeg(2_000_000);
      stubImageBitmap(1200, 900);

      const result = await compressImage(file);

      expect(result.wasCompressed).toBe(true);
    });
  });

  describe('input validation', () => {
    it('should throw ImageTooLargeError for files over 5MB', async () => {
      const file = makeJpeg(6_000_000);

      await expect(compressImage(file)).rejects.toThrow(ImageTooLargeError);
      await expect(compressImage(file)).rejects.toThrow(/5\.7MB.*5\.0MB/);
    });

    it('should throw ImageTooLargeError with correct properties', async () => {
      const file = makeJpeg(6_000_000);

      try {
        await compressImage(file);
        expect.unreachable('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ImageTooLargeError);
        expect((err as ImageTooLargeError).size).toBe(6_000_000);
        expect((err as ImageTooLargeError).maxSize).toBe(5_242_880);
      }
    });

    it('should throw ImageTooLargeError with custom maxInputBytes', async () => {
      const file = makeJpeg(3_000_000);

      await expect(
        compressImage(file, { maxInputBytes: 2_000_000 })
      ).rejects.toThrow(ImageTooLargeError);
    });

    it('should throw InvalidImageError for non-image files', async () => {
      const file = makeFile(1000, 'application/pdf', 'doc.pdf');

      await expect(compressImage(file)).rejects.toThrow(InvalidImageError);
      await expect(compressImage(file)).rejects.toThrow(/application\/pdf/);
    });

    it('should throw InvalidImageError for files with empty type', async () => {
      const file = makeFile(1000, '', 'unknown.bin');

      await expect(compressImage(file)).rejects.toThrow(InvalidImageError);
      await expect(compressImage(file)).rejects.toThrow(/unknown/);
    });
  });

  describe('compression', () => {
    it('should compress a large image and return wasCompressed true', async () => {
      const file = makeJpeg(2_000_000);
      stubImageBitmap(3000, 2000);
      stubOffscreenCanvas(1_500_000);

      const result = await compressImage(file);

      expect(result.wasCompressed).toBe(true);
      expect(result.compressedSize).toBeLessThanOrEqual(1_843_200);
      expect(result.originalSize).toBe(2_000_000);
    });

    it('should scale dimensions down to maxEdgePx preserving aspect ratio', async () => {
      const file = makeJpeg(2_000_000);
      stubImageBitmap(4800, 3200);
      stubOffscreenCanvas(1_000_000);

      const result = await compressImage(file);

      expect(result.wasCompressed).toBe(true);
      expect(result.width).toBe(2400);
      expect(result.height).toBe(1600);
    });

    it('should scale portrait images correctly', async () => {
      const file = makeJpeg(2_000_000);
      stubImageBitmap(2000, 4000);
      stubOffscreenCanvas(1_000_000);

      const result = await compressImage(file);

      expect(result.height).toBe(2400);
      expect(result.width).toBe(1200);
    });

    it('should accept custom maxEdgePx', async () => {
      const file = makeJpeg(2_000_000);
      stubImageBitmap(4000, 3000);
      stubOffscreenCanvas(800_000);

      const result = await compressImage(file, { maxEdgePx: 1000 });

      expect(result.width).toBe(1000);
      expect(result.height).toBe(750);
    });
  });

  describe('progressive quality reduction', () => {
    it('should retry at lower quality when first pass exceeds max size', async () => {
      const file = makeJpeg(4_000_000);
      stubImageBitmap(3000, 2000);
      // First pass (0.85): too large. Second pass (0.7): still too large. Third (0.5): ok.
      stubOffscreenCanvas([2_000_000, 1_900_000, 1_500_000]);

      const result = await compressImage(file);

      expect(result.wasCompressed).toBe(true);
      expect(result.compressedSize).toBe(1_500_000);
    });

    it('should return best effort if all quality levels still exceed max size', async () => {
      const file = makeJpeg(4_000_000);
      stubImageBitmap(3000, 2000);
      // All passes exceed max — last blob is used as best effort
      stubOffscreenCanvas([2_500_000, 2_200_000, 2_000_000]);

      const result = await compressImage(file);

      expect(result.wasCompressed).toBe(true);
      // Best effort at lowest quality (last call returns 2_000_000)
      expect(result.compressedSize).toBe(2_000_000);
    });

    it('should succeed on first try when initial quality is sufficient', async () => {
      const file = makeJpeg(3_000_000);
      stubImageBitmap(3000, 2000);
      stubOffscreenCanvas(1_200_000);

      const result = await compressImage(file);

      expect(result.wasCompressed).toBe(true);
      expect(result.compressedSize).toBe(1_200_000);
    });
  });

  describe('graceful fallback', () => {
    it('should return original file with warning when APIs are unavailable', async () => {
      const file = makeJpeg(2_000_000);
      vi.stubGlobal('createImageBitmap', undefined);
      vi.stubGlobal('OffscreenCanvas', undefined);

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

      const result = await compressImage(file);

      expect(result.wasCompressed).toBe(false);
      expect(result.blob).toBe(file);
      expect(result.compressedSize).toBe(2_000_000);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Canvas/ImageBitmap APIs unavailable')
      );

      warnSpy.mockRestore();
    });
  });

  describe('supported image types', () => {
    it('should accept image/jpeg', async () => {
      const file = makeFile(500_000, 'image/jpeg', 'photo.jpg');
      stubImageBitmap(800, 600);

      const result = await compressImage(file);

      expect(result.wasCompressed).toBe(false);
    });

    it('should accept image/png', async () => {
      const file = makeFile(500_000, 'image/png', 'photo.png');
      stubImageBitmap(800, 600);

      const result = await compressImage(file);

      expect(result.wasCompressed).toBe(false);
    });

    it('should accept image/webp', async () => {
      const file = makeFile(500_000, 'image/webp', 'photo.webp');
      stubImageBitmap(800, 600);

      const result = await compressImage(file);

      expect(result.wasCompressed).toBe(false);
    });
  });
});
