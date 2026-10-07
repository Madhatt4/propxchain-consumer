// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The 5.2 paperwork row: its default, its candid mapping both ways, the
 * doc-classify prefill table and the PDF label. Pure functions, no mocks.
 */
import { describe, it, expect } from 'vitest';

import { emptyAlterationDocument, TA6_FORM_VERSION } from '@/types/ta6.defaults';
import { ALTERATION_KIND_FROM_DOC_TYPE } from '@/types/ta6.alterationDocument';
import {
  fromCandidAlterationDocument,
  toCandidAlterationDocument,
} from '@/services/ta6/ta6CandidPrimitives';
import { alterationDocsSummary } from '@/services/ta6PdfShared';
import type { TA6AlterationDocument } from '@/types/ta6.types';

describe('TA6 5.2 alteration document rows', () => {
  it('should default to a draft slot with no kind and no link', () => {
    expect(emptyAlterationDocument()).toEqual({
      kind: null,
      kindDetails: null,
      relatesTo: null,
      document: { status: 'not-answered', documentId: null },
    });
  });

  it('should mirror the canister form version that stamps the new shape', () => {
    expect(TA6_FORM_VERSION).toBe('v6_2026_10_06');
  });

  it('should round-trip a fully labelled row through candid', () => {
    const row: TA6AlterationDocument = {
      kind: 'competent-person-certificate',
      kindDetails: null,
      relatesTo: 'windows-post-2002',
      document: { status: 'attached', documentId: '12' },
    };

    const candid = toCandidAlterationDocument(row);

    expect(candid).toEqual({
      kind: [{ CompetentPersonCertificate: null }],
      kindDetails: [],
      relatesTo: [{ WindowsPost2002: null }],
      document: { Attached: 12n },
    });
    expect(fromCandidAlterationDocument(candid)).toEqual(row);
  });

  it('should round-trip a blank row and an other-with-details row through candid', () => {
    const blank = emptyAlterationDocument();
    const other: TA6AlterationDocument = {
      kind: 'other',
      kindDetails: 'Party wall award',
      relatesTo: 'other',
      document: { status: 'to-follow', documentId: null },
    };

    expect(fromCandidAlterationDocument(toCandidAlterationDocument(blank))).toEqual(blank);
    expect(fromCandidAlterationDocument(toCandidAlterationDocument(other))).toEqual(other);
  });

  it('should map only the doc-classify answers that are 5.2 paperwork onto a kind', () => {
    expect(ALTERATION_KIND_FROM_DOC_TYPE.planning_permission).toBe('planning-permission');
    expect(ALTERATION_KIND_FROM_DOC_TYPE.building_regs_certificate).toBe('building-regs-completion');
    expect(ALTERATION_KIND_FROM_DOC_TYPE.fensa).toBe('competent-person-certificate');
    expect(ALTERATION_KIND_FROM_DOC_TYPE.epc).toBeUndefined();
    expect(ALTERATION_KIND_FROM_DOC_TYPE.other).toBeUndefined();
  });

  it('should summarise rows for the PDF with their kind, link and slot', () => {
    const rows: TA6AlterationDocument[] = [
      { kind: 'planning-permission', kindDetails: null, relatesTo: 'extension', document: { status: 'attached', documentId: '12' } },
      { kind: 'other', kindDetails: 'Party wall award', relatesTo: null, document: { status: 'to-follow', documentId: null } },
      emptyAlterationDocument(),
    ];

    expect(alterationDocsSummary(rows)).toBe(
      'Planning permission for the extension: attached (doc #12); Other paperwork (Party wall award): to follow; Paperwork (kind not stated): not answered',
    );
    expect(alterationDocsSummary([])).toBe('none');
  });
});
