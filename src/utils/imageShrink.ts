// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Shrink a phone photo before upload so the document check can read it.
 * Jev, which reads certificate photos, refuses anything over 1568 px a side
 * rather than resizing it, and a phone photo is usually 3000-4000 px
 * (decision Q15, 2026-10-15). Shrinking here is free and also cuts storage.
 *
 * Only JPEG and PNG are touched. Anything the browser cannot decode (HEIC on
 * most browsers) is uploaded as it is, and the check answers "unreadable".
 * The browser applies the photo's EXIF rotation while decoding, so the
 * shrunk copy is upright.
 */

export const MAX_SIDE_PX = 1568;
const JPEG_QUALITY = 0.9;
const SHRINKABLE_TYPES = new Set(['image/jpeg', 'image/png']);

export interface Size {
  width: number;
  height: number;
}

/** The size to draw at: the longest side at most MAX_SIDE_PX, aspect kept; null when already small enough. */
export function targetSize(size: Size): Size | null {
  const longest = Math.max(size.width, size.height);
  if (longest <= MAX_SIDE_PX) return null;
  const scale = MAX_SIDE_PX / longest;
  return {
    width: Math.max(1, Math.round(size.width * scale)),
    height: Math.max(1, Math.round(size.height * scale)),
  };
}

/** Browser drawing, injected so the decision logic is testable without a canvas. */
export interface ImageCodec {
  decode(file: File): Promise<{ size: Size; draw: (to: Size) => Promise<Blob> }>;
}

function canvasCodec(type: string): ImageCodec {
  return {
    async decode(file) {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return {
        size: { width: bitmap.width, height: bitmap.height },
        draw: (to) => {
          const canvas = document.createElement('canvas');
          canvas.width = to.width;
          canvas.height = to.height;
          canvas.getContext('2d')?.drawImage(bitmap, 0, 0, to.width, to.height);
          bitmap.close();
          return new Promise((resolve, reject) => {
            canvas.toBlob(
              (blob) => (blob ? resolve(blob) : reject(new Error('canvas produced no image'))),
              type,
              JPEG_QUALITY,
            );
          });
        },
      };
    },
  };
}

/** The file to upload: a shrunk copy of a large JPEG or PNG, otherwise the original. */
export async function shrinkImageForUpload(file: File, codec?: ImageCodec): Promise<File> {
  if (!SHRINKABLE_TYPES.has(file.type)) return file;
  try {
    const decoded = await (codec ?? canvasCodec(file.type)).decode(file);
    const to = targetSize(decoded.size);
    if (!to) return file;
    const blob = await decoded.draw(to);
    return new File([blob], file.name, { type: file.type, lastModified: file.lastModified });
  } catch {
    // A photo we cannot shrink still uploads; the check will say it could not read it.
    return file;
  }
}
