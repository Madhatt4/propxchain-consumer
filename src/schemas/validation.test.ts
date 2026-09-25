// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import { describe, it, expect } from 'vitest';
import { RegistrationFormSchema, DocumentUploadSchema, URISchema, UprnSchema } from './validation.schemas';

describe('Zod Schema Validation', () => {
  it('validates valid registration data', () => {
    const result = RegistrationFormSchema.safeParse({
      email: 'test@example.com',
      principal: 'abc12-def34-ghi56-jkl78-mno',
      userType: 'buyer',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid email format', () => {
    const result = RegistrationFormSchema.safeParse({
      email: 'invalid-email',
      principal: 'abc12-def34-ghi56-jkl78-mno',
      userType: 'buyer',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error?.errors[0]?.message).toContain('email');
    }
  });

  it('validates document upload file size limits', () => {
    const result = DocumentUploadSchema.safeParse({
      fileName: 'test.pdf',
      fileSize: 5 * 1024 * 1024, // 5MB
      mimeType: 'application/pdf',
      documentType: 'Proof of Identity',
    });
    expect(result.success).toBe(true);
  });

  it('rejects oversized files', () => {
    const result = DocumentUploadSchema.safeParse({
      fileName: 'large.pdf',
      fileSize: 15 * 1024 * 1024, // 15MB
      mimeType: 'application/pdf',
      documentType: 'Proof of Identity',
    });
    expect(result.success).toBe(false);
  });

  it('prevents path traversal in URIs', () => {
    const result = URISchema.safeParse('../../etc/passwd');
    expect(result.success).toBe(false);
  });

  it('validates safe URIs', () => {
    // URISchema allows relative paths without double-slashes; https:// is blocked by the double-slash rule
    const result = URISchema.safeParse('documents/document.pdf');
    expect(result.success).toBe(true);
  });

  it('validates principal ID format', () => {
    const result = RegistrationFormSchema.safeParse({
      email: 'test@example.com',
      principal: 'i!', // Too short and contains invalid chars
      userType: 'buyer',
    });
    expect(result.success).toBe(false);
  });
});

describe('UprnSchema', () => {
  it('accepts a single-digit UPRN', () => {
    expect(UprnSchema.safeParse('1').success).toBe(true);
  });

  it('accepts a 12-digit UPRN', () => {
    expect(UprnSchema.safeParse('100023336956').success).toBe(true);
  });

  it('trims surrounding whitespace before validating', () => {
    const result = UprnSchema.safeParse('  100023336956  ');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe('100023336956');
  });

  it('treats an empty string as valid (UPRN is optional)', () => {
    expect(UprnSchema.safeParse('').success).toBe(true);
  });

  it('treats a whitespace-only string as valid', () => {
    expect(UprnSchema.safeParse('   ').success).toBe(true);
  });

  it('treats undefined as valid (UPRN is optional)', () => {
    expect(UprnSchema.safeParse(undefined).success).toBe(true);
  });

  it('rejects letters', () => {
    expect(UprnSchema.safeParse('12A45').success).toBe(false);
  });

  it('rejects more than 12 digits', () => {
    expect(UprnSchema.safeParse('1234567890123').success).toBe(false);
  });

  it('rejects internal spaces', () => {
    expect(UprnSchema.safeParse('100 023').success).toBe(false);
  });
});
