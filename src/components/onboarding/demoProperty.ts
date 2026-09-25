/**
 * The seeded demo property shown on an otherwise empty dashboard.
 *
 * SAFETY: this deliberately does NOT use the `Transaction` type. A demo object
 * that satisfies Transaction can be handed to icpService, the payment worker or a
 * search provider by a later refactor that never knew this file existed. Giving
 * it its own shape means the compiler refuses.
 *
 * It is never added to the `transactions` array, so dashboard counts stay honest,
 * and it is never persisted anywhere.
 *
 * Why a demo at all: the welcome cards close onto an empty dashboard, which is the
 * worst moment in our first-run experience — the user has just been told what is
 * possible and is then shown nothing.
 */

export interface DemoStage {
  readonly label: string;
  readonly state: 'done' | 'active' | 'todo';
  readonly detail: string;
}

export interface DemoPropertyFixture {
  readonly isDemo: true;
  readonly addressLine: string;
  readonly postcode: string;
  readonly priceLabel: string;
  readonly tenure: string;
  readonly epc: string;
  readonly stages: readonly DemoStage[];
  readonly packItems: readonly string[];
}

export const DEMO_PROPERTY: DemoPropertyFixture = {
  isDemo: true,
  addressLine: '14 Sandhill Rise',
  postcode: 'SG19 1QT',
  priceLabel: '£385,000',
  tenure: 'Freehold',
  epc: 'C',
  stages: [
    { label: 'Property added', state: 'done', detail: 'Found from the postcode.' },
    { label: 'Ownership confirmed', state: 'done', detail: 'Title checked against the Land Registry.' },
    { label: 'Forms completed', state: 'done', detail: 'TA6 and TA10 answered and saved.' },
    { label: 'Facts gathered', state: 'done', detail: 'EPC, flood risk, planning and recent sales.' },
    { label: 'Searches ordered', state: 'active', detail: 'With the provider — usually back within days.' },
    { label: 'Pack shared', state: 'todo', detail: 'One link for the buyer and their conveyancer.' },
  ],
  packItems: [
    'Title register and title plan',
    'TA6 property information form',
    'TA10 fittings and contents',
    'EPC — rating C',
    'Flood risk summary',
    'Planning history',
    'Recent sold prices nearby',
  ],
};
