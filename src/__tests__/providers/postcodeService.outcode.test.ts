import { describe, it, expect } from 'vitest';
import { postcodeService } from '@/services/postcodeService';

describe('postcodeService — outcode helpers', () => {
  describe('isFullPostcode', () => {
    it('accepts canonical UK postcodes (with and without space)', () => {
      expect(postcodeService.isFullPostcode('SG19 8AB')).toBe(true);
      expect(postcodeService.isFullPostcode('sg198ab')).toBe(true);
      expect(postcodeService.isFullPostcode('EC1A 1BB')).toBe(true);
      expect(postcodeService.isFullPostcode('M1 1AA')).toBe(true);
    });

    it('rejects outcode-only inputs', () => {
      expect(postcodeService.isFullPostcode('SG19')).toBe(false);
      expect(postcodeService.isFullPostcode('M1')).toBe(false);
      expect(postcodeService.isFullPostcode('EC1A')).toBe(false);
    });

    it('rejects garbage', () => {
      expect(postcodeService.isFullPostcode('not a postcode')).toBe(false);
      expect(postcodeService.isFullPostcode('')).toBe(false);
    });
  });

  describe('isOutcodeOnly', () => {
    it('accepts outcodes of all UK formats', () => {
      expect(postcodeService.isOutcodeOnly('SG19')).toBe(true);
      expect(postcodeService.isOutcodeOnly('M1')).toBe(true);
      expect(postcodeService.isOutcodeOnly('EC1A')).toBe(true);
      expect(postcodeService.isOutcodeOnly('W1A')).toBe(true);
    });

    it('rejects full postcodes', () => {
      expect(postcodeService.isOutcodeOnly('SG19 8AB')).toBe(false);
      expect(postcodeService.isOutcodeOnly('EC1A 1BB')).toBe(false);
    });

    it('rejects garbage', () => {
      expect(postcodeService.isOutcodeOnly('123')).toBe(false);
      expect(postcodeService.isOutcodeOnly('XYZ')).toBe(false);
      expect(postcodeService.isOutcodeOnly('')).toBe(false);
    });
  });

  describe('splitPostcode', () => {
    it('splits a full postcode into outcode + incode', () => {
      expect(postcodeService.splitPostcode('SG19 8AB')).toEqual({
        outcode: 'SG19',
        incode: '8AB',
      });
      expect(postcodeService.splitPostcode('EC1A 1BB')).toEqual({
        outcode: 'EC1A',
        incode: '1BB',
      });
    });

    it('returns outcode + empty incode for outcode-only', () => {
      expect(postcodeService.splitPostcode('SG19')).toEqual({
        outcode: 'SG19',
        incode: '',
      });
    });

    it('returns empty outcode + empty incode for garbage', () => {
      expect(postcodeService.splitPostcode('garbage')).toEqual({
        outcode: '',
        incode: '',
      });
    });
  });

  describe('completePostcode', () => {
    it('combines outcode + incode into a formatted full postcode', () => {
      expect(postcodeService.completePostcode('SG19', '8AB')).toBe('SG19 8AB');
      expect(postcodeService.completePostcode('ec1a', '1bb')).toBe('EC1A 1BB');
    });

    it('handles incode with whitespace + lowercase', () => {
      expect(postcodeService.completePostcode('SG19', ' 8ab ')).toBe('SG19 8AB');
    });

    it('returns null when the combination is not a valid full postcode', () => {
      expect(postcodeService.completePostcode('SG19', 'XYZ')).toBeNull();
      expect(postcodeService.completePostcode('SG19', '123')).toBeNull();
    });

    it('returns null when outcode arg is not actually an outcode', () => {
      expect(postcodeService.completePostcode('SG19 8AB', '1AA')).toBeNull();
      expect(postcodeService.completePostcode('garbage', '8AB')).toBeNull();
    });
  });
});
