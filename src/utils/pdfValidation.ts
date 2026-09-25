// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * PDF upload validation.
 *
 * A consumer-supplied file is untrusted input: the extension and the
 * browser-reported MIME type are both attacker-controlled, so neither is
 * evidence of what the bytes actually are. These helpers check the leading
 * magic bytes before a file is accepted for storage.
 */

/** `%PDF-` — the signature every PDF must open with (ISO 32000-1 §7.5.2). */
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d] as const;

export interface FileRejection {
  /** User-facing reason the file was not accepted. */
  reason: string;
}

/**
 * Read the first bytes and confirm they are a PDF signature.
 *
 * Returns null when the file is a genuine PDF, or a rejection describing why
 * it was refused. Never throws — a read failure is itself a rejection.
 */
export async function validatePdf(
  file: File,
  maxBytes: number,
): Promise<FileRejection | null> {
  if (file.size === 0) {
    return { reason: `${file.name} is empty.` };
  }
  if (file.size > maxBytes) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    const maxMb = Math.floor(maxBytes / 1024 / 1024);
    return { reason: `${file.name} is too large (${mb} MB). Maximum ${maxMb} MB.` };
  }

  let head: Uint8Array;
  try {
    head = new Uint8Array(await file.slice(0, PDF_MAGIC.length).arrayBuffer());
  } catch {
    return { reason: `We couldn't read ${file.name}. Please try another file.` };
  }

  const isPdf =
    head.length === PDF_MAGIC.length && PDF_MAGIC.every((b, i) => head[i] === b);

  if (!isPdf) {
    return {
      reason: `${file.name} doesn't look like a PDF. Survey reports must be uploaded as a PDF.`,
    };
  }
  return null;
}
