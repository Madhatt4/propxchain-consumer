import { describe, expect, it } from 'vitest';
import type { BuyerPackItem } from '../buyerPack.service';
import { describeOfferExpiry, offerExpiryFromPack, OFFER_WARNING_DAYS } from '../offerExpiry';

const packWith = (offer_expires_on?: string): BuyerPackItem[] => [
  { item: 'mortgage', status: 'ready', detail: { funding_type: 'mortgage', mortgage_stage: 'offer', offer_expires_on }, onLedger: true, pending: false },
];
const at = (iso: string) => Date.parse(`${iso}T15:30:00Z`);

describe('offerExpiryFromPack', () => {
  it('is null with no confirmed date', () => {
    expect(offerExpiryFromPack(packWith(undefined), at('2026-10-11'))).toBeNull();
    expect(offerExpiryFromPack(null, at('2026-10-11'))).toBeNull();
    expect(offerExpiryFromPack(packWith('31/03/2027'), at('2026-10-11'))).toBeNull();
  });

  it('is quiet with more than a month to go', () => {
    expect(offerExpiryFromPack(packWith('2027-03-31'), at('2026-10-11'))).toMatchObject({ state: 'ok' });
  });

  it('warns from a month out, still usable on the day itself, expired the day after', () => {
    expect(offerExpiryFromPack(packWith('2026-11-10'), at('2026-10-11'))).toMatchObject({ state: 'soon', daysLeft: OFFER_WARNING_DAYS });
    expect(offerExpiryFromPack(packWith('2026-11-11'), at('2026-10-11'))).toMatchObject({ state: 'ok' });
    expect(offerExpiryFromPack(packWith('2026-10-11'), at('2026-10-11'))).toMatchObject({ state: 'soon', daysLeft: 0 });
    expect(offerExpiryFromPack(packWith('2026-10-10'), at('2026-10-11'))).toMatchObject({ state: 'expired', daysLeft: -1 });
  });
});

describe('describeOfferExpiry', () => {
  it('names the date and what to do', () => {
    expect(describeOfferExpiry({ state: 'soon', expiresOn: '2026-11-01', daysLeft: 21 }))
      .toBe("The buyer's mortgage offer expires on 1 November 2026, 21 days from now. If completion may be later, ask the lender about an extension now.");
    expect(describeOfferExpiry({ state: 'soon', expiresOn: '2026-10-11', daysLeft: 0 })).toMatch(/expires today/);
    expect(describeOfferExpiry({ state: 'expired', expiresOn: '2026-10-01', daysLeft: -10 })).toMatch(/expired on 1 October 2026/);
  });
});
