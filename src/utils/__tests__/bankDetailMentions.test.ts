import { describe, expect, it } from 'vitest';
import { mentionsBankDetails } from '../bankDetailMentions';

describe('mentionsBankDetails', () => {
  it.each([
    'Please pay the deposit to sort code 20-00-00, account 12345678.',
    'Our account has moved: 40 47 84 / 87654321',
    'IBAN GB33 BUKB 2020 1555 5555 55 for completion monies',
    'GB33BUKB20201555555555',
    'Our bank details have changed, please use the ones below',
    'Can you confirm your bank account details?',
    'We have a new account for client money.',
    'Please send the payment details by Friday',
    'Notice of change of bank',
    'Account no. is on the invoice',
  ])('flags %s', (text) => {
    expect(mentionsBankDetails(text)).toBe(true);
  });

  it.each([
    'Exchange is booked for 12-11-26.',
    'The searches came back clean.',
    'Reference 12345678 for the survey.',
    'Can we move completion to the Friday?',
    '',
  ])('leaves %s alone', (text) => {
    expect(mentionsBankDetails(text)).toBe(false);
  });

  it('handles missing text', () => {
    expect(mentionsBankDetails(undefined)).toBe(false);
    expect(mentionsBankDetails(null)).toBe(false);
  });
});
