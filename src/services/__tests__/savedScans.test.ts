import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  tables: [] as string[],
  filters: [] as Array<[string, unknown]>,
  result: { data: [] as unknown, error: null as { code: string; message: string } | null },
  shouldThrow: false,
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      if (db.shouldThrow) throw new Error('network down');
      db.tables.push(table);
      const chain = {
        select: () => chain,
        eq: (column: string, value: unknown) => {
          db.filters.push([column, value]);
          return chain;
        },
        in: (column: string, values: unknown) => {
          db.filters.push([column, values]);
          return chain;
        },
        order: () => chain,
        limit: () => chain,
        then: (resolve: (r: unknown) => unknown) => Promise.resolve(db.result).then(resolve),
      };
      return chain;
    },
  },
}));
vi.mock('../../utils/logger', () => ({ logger: { error: vi.fn() } }));

import { logger } from '../../utils/logger';
import { fetchSavedScans, savedRowToRun, savedScanFilename } from '../savedScans';

const ROW = {
  source_ref: 'survey:tx_1:survey.pdf',
  status: 'complete',
  findings: [{
    key: 'roof',
    label: 'Roof',
    value: 'Condition rating 3',
    personal_data: false,
    confidence: 'high',
    provenance: 'Section E2',
  }],
  explainer: ' The roof needs work. ',
  flags_for_conveyancer: ['Ask about the roof guarantee.', 7],
};

describe('fetchSavedScans', () => {
  beforeEach(() => {
    db.tables = [];
    db.filters = [];
    db.result = { data: [ROW], error: null };
    db.shouldThrow = false;
    vi.mocked(logger.error).mockClear();
  });

  it('should read the survey table filtered to this transaction and terminal rows', async () => {
    const runs = await fetchSavedScans('survey', 'tx_1');

    expect(db.tables).toEqual(['survey_scans']);
    expect(db.filters).toContainEqual(['transaction_id', 'tx_1']);
    expect(db.filters).toContainEqual(['status', ['complete', 'unsupported']]);
    expect(db.filters.some(([c]) => c === 'scope')).toBe(false);
    expect(runs).toEqual([{
      status: 'complete',
      result: {
        scan_type: 'survey',
        source_ref: 'survey:tx_1:survey.pdf',
        findings: ROW.findings,
        explainer: 'The roof needs work.',
        flags_for_conveyancer: ['Ask about the roof guarantee.'],
      },
    }]);
  });

  it('should read only private search scans, leaving shared ones to their own panel', async () => {
    db.result = { data: [{ ...ROW, source_ref: 'search:tx_1:llc1.pdf' }], error: null };

    const runs = await fetchSavedScans('search', 'tx_1');

    expect(db.tables).toEqual(['search_scans']);
    expect(db.filters).toContainEqual(['scope', 'private']);
    expect(runs[0]?.result.scan_type).toBe('search');
  });

  it('should return an empty list and log only the error code when the read fails', async () => {
    db.result = { data: null, error: { code: '42501', message: 'permission denied for Alex' } };

    const runs = await fetchSavedScans('survey', 'tx_1');

    expect(runs).toEqual([]);
    expect(logger.error).toHaveBeenCalledWith('Failed to read saved survey scans:', '42501');
  });

  it('should return an empty list when the client throws', async () => {
    db.shouldThrow = true;

    await expect(fetchSavedScans('search', 'tx_1')).resolves.toEqual([]);
  });

  it('should return an empty list when there is no saved scan', async () => {
    db.result = { data: [], error: null };

    await expect(fetchSavedScans('survey', 'tx_1')).resolves.toEqual([]);
  });
});

describe('savedRowToRun', () => {
  it('should drop a row that is not terminal', () => {
    expect(savedRowToRun('survey', { ...ROW, status: 'pending' })).toBeNull();
    expect(savedRowToRun('survey', { ...ROW, status: 'error' })).toBeNull();
  });

  it('should keep an unsupported row so the card can explain why', () => {
    const run = savedRowToRun('survey', { ...ROW, status: 'unsupported', findings: null });

    expect(run?.status).toBe('unsupported');
    expect(run?.result.findings).toEqual([]);
  });

  it('should treat a finding without an explicit personal_data false as personal', () => {
    const run = savedRowToRun('survey', {
      ...ROW,
      findings: [{ key: 'k', label: 'Occupier', value: 'Alex Synthetic', confidence: 'odd' }, { key: 1 }],
    });

    expect(run?.result.findings).toEqual([{
      key: 'k',
      label: 'Occupier',
      value: 'Alex Synthetic',
      personal_data: true,
      confidence: 'low',
      provenance: '',
    }]);
  });
});

describe('savedScanFilename', () => {
  it('should return the filename from an upload on this transaction', () => {
    expect(savedScanFilename('survey:tx_1:my survey.pdf', 'tx_1')).toBe('my survey.pdf');
    expect(savedScanFilename('search:tx_1:a:b.pdf', 'tx_1')).toBe('a:b.pdf');
  });

  it('should return null for a OneSearch order reference or another transaction', () => {
    expect(savedScanFilename('search:onesearch:PXC-1', 'tx_1')).toBeNull();
    expect(savedScanFilename('survey:tx_2:survey.pdf', 'tx_1')).toBeNull();
    expect(savedScanFilename('survey:tx_1:', 'tx_1')).toBeNull();
  });
});
