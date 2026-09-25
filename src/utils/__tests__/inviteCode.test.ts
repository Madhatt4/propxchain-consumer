import { describe, it, expect } from 'vitest';
import {
  normaliseInviteCode,
  isValidInviteCode,
  formatInviteCodeInput,
} from '../inviteCode';

/**
 * The regression these guard: the old formatter auto-prefixed "TX-" on every
 * keystroke, so TYPING a code produced TX-TX-C-T3L- and left the Continue
 * button disabled with no error. PASTING the same code worked. The buyer join
 * path — the single most important consumer action after a seller creates a
 * transaction — worked for people who pasted and failed silently for people
 * who typed.
 */
describe('formatInviteCodeInput — what happens while typing', () => {
  it('should NOT inject a TX- prefix on the first character', () => {
    // This is the exact keystroke that started the corruption.
    expect(formatInviteCodeInput('T')).toBe('T');
  });

  it('should survive the whole code being typed one character at a time', () => {
    const target = 'TX-CT3L-FXAU';
    let field = '';
    for (const ch of target) {
      field = formatInviteCodeInput(field + ch);
    }
    expect(field).toBe(target);
    expect(isValidInviteCode(field)).toBe(true);
  });

  it('should survive the code being pasted whole', () => {
    expect(formatInviteCodeInput('TX-CT3L-FXAU')).toBe('TX-CT3L-FXAU');
  });

  it('should uppercase and drop characters that can never appear', () => {
    expect(formatInviteCodeInput('tx-ct3l fxau!')).toBe('TX-CT3LFXAU');
  });

  it('should cap the alphanumeric count so the field cannot accumulate junk', () => {
    expect(formatInviteCodeInput('TXCT3LFXAUZZZZZZ')).toBe('TXCT3LFXAU');
  });
});

describe('normaliseInviteCode — what the app acts on', () => {
  it.each([
    ['TX-CT3L-FXAU', 'canonical'],
    ['tx-ct3l-fxau', 'lowercase'],
    ['TXCT3LFXAU', 'no punctuation'],
    ['CT3L-FXAU', 'prefix omitted'],
    ['ct3l fxau', 'spaces instead of hyphens'],
    ['  TX-CT3L-FXAU  ', 'padded'],
  ])('should accept %s (%s)', (input) => {
    expect(normaliseInviteCode(input)).toBe('TX-CT3L-FXAU');
  });

  it.each([
    ['', 'empty'],
    ['TX', 'prefix only'],
    ['TX-CT3L', 'half a code'],
    ['TX-CT3L-FXAUX', 'one too many'],
  ])('should reject %s (%s)', (input) => {
    expect(normaliseInviteCode(input)).toBeNull();
    expect(isValidInviteCode(input)).toBe(false);
  });

  it('should not read a bare TX as an empty code', () => {
    // Guard on the slice: stripping "TX" from "TX" would leave "", and an
    // 8-char check is the only thing standing between that and a lookup.
    expect(normaliseInviteCode('TX')).toBeNull();
  });
});
