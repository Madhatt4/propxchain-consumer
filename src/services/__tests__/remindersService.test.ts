import { describe, it, expect } from 'vitest';

import {
  generateReminders,
  type ReminderInput,
} from '../remindersService';

const DAY = 24 * 60 * 60 * 1000;

function input(overrides: Partial<ReminderInput> = {}): ReminderInput {
  return {
    status: 'active',
    buyer: 'buyer-p',
    seller: 'seller-p',
    events: [],
    now: 100 * DAY,
    ...overrides,
  };
}

describe('generateReminders — seller rules', () => {
  it('fires seller-solicitor-delay 2+ days after listing if no conveyancer event', () => {
    const rems = generateReminders(
      input({
        now: 5 * DAY,
        events: [{ eventType: 'transaction_created', timestamp: 0 }],
      }),
    );
    expect(rems.map((r) => r.id)).toContain('seller-solicitor-delay');
  });

  it('suppresses seller-solicitor-delay once seller_conveyancer_confirmed fires', () => {
    const rems = generateReminders(
      input({
        now: 5 * DAY,
        events: [
          { eventType: 'transaction_created', timestamp: 0 },
          { eventType: 'seller_conveyancer_confirmed', timestamp: 3 * DAY },
        ],
      }),
    );
    expect(rems.map((r) => r.id)).not.toContain('seller-solicitor-delay');
  });

  it('fires seller-forms-delay only after 7 days', () => {
    const early = generateReminders(
      input({
        now: 3 * DAY,
        events: [{ eventType: 'transaction_created', timestamp: 0 }],
      }),
    );
    expect(early.map((r) => r.id)).not.toContain('seller-forms-delay');

    const late = generateReminders(
      input({
        now: 10 * DAY,
        events: [{ eventType: 'transaction_created', timestamp: 0 }],
      }),
    );
    expect(late.map((r) => r.id)).toContain('seller-forms-delay');
  });
});

describe('generateReminders — buyer rules', () => {
  it('fires buyer-solicitor-delay 3+ days after buyer_joined', () => {
    const rems = generateReminders(
      input({
        now: 5 * DAY,
        events: [{ eventType: 'buyer_joined', timestamp: 0 }],
      }),
    );
    expect(rems.map((r) => r.id)).toContain('buyer-solicitor-delay');
  });

  it('fires searches-delay 5+ days after buyer_joined', () => {
    const rems = generateReminders(
      input({
        now: 6 * DAY,
        events: [{ eventType: 'buyer_joined', timestamp: 0 }],
      }),
    );
    expect(rems.map((r) => r.id)).toContain('searches-delay');
  });

  it('suppresses searches-delay once searches_ordered fires', () => {
    const rems = generateReminders(
      input({
        now: 20 * DAY,
        events: [
          { eventType: 'buyer_joined', timestamp: 0 },
          { eventType: 'searches_ordered', timestamp: 6 * DAY },
        ],
      }),
    );
    expect(rems.map((r) => r.id)).not.toContain('searches-delay');
  });

  it('fires buyer-mortgage-delay at 14 days with medium urgency', () => {
    const rems = generateReminders(
      input({
        now: 15 * DAY,
        events: [{ eventType: 'buyer_joined', timestamp: 0 }],
      }),
    );
    const m = rems.find((r) => r.id === 'buyer-mortgage-delay');
    expect(m).toBeDefined();
    expect(m?.urgency).toBe('medium');
  });
});

describe('generateReminders — post-exchange rules', () => {
  it('fires completion-delay 14+ days after exchange', () => {
    const rems = generateReminders(
      input({
        now: 15 * DAY,
        events: [{ eventType: 'contract_exchanged', timestamp: 0 }],
      }),
    );
    const r = rems.find((x) => x.id === 'completion-delay');
    expect(r).toBeDefined();
    expect(r?.urgency).toBe('medium');
  });

  it('ramps completion-delay to high at 30+ days', () => {
    const rems = generateReminders(
      input({
        now: 35 * DAY,
        events: [{ eventType: 'contract_exchanged', timestamp: 0 }],
      }),
    );
    const r = rems.find((x) => x.id === 'completion-delay');
    expect(r?.urgency).toBe('high');
  });

  it('suppresses completion-delay once blockchain_completed fires', () => {
    const rems = generateReminders(
      input({
        now: 40 * DAY,
        events: [
          { eventType: 'contract_exchanged', timestamp: 0 },
          { eventType: 'blockchain_completed', timestamp: 10 * DAY },
        ],
      }),
    );
    expect(rems.map((r) => r.id)).not.toContain('completion-delay');
  });

  it('fires lr-submission-delay 7+ days after completion', () => {
    const rems = generateReminders(
      input({
        now: 8 * DAY,
        events: [{ eventType: 'blockchain_completed', timestamp: 0 }],
      }),
    );
    expect(rems.map((r) => r.id)).toContain('lr-submission-delay');
  });

  it('fires SDLT deadline critical at 14+ days post-completion', () => {
    const rems = generateReminders(
      input({
        now: 15 * DAY,
        events: [{ eventType: 'blockchain_completed', timestamp: 0 }],
      }),
    );
    const r = rems.find((x) => x.id === 'sdlt-deadline');
    expect(r?.urgency).toBe('critical');
  });
});

describe('generateReminders — ordering', () => {
  it('sorts critical before high before medium before low', () => {
    const rems = generateReminders(
      input({
        now: 30 * DAY,
        events: [
          { eventType: 'transaction_created', timestamp: 0 },
          { eventType: 'buyer_joined', timestamp: 1 * DAY },
          { eventType: 'blockchain_completed', timestamp: 16 * DAY },
        ],
      }),
    );
    const urgencies = rems.map((r) => r.urgency);
    const expectedOrder = ['critical', 'high', 'medium', 'low'];
    // Check sort is monotonic by urgency rank
    for (let i = 1; i < urgencies.length; i += 1) {
      const prev = expectedOrder.indexOf(urgencies[i - 1]);
      const cur = expectedOrder.indexOf(urgencies[i]);
      expect(prev).toBeLessThanOrEqual(cur);
    }
  });

  it('returns an empty array when no events fired any rule', () => {
    expect(generateReminders(input({ events: [] }))).toEqual([]);
  });
});
