// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect, vi } from 'vitest';

import { MAX_SIDE_PX, shrinkImageForUpload, targetSize } from '../imageShrink';
import type { ImageCodec, Size } from '../imageShrink';

function codecFor(size: Size, drawn = new Blob(['small'], { type: 'image/jpeg' })) {
  const draw = vi.fn().mockResolvedValue(drawn);
  const codec: ImageCodec = { decode: vi.fn().mockResolvedValue({ size, draw }) };
  return { codec, draw };
}

const photo = (type = 'image/jpeg') =>
  new File(['big-photo-bytes'], 'gas-cert.jpg', { type, lastModified: 5 });

describe('targetSize', () => {
  it('should scale a 4032 x 3024 phone photo to 1568 on the long side, keeping the aspect', () => {
    expect(targetSize({ width: 4032, height: 3024 })).toEqual({ width: 1568, height: 1176 });
  });

  it('should scale a portrait photo by its height', () => {
    expect(targetSize({ width: 3024, height: 4032 })).toEqual({ width: 1176, height: 1568 });
  });

  it('should leave an image already within the limit alone, the limit included', () => {
    expect(targetSize({ width: MAX_SIDE_PX, height: 900 })).toBeNull();
    expect(targetSize({ width: 800, height: 600 })).toBeNull();
  });
});

describe('shrinkImageForUpload', () => {
  it('should return a shrunk copy of a large JPEG with the same name and type', async () => {
    const { codec, draw } = codecFor({ width: 4032, height: 3024 });

    const result = await shrinkImageForUpload(photo(), codec);

    expect(draw).toHaveBeenCalledWith({ width: 1568, height: 1176 });
    expect(result.name).toBe('gas-cert.jpg');
    expect(result.type).toBe('image/jpeg');
    expect(await result.text()).toBe('small');
  });

  it('should return the original file when it is already small enough', async () => {
    const original = photo('image/png');
    const { codec, draw } = codecFor({ width: 1200, height: 900 });

    expect(await shrinkImageForUpload(original, codec)).toBe(original);
    expect(draw).not.toHaveBeenCalled();
  });

  it('should not touch a PDF or a HEIC', async () => {
    const { codec } = codecFor({ width: 4000, height: 3000 });
    const pdf = new File(['%PDF'], 'cert.pdf', { type: 'application/pdf' });
    const heic = photo('image/heic');

    expect(await shrinkImageForUpload(pdf, codec)).toBe(pdf);
    expect(await shrinkImageForUpload(heic, codec)).toBe(heic);
    expect(codec.decode).not.toHaveBeenCalled();
  });

  it('should upload the original when the browser cannot decode the photo', async () => {
    const original = photo();
    const codec: ImageCodec = { decode: vi.fn().mockRejectedValue(new Error('decode failed')) };

    expect(await shrinkImageForUpload(original, codec)).toBe(original);
  });
});
