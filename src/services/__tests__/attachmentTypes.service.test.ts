// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetDocuments = vi.fn();
const mockClassifications = vi.fn();

vi.mock('../icp.service', () => ({
  icpService: { getDocumentsByTransaction: (...a: unknown[]) => mockGetDocuments(...a) },
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ order: () => mockClassifications() }) }),
    }),
  },
}));

import { loadAttachmentTypes } from '../attachmentTypes.service';

const PATH = 'transactions/tx-1/ta6/08c8cfb07f21.png';

function classified(overrides: Record<string, unknown> = {}) {
  return { storage_path: PATH, doc_type: 'eicr', confidence: '0.97', unreadable: false, ...overrides };
}

describe('loadAttachmentTypes', () => {
  beforeEach(() => {
    mockGetDocuments.mockReset().mockResolvedValue([
      { id: 'doc_48', storageLocation: `supabase://propxchain-documents/${PATH}` },
      { id: 'doc_49', storageLocation: 'supabase://propxchain-documents/transactions/tx-1/ta6/never-read.pdf' },
    ]);
    mockClassifications.mockReset();
  });

  it('should name each document by the type it was read as, keyed by the id a TA6 slot stores', async () => {
    mockClassifications.mockResolvedValue({ data: [classified()], error: null });

    const types = await loadAttachmentTypes('tx-1');

    expect(types.get('48')).toBe('Electrical installation condition report');
    expect(types.has('49')).toBe(false);
  });

  it('should go by the newest classification of a file', async () => {
    mockClassifications.mockResolvedValue({
      data: [classified({ doc_type: 'gas_safety' }), classified({ doc_type: 'eicr' })],
      error: null,
    });

    expect((await loadAttachmentTypes('tx-1')).get('48')).toBe('Electrical installation condition report');
  });

  it('should not name a document read without confidence, as other, or not at all', async () => {
    for (const row of [classified({ confidence: '0.4' }), classified({ doc_type: 'other' }), classified({ unreadable: true })]) {
      mockClassifications.mockResolvedValue({ data: [row], error: null });
      expect((await loadAttachmentTypes('tx-1')).has('48')).toBe(false);
    }
  });

  it('should resolve to no names when either source fails', async () => {
    mockClassifications.mockResolvedValue({ data: null, error: { message: 'denied' } });
    expect((await loadAttachmentTypes('tx-1')).size).toBe(0);

    mockClassifications.mockResolvedValue({ data: [classified()], error: null });
    mockGetDocuments.mockRejectedValue(new Error('canister down'));
    expect((await loadAttachmentTypes('tx-1')).size).toBe(0);
  });
});
