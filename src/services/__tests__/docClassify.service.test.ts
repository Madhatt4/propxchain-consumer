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
  describeScan,
  docTypeLabel,
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

  describe('describeScan', () => {
    const CONVEYANCER = 'This is an automatic check. Your conveyancer still reviews the document.';

    it('should name the type, confirm the property and date, and read as all clear', () => {
      expect(describeScan(EPC)).toEqual({
        tone: 'ok',
        headline: 'This reads as an Energy Performance Certificate.',
        details: ["It looks like it's for this property.", 'It looks in date.', CONVEYANCER],
      });
    });

    it('should say the file could not be read, and how to fix it, for an unreadable file', () => {
      const scan = describeScan({ ...EPC, unreadable: true, docType: 'other', confidence: 0 });
      expect(scan.tone).toBe('unknown');
      expect(scan.headline).toBe("We couldn't read this file.");
      expect(scan.details[0]).toMatch(/clearer photo or the original PDF/);
    });

    it('should not name a type below the confidence threshold or when the answer is other', () => {
      for (const result of [{ ...EPC, confidence: 0.55 }, { ...EPC, docType: 'other', confidence: 0.9 }]) {
        expect(describeScan(result)).toEqual({
          tone: 'unknown',
          headline: "We couldn't tell what this document is.",
          details: [CONVEYANCER],
        });
      }
    });

    it('should caution when the document probably is not about this property', () => {
      const scan = describeScan({ ...EPC, matchesProperty: 0.2 });
      expect(scan.tone).toBe('caution');
      expect(scan.details[0]).toBe("It doesn't seem to name this property. Check the address on it is yours.");
    });

    it('should say which postcode the document gives when it differs from the property', () => {
      const scan = describeScan({
        ...EPC,
        matchesProperty: 0.07,
        propertyCheck: { expectedPostcode: 'SG19 2LA', foundPostcodes: ['SG19 1AB', 'SG18 0AB'], postcodeMatches: false },
      });
      expect(scan.tone).toBe('caution');
      expect(scan.details[0]).toBe(
        "It gives postcode SG19 1AB and SG18 0AB, not this property's SG19 2LA. Check it's the right document.",
      );
    });

    it('should say the document names no postcode when that is why it could not be tied to the property', () => {
      const scan = describeScan({
        ...EPC,
        matchesProperty: 0.1,
        propertyCheck: { expectedPostcode: 'SG19 2LA', foundPostcodes: [], postcodeMatches: null },
      });
      expect(scan.tone).toBe('caution');
      expect(scan.details[0]).toMatch(/^It names no postcode/);
    });

    it('should trust a matching postcode over a low probability', () => {
      const scan = describeScan({
        ...EPC,
        matchesProperty: 0.3,
        propertyCheck: { expectedPostcode: 'SG19 2LA', foundPostcodes: ['SG19 2LA'], postcodeMatches: true },
      });
      expect(scan.tone).toBe('ok');
      expect(scan.details[0]).toBe("It gives this property's postcode, SG19 2LA.");
    });

    it('should caution when the document is out of date', () => {
      const scan = describeScan({ ...EPC, inDate: false });
      expect(scan.tone).toBe('caution');
      expect(scan.details).toContain('It looks out of date, so you may need a newer one.');
    });

    it('should say nothing about property or date when both are unknown', () => {
      expect(describeScan({ ...EPC, matchesProperty: null, inDate: null }).details).toEqual([CONVEYANCER]);
    });

    it('should name a completed Law Society form', () => {
      expect(describeScan({ ...EPC, docType: 'ta6_form' }).headline).toBe('This reads as a completed TA6 form.');
      expect(describeScan({ ...EPC, docType: 'ta10_form' }).headline).toBe('This reads as a completed TA10 form.');
      expect(describeScan({ ...EPC, docType: 'ta7_form' }).headline).toBe('This reads as a completed TA7 form.');
    });

    it('should expose the label with its article for other copy to reuse', () => {
      expect(docTypeLabel('epc')).toBe('an Energy Performance Certificate');
      expect(docTypeLabel('ta6_form')).toBe('a completed TA6 form');
      expect(docTypeLabel('warranty_scheme')).toBe('a warranty scheme');
    });

    it('should fall back to a plain label for a type it has no wording for', () => {
      expect(describeScan({ ...EPC, docType: 'warranty_scheme' }).headline).toBe('This reads as a warranty scheme.');
    });

    it('should say when a photo shows a different postcode it could not read out', () => {
      const scan = describeScan({
        ...EPC,
        matchesProperty: 0.1,
        propertyCheck: { expectedPostcode: 'SG19 2TR', foundPostcodes: [], postcodeMatches: false },
      });
      expect(scan.tone).toBe('caution');
      expect(scan.details[0]).toBe("It shows a different postcode from this property's SG19 2TR. Check it's the right document.");
    });

    describe('with what the question asks for', () => {
      const HEATING = { docTypes: ['gas_safety', 'building_regs_certificate'], asksFor: 'the heating installation certificate' };

      it('should point out a document that answers a different question, first', () => {
        const scan = describeScan({ ...EPC, docType: 'eicr' }, HEATING);
        expect(scan.tone).toBe('caution');
        expect(scan.details[0]).toBe(
          'This question asks for the heating installation certificate. Did you mean to attach it to a different question?',
        );
      });

      it('should say nothing about the question when the document answers it', () => {
        const scan = describeScan({ ...EPC, docType: 'gas_safety' }, HEATING);
        expect(scan.tone).toBe('ok');
        expect(scan.details.some((line) => line.startsWith('This question asks for'))).toBe(false);
      });

      it('should not second-guess a document it could not type', () => {
        const scan = describeScan({ ...EPC, docType: 'other', confidence: 0.9 }, HEATING);
        expect(scan.details.some((line) => line.startsWith('This question asks for'))).toBe(false);
      });
    });
  });
});
