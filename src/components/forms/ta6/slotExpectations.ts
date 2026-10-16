// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import type { SlotExpectation } from '../../../services/docClassify.service';

/**
 * What each TA6 attachment question asks for, by the slot's refCode, so the
 * scan can say when a document looks like it belongs to another question
 * (an EICR attached to 11.4 heating, 16 Oct 2026). `docTypes` are the
 * doc-classify types that answer the question. Paperwork with no type of its
 * own (a boiler service record, a radon report) classifies as `other` and is
 * never remarked on. Slots not listed get no such check: 5.2 has its own
 * consents scan, and the rest ask for paperwork the classifier has no type for.
 */
export const SLOT_EXPECTATIONS: Readonly<Record<string, SlotExpectation>> = {
  '8.3a': { docTypes: ['environmental_search', 'survey'], asksFor: 'the radon test report' },
  '8.7': {
    docTypes: ['survey', 'environmental_search'],
    asksFor: 'the Japanese knotweed management plan or survey report',
  },
  '10.3.consent': {
    docTypes: ['planning_permission', 'building_regs_certificate', 'lease'],
    asksFor: 'the consent or approval for the electric vehicle charging point',
  },
  '11.2.doc': {
    docTypes: ['eicr', 'building_regs_certificate'],
    asksFor: 'the electrical certificates or compliance paperwork',
  },
  '11.3.doc': { docTypes: ['eicr'], asksFor: 'the most recent electrical inspection report (EICR)' },
  '11.4.doc': {
    docTypes: ['gas_safety', 'building_regs_certificate'],
    asksFor: 'the heating installation certificate or the most recent service record',
  },
};
