// PropXchain - Open Source Blockchain Property Conveyancing Platform
// Copyright (C) 2026 PropXchain Contributors
// SPDX-License-Identifier: Proprietary

import { describe, expect, it } from 'vitest';

import {
  PACK_DOC_KINDS,
  SALES_PACK_EXTRA_DOC_TYPE,
  isPackDocument,
  packDocLabel,
} from '../packDocKinds';

describe('packDocLabel', () => {
  it('should return the picker label for a known pack document type', () => {
    // Arrange
    const documentType = 'sales_pack_eicr';
    // Act
    const label = packDocLabel(documentType);
    // Assert
    expect(label).toBe('Electrical (EICR) certificate');
  });

  it('should fall back to Other for an unknown document type', () => {
    // Arrange
    const documentType = 'not_a_pack_type';
    // Act
    const label = packDocLabel(documentType);
    // Assert
    expect(label).toBe('Other');
  });
});

describe('PACK_DOC_KINDS', () => {
  it('should not offer any identity document kind, since ID is shared from the wallet', () => {
    // Arrange
    const ids: readonly string[] = PACK_DOC_KINDS.map((k) => k.id);
    // Act
    const idKinds = ids.filter((id) => /identity|passport|licence/.test(id));
    // Assert
    expect(idKinds).toEqual([]);
  });
});

describe('isPackDocument', () => {
  it('should accept every kind the picker offers, including the Other slot', () => {
    // Arrange
    const ids = PACK_DOC_KINDS.map((k) => k.id);
    // Act
    const rejected = ids.filter((id) => !isPackDocument(id));
    // Assert
    expect(rejected).toEqual([]);
    expect(ids).toContain(SALES_PACK_EXTRA_DOC_TYPE);
  });

  it('should never treat an identity document as part of the pack', () => {
    // Arrange
    const documentType = 'identity_document';
    // Act
    const result = isPackDocument(documentType);
    // Assert
    expect(result).toBe(false);
  });

  it('should reject an empty or unrelated document type', () => {
    // Arrange
    const unrelated = ['', 'ta6_form'];
    // Act
    const accepted = unrelated.filter(isPackDocument);
    // Assert
    expect(accepted).toEqual([]);
  });
});
