// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect } from 'vitest';

import { uploadBody } from '../uploadBody';

describe('uploadBody', () => {
  it('should return the exact bytes of the file', async () => {
    const file = new File([new Uint8Array([137, 80, 78, 71])], 'photo.png', { type: 'image/png' });

    const body = await uploadBody(file);

    expect(Array.from(new Uint8Array(body))).toEqual([137, 80, 78, 71]);
  });

  it('should return an empty buffer for an empty file', async () => {
    const body = await uploadBody(new File([], 'empty.pdf'));

    expect(body.byteLength).toBe(0);
  });
});
