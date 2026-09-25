// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect } from 'vitest';

import { normaliseExternalUrl, safeExternalUrl } from '../externalUrl';

describe('normaliseExternalUrl', () => {
  it('should return null when the field is left blank', () => {
    expect(normaliseExternalUrl('')).toBeNull();
  });

  it('should return null when the field holds only whitespace', () => {
    expect(normaliseExternalUrl('   ')).toBeNull();
  });

  it('should assume https for a bare host, which is what an agent actually types', () => {
    expect(normaliseExternalUrl('demoandsons.co.uk/45-laburnum-road')).toBe(
      'https://demoandsons.co.uk/45-laburnum-road',
    );
  });

  it('should keep an explicit http scheme rather than upgrading it', () => {
    expect(normaliseExternalUrl('http://demoandsons.co.uk/x')).toBe('http://demoandsons.co.uk/x');
  });

  it('should trim surrounding whitespace from a pasted URL', () => {
    expect(normaliseExternalUrl('  https://demoandsons.co.uk/x  ')).toBe('https://demoandsons.co.uk/x');
  });

  it('should reject a javascript: URL rather than storing an XSS payload', () => {
    expect(normaliseExternalUrl('javascript:alert(1)')).toBeUndefined();
  });

  it('should not rescue a rejected scheme by prefixing https', () => {
    // The guard rewrites only when there is no scheme at all. Prefixing
    // "javascript:alert(1)" would produce a valid https URL and smuggle it in.
    expect(normaliseExternalUrl('javascript:alert(1)')).not.toBe('https://javascript:alert(1)');
  });

  it('should reject other non-web schemes', () => {
    expect(normaliseExternalUrl('data:text/html,<script>alert(1)</script>')).toBeUndefined();
    expect(normaliseExternalUrl('mailto:someone@example.com')).toBeUndefined();
  });

  it('should reject a value with no host', () => {
    expect(normaliseExternalUrl('https://')).toBeUndefined();
  });

  it('should reject a single word, which parses as a host but is a typo', () => {
    // `!` is not a forbidden host character, so "nope!!" would otherwise be
    // stored as https://nope!! and render a dead button.
    expect(normaliseExternalUrl('nope!!')).toBeUndefined();
    expect(normaliseExternalUrl('demoandsons')).toBeUndefined();
  });

  it('should distinguish a deliberate clear from an invalid entry', () => {
    // null and undefined are not interchangeable here: one saves, one blocks.
    expect(normaliseExternalUrl('')).toBeNull();
    expect(normaliseExternalUrl('not a url at all !!')).toBeUndefined();
  });
});

describe('safeExternalUrl', () => {
  it('should return null for null or undefined', () => {
    expect(safeExternalUrl(null)).toBeNull();
    expect(safeExternalUrl(undefined)).toBeNull();
  });

  it('should return null for an empty string', () => {
    expect(safeExternalUrl('')).toBeNull();
  });

  it('should pass a well-formed https URL through', () => {
    expect(safeExternalUrl('https://demoandsons.co.uk/x')).toBe('https://demoandsons.co.uk/x');
  });

  it('should reject a javascript: URL that reached the database another way', () => {
    // The render guard exists for rows written before the input validation, or
    // straight through the API — never trust the column.
    expect(safeExternalUrl('javascript:alert(document.cookie)')).toBeNull();
  });

  it('should reject an unparseable value', () => {
    expect(safeExternalUrl('¬¬¬')).toBeNull();
  });
});
