import { describe, it, expect } from 'vitest';
import { validatePdf } from '../pdfValidation';

const MAX = 1024 * 1024;

/** Build a File whose leading bytes are exactly `head`, padded to `size`. */
function fileWith(head: number[], size: number, name = 'report.pdf'): File {
  const bytes = new Uint8Array(size);
  bytes.set(head.slice(0, size));
  return new File([bytes], name, { type: 'application/pdf' });
}

const PDF_HEAD = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-

describe('validatePdf', () => {
  it('should accept a file whose leading bytes are the PDF signature', async () => {
    const result = await validatePdf(fileWith(PDF_HEAD, 512), MAX);

    expect(result).toBeNull();
  });

  it('should reject an empty file', async () => {
    const result = await validatePdf(new File([], 'empty.pdf'), MAX);

    expect(result?.reason).toContain('empty');
  });

  it('should reject a file larger than the maximum', async () => {
    const result = await validatePdf(fileWith(PDF_HEAD, MAX + 1), MAX);

    expect(result?.reason).toContain('too large');
  });

  it('should accept a file exactly at the maximum size', async () => {
    const result = await validatePdf(fileWith(PDF_HEAD, MAX), MAX);

    expect(result).toBeNull();
  });

  it('should reject a renamed non-PDF even when the extension and MIME type say PDF', async () => {
    // A PNG signature in a file called report.pdf declaring application/pdf —
    // the exact shape of an upload we must not trust by extension.
    const png = [0x89, 0x50, 0x4e, 0x47, 0x0d];

    const result = await validatePdf(fileWith(png, 512), MAX);

    expect(result?.reason).toContain("doesn't look like a PDF");
  });

  it('should reject a file too short to contain a signature', async () => {
    const result = await validatePdf(fileWith([0x25, 0x50], 2), MAX);

    expect(result?.reason).toContain("doesn't look like a PDF");
  });

  it('should reject rather than throw when the file cannot be read', async () => {
    const unreadable = {
      name: 'broken.pdf',
      size: 100,
      slice: () => ({ arrayBuffer: () => Promise.reject(new Error('read failed')) }),
    } as unknown as File;

    const result = await validatePdf(unreadable, MAX);

    expect(result?.reason).toContain("couldn't read");
  });
});
