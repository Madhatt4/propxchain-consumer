import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  from: vi.fn(),
  scans: { data: [] as unknown, error: null as { code: string; message: string } | null },
  personal: { data: [] as unknown, error: null as { code: string; message: string } | null },
  selected: [] as string[],
  filters: [] as Array<[string, string]>,
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      db.from(table);
      const result = table === 'search_scans' ? db.scans : db.personal;
      const chain = {
        select: (columns: string) => {
          db.selected.push(columns);
          return chain;
        },
        eq: (column: string, value: string) => {
          db.filters.push([column, value]);
          return chain;
        },
        in: () => chain,
        order: () => chain,
        then: (resolve: (r: unknown) => unknown) => Promise.resolve(result).then(resolve),
      };
      return chain;
    },
  },
}));
vi.mock('../../utils/logger', () => ({ logger: { error: vi.fn() } }));

import { fetchSharedSearchScans } from '../sharedSearchScans';

const ROW = {
  id: 'scan-1',
  provider: 'onesearch',
  provider_order_id: 'order-1',
  status: 'complete',
  explainer: ' The search found a planning notice. ',
  flags: [{ statement: 'A planning notice is recorded.', search_name: 'LLC1', location: 'Part 3' }],
  warnings: ['Page 4 could not be read.'],
  personal_findings_count: 2,
};

const FINDING = {
  key: 'applicant',
  label: 'Applicant',
  value: 'Alex Synthetic',
  personal_data: true,
  confidence: 'high',
  provenance: 'LLC1, part 3',
};

describe('fetchSharedSearchScans', () => {
  beforeEach(() => {
    db.from.mockClear();
    db.selected.length = 0;
    db.filters.length = 0;
    db.scans = { data: [ROW], error: null };
    db.personal = { data: [], error: null };
  });

  it('should name its columns and never select user_id', async () => {
    await fetchSharedSearchScans('tx_1');

    const [columns] = db.selected;
    expect(columns).not.toContain('user_id');
    expect(columns).not.toContain('*');
    expect(columns).not.toContain('error_message');
  });

  it('should read only shared rows on this transaction', async () => {
    await fetchSharedSearchScans('tx_1');

    expect(db.filters).toEqual([
      ['transaction_id', 'tx_1'],
      ['scope', 'shared'],
    ]);
  });

  it('should map a row, with no user id or enquiries on the result', async () => {
    db.scans.data = [{ ...ROW, user_id: 'orderer', enquiries: ['Ask about X'] }];

    const [scan] = await fetchSharedSearchScans('tx_1');

    expect(scan).toEqual({
      id: 'scan-1',
      provider: 'onesearch',
      providerOrderId: 'order-1',
      status: 'complete',
      explainer: 'The search found a planning notice.',
      flags: [{ statement: 'A planning notice is recorded.', searchName: 'LLC1', location: 'Part 3' }],
      warnings: ['Page 4 could not be read.'],
      personalFindingsCount: 2,
      personalFindings: null,
    });
  });

  it('should never read scan_judgements', async () => {
    await fetchSharedSearchScans('tx_1');

    expect(db.from).not.toHaveBeenCalledWith('scan_judgements');
  });

  it('should give the orderer their personal findings', async () => {
    db.personal.data = [{ scan_id: 'scan-1', findings: [FINDING] }];

    const [scan] = await fetchSharedSearchScans('tx_1');

    expect(scan.personalFindings).toEqual([FINDING]);
  });

  it('should leave another party with the count alone, because RLS returns no row', async () => {
    db.personal.data = [];

    const [scan] = await fetchSharedSearchScans('tx_1');

    expect(scan.personalFindings).toBeNull();
    expect(scan.personalFindingsCount).toBe(2);
  });

  it('should fall back to the count when the personal findings read fails', async () => {
    db.personal = { data: null, error: { code: '42501', message: 'denied' } };

    const [scan] = await fetchSharedSearchScans('tx_1');

    expect(scan.personalFindings).toBeNull();
  });

  it('should not ask for personal findings when a scan has none', async () => {
    db.scans.data = [{ ...ROW, personal_findings_count: 0 }];

    await fetchSharedSearchScans('tx_1');

    expect(db.from).not.toHaveBeenCalledWith('search_scan_personal_findings');
  });

  it('should drop malformed flags and warnings rather than crash', async () => {
    db.scans.data = [{
      ...ROW,
      flags: [null, { statement: '' , search_name: 'LLC1' }, { statement: 'Kept', search_name: 'CON29' }, 'text'],
      warnings: ['Kept', 7, ''],
    }];

    const [scan] = await fetchSharedSearchScans('tx_1');

    expect(scan.flags).toEqual([{ statement: 'Kept', searchName: 'CON29' }]);
    expect(scan.warnings).toEqual(['Kept']);
  });

  it('should treat non-array flags, warnings and a null explainer as empty', async () => {
    db.scans.data = [{ ...ROW, flags: null, warnings: {}, explainer: null, personal_findings_count: null }];

    const [scan] = await fetchSharedSearchScans('tx_1');

    expect(scan).toMatchObject({ flags: [], warnings: [], explainer: '', personalFindingsCount: 0 });
  });

  it('should treat an unknown status as an error, not as finished', async () => {
    db.scans.data = [{ ...ROW, status: 'something-new' }];

    const [scan] = await fetchSharedSearchScans('tx_1');

    expect(scan.status).toBe('error');
  });

  it.each(['42703', '42P01', 'PGRST204', 'PGRST205'])(
    'should return no scans when the migration is not live yet (%s)',
    async (code) => {
      db.scans = { data: null, error: { code, message: 'column search_scans.scope does not exist' } };

      await expect(fetchSharedSearchScans('tx_1')).resolves.toEqual([]);
    },
  );

  it('should throw on a real read failure', async () => {
    db.scans = { data: null, error: { code: '500', message: 'boom' } };

    await expect(fetchSharedSearchScans('tx_1')).rejects.toThrow('could not be read');
  });
});
