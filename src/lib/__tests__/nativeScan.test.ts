// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { getPhoto } = vi.hoisted(() => ({ getPhoto: vi.fn() }));

vi.mock('@capacitor/camera', () => ({
  Camera: { getPhoto },
  CameraResultType: { Uri: 'uri' },
  CameraSource: { Camera: 'CAMERA' },
}));

import { scanDocument } from '../nativeScan';
import { generateFileHash, generateBufferHash } from '../../utils/hashGenerator';
import { sha256Hex } from '../../utils/fileHash';

// SHA-256 of the ASCII bytes "abc" (NIST test vector).
const ABC_SHA256 = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
const ABC_BYTES = new Uint8Array([0x61, 0x62, 0x63]);
const FIXED_NOW = new Date('2026-10-01T09:05:07.000Z');

function stubFetch(bytes: Uint8Array) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ blob: async () => new Blob([bytes.slice().buffer]) }),
  );
}

describe('scanDocument', () => {
  beforeEach(() => {
    getPhoto.mockReset();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns a File with exactly the bytes the camera produced', async () => {
    getPhoto.mockResolvedValue({ webPath: 'capacitor://photo/1', format: 'jpeg' });
    stubFetch(ABC_BYTES);
    const file = await scanDocument(FIXED_NOW);
    expect(file).not.toBeNull();
    expect(new Uint8Array(await file!.arrayBuffer())).toEqual(ABC_BYTES);
    expect(file!.type).toBe('image/jpeg');
    expect(file!.name).toBe('scan-20261001-090507.jpg');
  });

  it('asks the camera for a high-quality, unedited, unsaved photo', async () => {
    getPhoto.mockResolvedValue({ webPath: 'capacitor://photo/1', format: 'jpeg' });
    stubFetch(ABC_BYTES);
    await scanDocument(FIXED_NOW);
    expect(getPhoto).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'CAMERA',
        resultType: 'uri',
        quality: 90,
        width: 2480,
        correctOrientation: true,
        allowEditing: false,
        saveToGallery: false,
      }),
    );
  });

  it('returns null when the person cancels', async () => {
    getPhoto.mockRejectedValue(new Error('User cancelled photos app'));
    expect(await scanDocument(FIXED_NOW)).toBeNull();
  });

  it('rethrows other camera errors', async () => {
    getPhoto.mockRejectedValue(new Error('Camera permission denied'));
    await expect(scanDocument(FIXED_NOW)).rejects.toThrow('permission denied');
  });

  it('throws when the camera returns no photo path', async () => {
    getPhoto.mockResolvedValue({ format: 'jpeg' });
    await expect(scanDocument(FIXED_NOW)).rejects.toThrow();
  });

  it('names png captures with a png extension', async () => {
    getPhoto.mockResolvedValue({ webPath: 'capacitor://photo/2', format: 'png' });
    stubFetch(ABC_BYTES);
    const file = await scanDocument(FIXED_NOW);
    expect(file!.name).toBe('scan-20261001-090507.png');
    expect(file!.type).toBe('image/png');
  });

  it('hash parity: a scanned file hashes identically through every hash path', async () => {
    getPhoto.mockResolvedValue({ webPath: 'capacitor://photo/3', format: 'jpeg' });
    stubFetch(ABC_BYTES);
    const file = (await scanDocument(FIXED_NOW))!;
    expect(await generateFileHash(file)).toBe(ABC_SHA256);
    expect(await sha256Hex(file)).toBe(ABC_SHA256);
    expect(await generateBufferHash(await file.arrayBuffer())).toBe(ABC_SHA256);
  });
});
