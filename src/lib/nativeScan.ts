// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

/**
 * Photograph a document with the phone camera and return it as a File.
 *
 * The File goes straight into the normal upload path, so the SHA-256 that
 * lands in the audit trail is computed from exactly these bytes. The bytes
 * are never re-encoded, resized or otherwise touched after capture.
 *
 * Returns null when the person cancels the camera.
 */

function scanFileName(now: Date, format: string): string {
  const stamp = now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace('T', '-')
    .slice(0, 15);
  const ext = format === 'jpeg' || format === 'jpg' ? 'jpg' : format;
  return `scan-${stamp}.${ext}`;
}

export async function scanDocument(now: Date = new Date()): Promise<File | null> {
  let photo;
  try {
    photo = await Camera.getPhoto({
      source: CameraSource.Camera,
      resultType: CameraResultType.Uri,
      quality: 90,
      width: 2480,
      correctOrientation: true,
      allowEditing: false,
      saveToGallery: false,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/cancel/i.test(message)) return null;
    throw err;
  }

  if (!photo.webPath) {
    throw new Error('The camera did not return a photo.');
  }

  const response = await fetch(photo.webPath);
  const blob = await response.blob();
  const format = photo.format === 'jpg' ? 'jpeg' : photo.format;
  const mime = `image/${format}`;
  return new File([blob], scanFileName(now, photo.format), { type: mime });
}
