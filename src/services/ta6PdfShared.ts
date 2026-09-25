// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * TA6 6th-edition PDF layout — shared vocabulary, row builders and page
 * furniture. The per-section builders (ta6PdfSections.ts) compose these into
 * the 15-section record; formExportService renders the result.
 *
 * Row convention: TA6 rows are full-width lines (empty label) formatted as
 * "<ref> — <paraphrased prompt> — <answer>[ — <details>]". The prompt text is
 * looked up from the ADR-0009 paraphrase bundle by question ref.
 */

import { TA6_OFFICIAL_FORM_URL } from '../lib/ta6-prompts/types';

import type { PdfSection } from './pdfPrimitives';
import type { TA6PromptEntry } from '../lib/ta6-prompts/types';
import type {
  TA6AnswerValue,
  TA6DocumentStatus,
  TA6DocumentValue,
  TA6PropertyInformation,
  TA6ResponseValue,
} from '../types/ta6.types';

/** A full-width PDF row (empty label => rendered without a "label:" prefix). */
export type PdfRow = [label: string, value: string];

// Numbered section headings for the PDF record. The wording mirrors the
// stepper titles in components/forms/ta6/sectionMeta.ts (kept in step manually
// — a service module must not import a component-layer constant); the numeric
// prefix is added here because the record has no separate "Section N:" chrome.
export const TA6_SECTION_TITLES: readonly string[] = [
  '1. Property and seller details',
  '2. Boundaries',
  '3. Disputes and complaints',
  '4. Notices and proposals',
  '5. Alterations, planning and building control',
  '6. Guarantees and warranties',
  '7. Insurance',
  '8. Environmental matters',
  '9. Rights and informal arrangements',
  '10. Parking',
  '11. Services',
  '12. Connection to services',
  '13. Transaction information',
  '14. Completion and moving',
  '15. Additional information',
];

// ============================================
// Value labels
// ============================================

const ANSWER_LABELS: Record<TA6AnswerValue, string> = {
  yes: 'Yes',
  no: 'No',
  'not-known': 'Not known',
  'not-applicable': 'Not applicable',
  'not-answered': 'Not answered',
};

const DOCUMENT_LABELS: Record<Exclude<TA6DocumentStatus, 'attached'>, string> = {
  'to-follow': 'to follow',
  'not-applicable': 'not applicable',
  'not-available': 'not available',
  'not-answered': 'not answered',
};

export function answerLabel(a: TA6AnswerValue): string {
  return ANSWER_LABELS[a];
}

export function documentLabel(d: TA6DocumentValue): string {
  if (d.status === 'attached') {
    return d.documentId ? `attached (doc #${d.documentId})` : 'attached';
  }
  return DOCUMENT_LABELS[d.status];
}

/** Kebab / lower-case enum value -> sentence-case display text. */
export function humanizeKebab(v: string): string {
  const s = v.replace(/-/g, ' ');
  return s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1);
}

/** Pence integer -> "£X.XX", or '' when the amount is absent. */
export function formatPence(pence: number | null | undefined): string {
  if (pence === null || pence === undefined || !Number.isFinite(pence)) return '';
  return `£${(pence / 100).toFixed(2)}`;
}

/** Summarise a repeating document-slot list (e.g. §5.2 consents, §15.1). */
export function docsSummary(docs: TA6DocumentValue[]): string {
  if (docs.length === 0) return 'none';
  return docs.map((d) => documentLabel(d)).join('; ');
}

// ============================================
// Prompt lookup + row builders
// ============================================

/** Paraphrased prompt for a question ref; falls back to the ref if unmapped. */
export function promptOf(prompts: TA6PromptEntry[], ref: string): string {
  return prompts.find((p) => p.ref === ref)?.prompt ?? ref;
}

function line(ref: string, prompt: string, value: string): PdfRow {
  return ['', `${ref} — ${prompt} — ${value}`];
}

/** Row for a yes/no + free-text response, with an optional extra detail. */
export function respRow(
  prompts: TA6PromptEntry[],
  ref: string,
  r: TA6ResponseValue,
  extra: string = '',
): PdfRow {
  const detail = [r.details.trim(), extra.trim()].filter(Boolean).join(', ');
  const value = detail ? `${answerLabel(r.answer)} — ${detail}` : answerLabel(r.answer);
  return line(ref, promptOf(prompts, ref), value);
}

/** Row for a bare answer value, with an optional extra detail. */
export function ansRow(
  prompts: TA6PromptEntry[],
  ref: string,
  a: TA6AnswerValue,
  extra: string = '',
): PdfRow {
  const value = extra.trim() ? `${answerLabel(a)} — ${extra.trim()}` : answerLabel(a);
  return line(ref, promptOf(prompts, ref), value);
}

/** Row for a document slot (attached / to follow / not applicable / …). */
export function docRow(prompts: TA6PromptEntry[], ref: string, d: TA6DocumentValue): PdfRow {
  return line(ref, promptOf(prompts, ref), documentLabel(d));
}

/** Row for a free-text / factual field; '—' when empty. */
export function textRow(prompts: TA6PromptEntry[], ref: string, v: string | null | undefined): PdfRow {
  const value = v && v.trim() ? v.trim() : '—';
  return line(ref, promptOf(prompts, ref), value);
}

/** Free-form full-width row where the caller has already built the value. */
export function rawRow(prompts: TA6PromptEntry[], ref: string, value: string): PdfRow {
  return line(ref, promptOf(prompts, ref), value);
}

// ============================================
// Page furniture
// ============================================

/** Banner printed under the header linking the record to the official form. */
export function buildTA6Banner(form: TA6PropertyInformation): string {
  return (
    'Record of TA6 (6th edition) answers given via PropXchain. ' +
    `Official Law Society question text: ${TA6_OFFICIAL_FORM_URL}. ` +
    `Form version: ${form.formVersion}`
  );
}

/** Conveyancer sign-off block appended at the end of the record. */
export function ta6SignOffSection(): PdfSection {
  const blank = '__________________________';
  return {
    title: 'Conveyancer sign-off',
    rows: [
      ['Conveyancer name', blank],
      ['Firm', blank],
      ['Date', blank],
      ['Signature', blank],
    ],
  };
}
