// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Browser-side image compression utility using native APIs.
 * Used before uploading images to ICP canisters (2MB ingress limit).
 */

/** Error thrown when the input file exceeds the maximum allowed size. */
export class ImageTooLargeError extends Error {
  public readonly size: number;
  public readonly maxSize: number;

  constructor(size: number, maxSize: number) {
    const sizeMB = (size / 1_048_576).toFixed(1);
    const maxMB = (maxSize / 1_048_576).toFixed(1);
    super(`Image is ${sizeMB}MB which exceeds the ${maxMB}MB limit. Please choose a smaller file.`);
    this.name = 'ImageTooLargeError';
    this.size = size;
    this.maxSize = maxSize;
  }
}

/** Error thrown when the file is not a valid image. */
export class InvalidImageError extends Error {
  constructor(type: string) {
    super(`File type "${type || 'unknown'}" is not a supported image format. Use JPEG, PNG, or WebP.`);
    this.name = 'InvalidImageError';
  }
}

export interface CompressImageResult {
  blob: Blob;
  originalSize: number;
  compressedSize: number;
  wasCompressed: boolean;
  width: number;
  height: number;
}

export interface CompressImageOptions {
  /** Maximum output size in bytes. Default: 1,843,200 (1.8MB) */
  maxSizeBytes?: number;
  /** Maximum edge length in pixels. Default: 2400 */
  maxEdgePx?: number;
  /** Initial JPEG quality (0-1). Default: 0.85 */
  initialQuality?: number;
  /** Maximum input file size in bytes. Default: 5,242,880 (5MB) */
  maxInputBytes?: number;
}

const DEFAULT_MAX_SIZE_BYTES = 1_843_200;
const DEFAULT_MAX_EDGE_PX = 2400;
const DEFAULT_INITIAL_QUALITY = 0.85;
const DEFAULT_MAX_INPUT_BYTES = 5_242_880;
const QUALITY_STEPS = [0.7, 0.5];
const SUPPORTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/**
 * Compress an image file for ICP canister upload.
 *
 * - Returns unchanged if already under size/dimension thresholds
 * - Rejects files over 5MB with a user-friendly error
 * - Progressively reduces JPEG quality if first pass is too large
 * - Falls back to returning the original if compression APIs are unavailable
 */
export async function compressImage(
  file: File,
  options?: CompressImageOptions
): Promise<CompressImageResult> {
  const maxSizeBytes = options?.maxSizeBytes ?? DEFAULT_MAX_SIZE_BYTES;
  const maxEdgePx = options?.maxEdgePx ?? DEFAULT_MAX_EDGE_PX;
  const initialQuality = options?.initialQuality ?? DEFAULT_INITIAL_QUALITY;
  const maxInputBytes = options?.maxInputBytes ?? DEFAULT_MAX_INPUT_BYTES;

  validateInput(file, maxInputBytes);

  if (!hasCompressionSupport()) {
    console.warn('[compressImage] Canvas/ImageBitmap APIs unavailable — returning original file');
    return buildUncompressedResult(file);
  }

  const bitmap = await createImageBitmap(file);
  const { width: origW, height: origH } = bitmap;

  if (isUnderThresholds(file.size, origW, origH, maxSizeBytes, maxEdgePx)) {
    bitmap.close();
    return buildResult(file, file.size, origW, origH, false);
  }

  const { width, height } = scaleDimensions(origW, origH, maxEdgePx);
  const canvas = createCanvas(width, height);
  const ctx = getContext(canvas);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return compressWithProgressiveQuality(
    canvas, width, height, file.size, initialQuality, maxSizeBytes
  );
}

/** Validate file type and size before processing. */
function validateInput(file: File, maxInputBytes: number): void {
  if (!SUPPORTED_TYPES.has(file.type)) {
    throw new InvalidImageError(file.type);
  }
  if (file.size > maxInputBytes) {
    throw new ImageTooLargeError(file.size, maxInputBytes);
  }
}

/** Check whether native compression APIs are available. */
function hasCompressionSupport(): boolean {
  return (
    typeof createImageBitmap === 'function' &&
    (typeof OffscreenCanvas !== 'undefined' || typeof HTMLCanvasElement !== 'undefined')
  );
}

/** Check if file is already small enough to skip compression. */
function isUnderThresholds(
  size: number, w: number, h: number, maxBytes: number, maxEdge: number
): boolean {
  return size <= maxBytes && Math.max(w, h) <= maxEdge;
}

/** Calculate scaled dimensions preserving aspect ratio. */
function scaleDimensions(
  w: number, h: number, maxEdge: number
): { width: number; height: number } {
  const longest = Math.max(w, h);
  if (longest <= maxEdge) return { width: w, height: h };

  const scale = maxEdge / longest;
  return {
    width: Math.round(w * scale),
    height: Math.round(h * scale),
  };
}

/** Create a canvas (OffscreenCanvas preferred, HTMLCanvasElement fallback). */
function createCanvas(
  width: number, height: number
): OffscreenCanvas | HTMLCanvasElement {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height);
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/** Get 2D rendering context from canvas. */
function getContext(
  canvas: OffscreenCanvas | HTMLCanvasElement
): OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas 2D context');
  return ctx as OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
}

/** Convert canvas to blob at given JPEG quality. */
async function canvasToBlob(
  canvas: OffscreenCanvas | HTMLCanvasElement,
  quality: number
): Promise<Blob> {
  if (canvas instanceof OffscreenCanvas) {
    return canvas.convertToBlob({ type: 'image/jpeg', quality });
  }
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas toBlob returned null'))),
      'image/jpeg',
      quality
    );
  });
}

/** Try compression at initial quality, then progressively lower. */
async function compressWithProgressiveQuality(
  canvas: OffscreenCanvas | HTMLCanvasElement,
  width: number,
  height: number,
  originalSize: number,
  initialQuality: number,
  maxSizeBytes: number
): Promise<CompressImageResult> {
  const qualities = [initialQuality, ...QUALITY_STEPS];

  for (const quality of qualities) {
    const blob = await canvasToBlob(canvas, quality);
    if (blob.size <= maxSizeBytes) {
      return buildResult(blob, originalSize, width, height, true);
    }
  }

  // Return best effort at lowest quality
  const finalBlob = await canvasToBlob(canvas, QUALITY_STEPS[QUALITY_STEPS.length - 1]);
  return buildResult(finalBlob, originalSize, width, height, true);
}

/** Build a result when compression APIs are unavailable. */
async function buildUncompressedResult(file: File): Promise<CompressImageResult> {
  return {
    blob: file,
    originalSize: file.size,
    compressedSize: file.size,
    wasCompressed: false,
    width: 0,
    height: 0,
  };
}

/** Build the standard result object. */
function buildResult(
  blob: Blob, originalSize: number, width: number, height: number, wasCompressed: boolean
): CompressImageResult {
  return {
    blob,
    originalSize,
    compressedSize: blob.size,
    wasCompressed,
    width,
    height,
  };
}
