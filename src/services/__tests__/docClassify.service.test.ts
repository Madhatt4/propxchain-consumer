// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Tests for docClassify.service.ts — mocks the Supabase client, same pattern
 * as formCheck.service.test.ts. Nothing here reaches a real function.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInvoke = vi.fn();

vi.mock('../../lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
  },
}));

import {
  classifyDocument,
  describeClassification,
  type DocClassification,
} from '../docClassify.service';

const EPC: DocClassification = {
  docType: 'epc',
  confidence: 0.97,
  inDate: true,
  matchesProperty: 0.91,
  unreadable: false,
};

describe('docClassify.service', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  describe('classifyDocument', () => {
    it('should post the transaction id and storage path and return the classification', async () => {
      mockInvoke.mockResolvedValue({ data: EPC, error: null });

      const result = await classifyDocument('tx_test', 'transactions/tx_test/ta6/abc.pdf');

      expect(result).toEqual(EPC);
      expect(mockInvoke).toHaveBeenCalledWith('doc-classify', {
        body: { transactionId: 'tx_test', storagePath: 'transactions/tx_test/ta6/abc.pdf' },
      });
    });

    it('should return null when the function answers with an error', async () => {
      mockInvoke.mockResolvedValue({
        data: null,
        error: { message: 'Edge Function returned a non-2xx status code', context: { status: 403 } },
      });

      expect(await classifyDocument('tx_test', 'transactions/tx_test/ta6/abc.pdf')).toBeNull();
    });

    it('should return null when the invoke itself throws', async () => {
      mockInvoke.mockRejectedValue(new Error('network down'));

      expect(await classifyDocument('tx_test', 'transactions/tx_test/ta6/abc.pdf')).toBeNull();
    });

    it('should return null when the body is not a classification', async () => {
      mockInvoke.mockResolvedValue({ data: { nonsense: true }, error: null });

      expect(await classifyDocument('tx_test', 'transactions/tx_test/ta6/abc.pdf')).toBeNull();
    });
  });

  describe('describeClassification', () => {
    it('should name the document type when the classification is confident', () => {
      expect(describeClassification(EPC)).toBe('Reads as an Energy Performance Certificate.');
    });

    it('should say the text could not be read for an unreadable file', () => {
      expect(
        describeClassification({ ...EPC, unreadable: true, docType: 'other', confidence: 0 }),
      ).toBe("We couldn't read the text in this file. Your conveyancer will check it.");
    });

    it('should not name a type below the confidence threshold', () => {
      expect(describeClassification({ ...EPC, confidence: 0.55 })).toBe(
        "We couldn't confirm what this document is. Your conveyancer will check it.",
      );
    });

    it('should not name a type when the answer is other', () => {
      expect(describeClassification({ ...EPC, docType: 'other', confidence: 0.9 })).toBe(
        "We couldn't confirm what this document is. Your conveyancer will check it.",
      );
    });

    it('should add a property warning when the document probably is not about this property', () => {
      expect(describeClassification({ ...EPC, matchesProperty: 0.2 })).toBe(
        'Reads as an Energy Performance Certificate. It may not be for this property.',
      );
    });

    it('should add a date warning when the document is out of date', () => {
      expect(describeClassification({ ...EPC, inDate: false })).toBe(
        'Reads as an Energy Performance Certificate. It looks out of date.',
      );
    });

    it('should add nothing when the property match and date are unknown', () => {
      expect(describeClassification({ ...EPC, matchesProperty: null, inDate: null })).toBe(
        'Reads as an Energy Performance Certificate.',
      );
    });

    it('should fall back to a plain label for a type it has no wording for', () => {
      expect(describeClassification({ ...EPC, docType: 'warranty_scheme' })).toBe(
        'Reads as a warranty scheme.',
      );
    });
  });
});
