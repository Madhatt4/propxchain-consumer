import { describe, it, expect } from 'vitest';

import { buildProfessionalOverview, type TransactionSnapshot } from '../professionalOverview';

const DAY = 24 * 60 * 60 * 1000;

function snap(overrides: Partial<TransactionSnapshot> = {}): TransactionSnapshot {
  return {
    transactionId: 'tx-1',
    propertyAddress: '10 Example Rd',
    buyer: 'buyer-p',
    seller: 'seller-p',
    status: 'active',
    events: [],
    ...overrides,
  };
}

describe('buildProfessionalOverview — stats', () => {
  it('reports zero counts for an empty list', () => {
    const o = buildProfessionalOverview([], 0);
    expect(o.stats.total).toBe(0);
    expect(o.attention).toHaveLength(0);
    expect(o.transactions).toHaveLength(0);
  });

  it('classifies a fresh transaction as active', () => {
    const o = buildProfessionalOverview([snap()], 0);
    expect(o.stats.total).toBe(1);
    expect(o.stats.active).toBe(1);
  });

  it('classifies a completed transaction as completed', () => {
    const o = buildProfessionalOverview(
      [snap({ status: 'blockchain_completed', events: [{ eventType: 'blockchain_completed', timestamp: 0 }] })],
      0,
    );
    expect(o.stats.completed).toBe(1);
  });

  it('classifies an exchanged transaction as completing', () => {
    const o = buildProfessionalOverview(
      [snap({ status: 'exchanged', buyer: 'b', seller: 's', events: [{ eventType: 'contract_exchanged', timestamp: 0 }] })],
      0,
    );
    expect(o.stats.completing).toBe(1);
  });
});

describe('buildProfessionalOverview — attention', () => {
  it('aggregates reminders across transactions and sorts critical-first', () => {
    const t1 = snap({
      transactionId: 'tx-1',
      events: [{ eventType: 'blockchain_completed', timestamp: 0 }],
    });
    const t2 = snap({
      transactionId: 'tx-2',
      events: [{ eventType: 'buyer_joined', timestamp: 0 }],
    });

    const o = buildProfessionalOverview([t1, t2], 15 * DAY);

    // tx-1 has lr-submission-delay (high) and sdlt-deadline (critical at 14+ days)
    // tx-2 has buyer-solicitor-delay + searches-delay (high each)
    const byUrgency = o.attention.map((a) => a.reminder.urgency);
    expect(byUrgency[0]).toBe('critical');
    // overall order must be non-decreasing by urgency rank
    const rank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    for (let i = 1; i < byUrgency.length; i += 1) {
      expect(rank[byUrgency[i]]).toBeGreaterThanOrEqual(rank[byUrgency[i - 1]]);
    }
  });

  it('carries the transactionId + property address with each attention item', () => {
    const o = buildProfessionalOverview(
      [
        snap({
          transactionId: 'ABC',
          propertyAddress: '1 Main St',
          events: [{ eventType: 'blockchain_completed', timestamp: 0 }],
        }),
      ],
      15 * DAY,
    );
    expect(o.attention.length).toBeGreaterThan(0);
    expect(o.attention[0].transactionId).toBe('ABC');
    expect(o.attention[0].propertyAddress).toBe('1 Main St');
  });

  it('caps attention at the configured maximum', () => {
    // 30 transactions, each with at least one active reminder
    const snaps: TransactionSnapshot[] = Array.from({ length: 30 }).map((_, i) =>
      snap({
        transactionId: `tx-${i}`,
        events: [{ eventType: 'buyer_joined', timestamp: 0 }],
      }),
    );
    const o = buildProfessionalOverview(snaps, 10 * DAY, 10);
    expect(o.attention.length).toBe(10);
  });
});

describe('buildProfessionalOverview — forms status', () => {
  it('counts completion states across transactions', () => {
    const snaps = [
      snap({
        transactionId: 'a',
        events: [
          { eventType: 'seller_forms_completed', timestamp: 0 },
          { eventType: 'searches_ordered', timestamp: 0 },
        ],
      }),
      snap({
        transactionId: 'b',
        events: [{ eventType: 'seller_forms_completed', timestamp: 0 }],
      }),
      snap({ transactionId: 'c' }),
    ];
    const o = buildProfessionalOverview(snaps, 0);
    expect(o.formsTotals.sellerFormsComplete).toBe(2);
    expect(o.formsTotals.searchesOrdered).toBe(1);
    expect(o.formsTotals.contractExchanged).toBe(0);
    expect(o.formsTotals.completed).toBe(0);
  });
});

describe('buildProfessionalOverview — per-transaction summaries', () => {
  it('includes top urgency for each transaction with reminders', () => {
    const snaps = [
      snap({
        transactionId: 'a',
        events: [{ eventType: 'blockchain_completed', timestamp: 0 }],
      }),
      snap({
        transactionId: 'b',
        events: [], // no events → no reminders
      }),
    ];
    const o = buildProfessionalOverview(snaps, 15 * DAY);
    const a = o.transactions.find((t) => t.transactionId === 'a')!;
    const b = o.transactions.find((t) => t.transactionId === 'b')!;
    expect(a.topUrgency).toBe('critical');
    expect(b.topUrgency).toBeNull();
  });

  it('sets formsStatus booleans from audit events', () => {
    const s = snap({
      events: [
        { eventType: 'seller_forms_completed', timestamp: 0 },
        { eventType: 'searches_ordered', timestamp: 0 },
      ],
    });
    const o = buildProfessionalOverview([s], 0);
    expect(o.transactions[0].formsStatus.sellerFormsComplete).toBe(true);
    expect(o.transactions[0].formsStatus.searchesOrdered).toBe(true);
    expect(o.transactions[0].formsStatus.contractExchanged).toBe(false);
  });
});
