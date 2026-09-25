// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, expect, it } from 'vitest';

import { jurisdictionFromPostcode } from '../jurisdiction';

describe('jurisdictionFromPostcode', () => {
  describe('whole-area postcodes', () => {
    it('should return wales for Cardiff CF10', () => {
      // Arrange
      const postcode = 'CF10 1AA';
      // Act
      const result = jurisdictionFromPostcode(postcode);
      // Assert
      expect(result).toBe('wales');
    });

    it('should return wales for Swansea SA1', () => {
      // Arrange
      const postcode = 'SA1 1AA';
      // Act
      const result = jurisdictionFromPostcode(postcode);
      // Assert
      expect(result).toBe('wales');
    });

    it('should return england for London SW1A with a lettered sub-district', () => {
      // Arrange
      const postcode = 'SW1A 1AA';
      // Act
      const result = jurisdictionFromPostcode(postcode);
      // Assert
      expect(result).toBe('england');
    });

    it('should return england for Biggleswade SG18', () => {
      // Arrange
      const postcode = 'SG18 8AB';
      // Act
      const result = jurisdictionFromPostcode(postcode);
      // Assert
      expect(result).toBe('england');
    });
  });

  describe('border areas with district-level splits', () => {
    it('should return england for Chester CH1', () => {
      // Arrange
      const postcode = 'CH1 2AB';
      // Act
      const result = jurisdictionFromPostcode(postcode);
      // Assert
      expect(result).toBe('england');
    });

    it('should return wales for Deeside CH5', () => {
      // Arrange
      const postcode = 'CH5 4AB';
      // Act
      const result = jurisdictionFromPostcode(postcode);
      // Assert
      expect(result).toBe('wales');
    });

    it('should return england for Shrewsbury SY1', () => {
      // Arrange
      const postcode = 'SY1 2AB';
      // Act
      const result = jurisdictionFromPostcode(postcode);
      // Assert
      expect(result).toBe('england');
    });

    it('should return wales for Welshpool SY21', () => {
      // Arrange
      const postcode = 'SY21 7AS';
      // Act
      const result = jurisdictionFromPostcode(postcode);
      // Assert
      expect(result).toBe('wales');
    });

    it('should return england for Hereford HR1', () => {
      // Arrange
      const postcode = 'HR1 2AB';
      // Act
      const result = jurisdictionFromPostcode(postcode);
      // Assert
      expect(result).toBe('england');
    });

    it('should return wales for Hay-on-Wye HR3 (mixed district, majority side)', () => {
      // HR3 genuinely straddles the border (Clifford/Cusop/Dorstone are
      // Herefordshire) but the post town Hay-on-Wye plus Clyro/Glasbury sit
      // in Powys — majority Wales is the encoded side. See jurisdiction.ts.
      // Arrange
      const postcode = 'HR3 5AB';
      // Act
      const result = jurisdictionFromPostcode(postcode);
      // Assert
      expect(result).toBe('wales');
    });

    it('should return wales for Mold CH7 and england for Ellesmere Port CH66', () => {
      // Arrange
      const moldPostcode = 'CH7 1AB';
      const ellesmerePortPostcode = 'CH66 1AB';
      // Act
      const moldResult = jurisdictionFromPostcode(moldPostcode);
      const ellesmerePortResult = jurisdictionFromPostcode(ellesmerePortPostcode);
      // Assert
      expect(moldResult).toBe('wales');
      expect(ellesmerePortResult).toBe('england');
    });

    it('should return england for Whitchurch SY13 and wales for Aberystwyth SY23', () => {
      // Arrange
      const whitchurchPostcode = 'SY13 1AB';
      const aberystwythPostcode = 'SY23 1AB';
      // Act
      const whitchurchResult = jurisdictionFromPostcode(whitchurchPostcode);
      const aberystwythResult = jurisdictionFromPostcode(aberystwythPostcode);
      // Assert
      expect(whitchurchResult).toBe('england');
      expect(aberystwythResult).toBe('wales');
    });
  });

  describe('input normalisation', () => {
    it('should normalise lower case and irregular spacing', () => {
      // Arrange
      const postcode = '  cf10   1aa ';
      // Act
      const result = jurisdictionFromPostcode(postcode);
      // Assert
      expect(result).toBe('wales');
    });

    it('should parse a full postcode with no space without misreading the district', () => {
      // "CH51AA" is CH5 1AA (Deeside, Wales) — a greedy digit parse would
      // wrongly read district 51 and fall through to England.
      // Arrange
      const postcode = 'CH51AA';
      // Act
      const result = jurisdictionFromPostcode(postcode);
      // Assert
      expect(result).toBe('wales');
    });

    it('should accept an outward-only postcode', () => {
      // Arrange
      const postcode = 'sy21';
      // Act
      const result = jurisdictionFromPostcode(postcode);
      // Assert
      expect(result).toBe('wales');
    });
  });

  describe('null cases', () => {
    it('should return null when the input is unparseable', () => {
      // Arrange
      const inputs = ['', '   ', 'NOT A POSTCODE', '12345', 'CF', 'S'];
      // Act
      const results = inputs.map(jurisdictionFromPostcode);
      // Assert
      expect(results).toEqual([null, null, null, null, null, null]);
    });

    it('should return null for postcodes outside England and Wales', () => {
      // TA6 only applies in England & Wales — Scotland and Northern Ireland
      // must not be silently mapped to either jurisdiction.
      // Arrange
      const edinburghPostcode = 'EH1 1AA';
      const belfastPostcode = 'BT1 1AA';
      // Act
      const edinburghResult = jurisdictionFromPostcode(edinburghPostcode);
      const belfastResult = jurisdictionFromPostcode(belfastPostcode);
      // Assert
      expect(edinburghResult).toBeNull();
      expect(belfastResult).toBeNull();
    });
  });
});
