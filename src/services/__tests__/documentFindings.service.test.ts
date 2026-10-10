// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The consents scan's stored findings as "Check my answers" reads them: the
 * newest row per document, labels from the one table, nothing else shown.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockOrder = vi.fn();

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({ order: (...args: unknown[]) => mockOrder(...args) }),
      }),
    }),
  },
}));
vi.mock('../../utils/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

import {
  FINDING_LABELS,
  loadPaperworkFindings,
  summarisePaperwork,
  type DocumentFindingsRow,
} from '../documentFindings.service';

function row(overrides: Partial<DocumentFindingsRow> = {}): DocumentFindingsRow {
  return {
    storage_path: 'transactions/tx_1/ta6/abc.pdf',
    section: '5.2',
    context: { kind: 'planning-permission', relatesTo: 'extension' },
    findings: [{ key: 'conditions_outstanding', probability: 0.8 }, { key: 'planning_lapsed', probability: 1 }],
    created_at: '2026-10-10T10:00:00.000Z',
    ...overrides,
  };
}

describe('summarisePaperwork', () => {
  it('should keep only the newest row per document when rows arrive newest first', () => {
    const summaries = summarisePaperwork([
      row({ created_at: '2026-10-10T12:00:00.000Z', findings: [{ key: 'not_a_grant', probability: 0.7 }] }),
      row({ created_at: '2026-10-10T10:00:00.000Z' }),
    ]);

    expect(summaries).toHaveLength(1);
    expect(summaries[0].findings).toEqual([FINDING_LABELS.not_a_grant]);
  });

  it('should name a 5.2 document by its paperwork kind and the change it covers', () => {
    const [summary] = summarisePaperwork([row()]);

    expect(summary).toEqual({
      section: '5.2',
      title: 'Planning permission for the extension',
      findings: [FINDING_LABELS.conditions_outstanding, FINDING_LABELS.planning_lapsed],
    });
  });

  it('should name a 6.1 guarantee by the work it covers', () => {
    const [summary] = summarisePaperwork([
      row({ section: '6.1', context: { warrantyType: 'damp-proofing' }, findings: [{ key: 'not_transferable', probability: 0.7 }] }),
    ]);

    expect(summary.title).toBe('Damp proofing guarantee');
    expect(summary.findings).toEqual([FINDING_LABELS.not_transferable]);
  });

  it('should fall back to the slot alone when the seller has not said what the paperwork is', () => {
    const [summary] = summarisePaperwork([row({ context: { kind: null, relatesTo: null } })]);

    expect(summary.title).toBe('Alteration paperwork');
  });

  it('should leave out a document with nothing to say and drop a finding key it has no words for', () => {
    expect(summarisePaperwork([row({ findings: [] }), row({ findings: null })])).toEqual([]);
    expect(summarisePaperwork([row({ findings: [{ key: 'made_up', probability: 0.9 }] })])).toEqual([]);
  });

  it('should give every finding a plain-English label', () => {
    for (const label of Object.values(FINDING_LABELS)) {
      expect(label.length).toBeGreaterThan(10);
      expect(label).not.toContain('_');
    }
  });
});

describe('loadPaperworkFindings', () => {
  beforeEach(() => {
    mockOrder.mockReset();
  });

  it('should read the transaction rows newest first and summarise them', async () => {
    mockOrder.mockResolvedValue({ data: [row()], error: null });

    const summaries = await loadPaperworkFindings('tx_1');

    expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(summaries).toHaveLength(1);
  });

  it('should resolve to an empty list on a read failure rather than throw', async () => {
    mockOrder.mockResolvedValue({ data: null, error: { message: 'permission denied' } });

    expect(await loadPaperworkFindings('tx_1')).toEqual([]);
  });
});
