// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * enquiries.service — the consumer side of structured pre-contract enquiries.
 * Wraps the monorepo-owned `enquiries` (write path) and `enquiry-check`
 * (fact check) edge functions and reads the four tables under RLS. Decides
 * nothing about permissions: the server does. `myPartyOn` only tells the UI
 * which controls to show. Every non-2xx becomes `EnquiryError` with the HTTP
 * status and the body's `error` code (same technique as conveyancerBrief.service).
 */
import { supabase } from '../lib/supabase';
import type { DealSide, PartyRole } from './shareParty.service';

export const ENQUIRY_CATEGORIES = [
  'ta6_boundaries', 'ta6_disputes', 'ta6_notices', 'ta6_alterations', 'ta6_guarantees',
  'ta6_insurance', 'ta6_environmental', 'ta6_rights', 'ta6_services', 'ta6_connections',
  'ta6_occupiers', 'ta6_transaction', 'title', 'searches', 'survey', 'leasehold', 'other',
] as const;
export type EnquiryCategory = (typeof ENQUIRY_CATEGORIES)[number];
export const EVIDENCE_KINDS = ['ta6', 'ta7', 'ta10', 'hmlr_scan', 'search_scan', 'survey_scan', 'document', 'intel'] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];
export type EnquiryStatus = 'draft' | 'raised' | 'answered' | 'closed' | 'withdrawn';

export interface Evidence { kind: EvidenceKind; ref: string; label: string }
export interface Enquiry {
  id: string; transaction_id: string; parent_id: string | null; category: EnquiryCategory;
  raised_by_user_id: string; raised_by_side: DealSide; question: string; question_hash: string;
  status: EnquiryStatus; transcribed: boolean; source_document_id: string | null; ledger_pending: boolean;
  created_at: string; raised_at: string | null; answered_at: string | null; closed_at: string | null; updated_at: string;
}
export interface EnquiryAnswer { id: string; enquiry_id: string; answer: string; answer_hash: string; evidence: Evidence[]; released_at: string }
export interface EnquiryNote {
  id: string; enquiry_id: string; side: DealSide; body: string; evidence: Evidence[]; created_at: string;
  /** Agent CRM: a note the client's agent drafted waits for the client's tap before the conveyancer sees it. */
  pending_confirmation: boolean; drafted_for_user_id: string | null; confirmed_at: string | null;
}
/** The plain-English line under an enquiry (agent CRM spec I1), written once by the platform. */
export interface EnquiryExplanation { enquiry_id: string; plain_english: string; model: string; created_at: string }
export interface CheckCovered { kind: EvidenceKind; ref: string; label: string; quote: string }
export interface CheckConflict extends CheckCovered { premise: string }
export interface CheckMissing { docType: string; label: string }
export interface CheckResult { covered: CheckCovered[]; conflicts: CheckConflict[]; missing: CheckMissing[] }
export interface EnquiryCheck {
  id: string; transaction_id: string; enquiry_id: string | null; for_side: DealSide; category: EnquiryCategory;
  question_hash: string; model: string; result: CheckResult; computed_at: string;
}
export interface EnquiryDraft { category: EnquiryCategory; question: string }
export interface MyParty { role: PartyRole; side: DealSide | null }

export class EnquiryError extends Error {
  readonly status: number;
  readonly code: string;
  readonly reason?: string;
  readonly resetIn?: number;
  constructor(status: number, code: string, reason?: string, resetIn?: number) {
    super(code);
    this.name = 'EnquiryError';
    this.status = status;
    this.code = code;
    this.reason = reason;
    this.resetIn = resetIn;
  }
}

interface FunctionsInvokeError {
  message: string;
  context?: { status?: number; json?: () => Promise<Record<string, unknown>> };
}
async function toEnquiryError(error: FunctionsInvokeError): Promise<EnquiryError> {
  const status = error.context?.status ?? 0;
  try {
    const body = (await error.context?.json?.()) as { error?: string; reason?: string; resetIn?: number } | undefined;
    return new EnquiryError(status, typeof body?.error === 'string' ? body.error : error.message, body?.reason, body?.resetIn);
  } catch {
    return new EnquiryError(status, error.message);
  }
}
async function invoke<T>(fn: 'enquiries' | 'enquiry-check', body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(fn, { body });
  if (error) throw await toEnquiryError(error as FunctionsInvokeError);
  return data as T;
}

// ---- writes (the enquiries function) --------------------------------------
export interface RaiseInput { transactionId: string; category: EnquiryCategory; question: string; parentId?: string; transcribed?: boolean; sourceDocumentId?: string }
export async function raiseEnquiry(input: RaiseInput): Promise<Enquiry> {
  const r = await invoke<{ enquiry: Enquiry }>('enquiries', { action: 'raise', ...input });
  return r.enquiry;
}
export async function answerEnquiry(input: { enquiryId: string; answer: string; evidence: Evidence[] }): Promise<Enquiry> {
  return (await invoke<{ enquiry: Enquiry }>('enquiries', { action: 'answer', ...input })).enquiry;
}
export async function closeEnquiry(enquiryId: string): Promise<Enquiry> {
  return (await invoke<{ enquiry: Enquiry }>('enquiries', { action: 'close', enquiryId })).enquiry;
}
export async function withdrawEnquiry(enquiryId: string): Promise<Enquiry> {
  return (await invoke<{ enquiry: Enquiry }>('enquiries', { action: 'withdraw', enquiryId })).enquiry;
}
export async function addEnquiryNote(input: { enquiryId: string; body: string; evidence?: Evidence[] }): Promise<EnquiryNote> {
  return (await invoke<{ note: EnquiryNote }>('enquiries', { action: 'note', ...input })).note;
}
/** The client makes their agent's draft note their own; only then does their conveyancer see it. */
export async function confirmEnquiryNote(noteId: string): Promise<EnquiryNote> {
  return (await invoke<{ note: EnquiryNote }>('enquiries', { action: 'note_confirm', noteId })).note;
}
export interface TranscribeInput { transactionId: string; pdfBase64: string; filename?: string; sourceDocumentId?: string }
export async function transcribeEnquiries(input: TranscribeInput): Promise<{ drafts: EnquiryDraft[]; dropped: number; sourceDocumentId: string | null }> {
  return await invoke('enquiries', { action: 'transcribe', ...input });
}

// ---- the check (the enquiry-check function) --------------------------------
export type CheckInput = { enquiryId: string } | { transactionId: string; category: EnquiryCategory; question: string };
export async function checkEnquiry(input: CheckInput): Promise<{ check: EnquiryCheck; reused: boolean; dropped: number }> {
  return await invoke('enquiry-check', { ...input });
}

// ---- reads under RLS -------------------------------------------------------
function readError(what: string, error: { message: string } | null): never {
  throw new EnquiryError(0, 'read_failed', `${what}: ${error?.message ?? 'unknown'}`);
}
export async function listEnquiries(transactionId: string): Promise<Enquiry[]> {
  const { data, error } = await supabase.from('enquiries').select('*').eq('transaction_id', transactionId).order('created_at', { ascending: true });
  if (error) readError('enquiries', error);
  return (data ?? []) as Enquiry[];
}
export async function getEnquiryAnswer(enquiryId: string): Promise<EnquiryAnswer | null> {
  const { data, error } = await supabase.from('enquiry_answers').select('*').eq('enquiry_id', enquiryId).maybeSingle();
  if (error) readError('enquiry_answers', error);
  return (data as EnquiryAnswer | null) ?? null;
}
export async function listEnquiryNotes(enquiryId: string): Promise<EnquiryNote[]> {
  const { data, error } = await supabase.from('enquiry_notes').select('*').eq('enquiry_id', enquiryId).order('created_at', { ascending: true });
  if (error) readError('enquiry_notes', error);
  return (data ?? []) as EnquiryNote[];
}
export async function listEnquiryChecks(enquiryId: string): Promise<EnquiryCheck[]> {
  const { data, error } = await supabase.from('enquiry_checks').select('*').eq('enquiry_id', enquiryId).order('computed_at', { ascending: false });
  if (error) readError('enquiry_checks', error);
  return (data ?? []) as EnquiryCheck[];
}
export async function getEnquiryExplanation(enquiryId: string): Promise<EnquiryExplanation | null> {
  const { data, error } = await supabase.from('enquiry_explanations').select('*').eq('enquiry_id', enquiryId).maybeSingle();
  if (error) readError('enquiry_explanations', error);
  return (data as EnquiryExplanation | null) ?? null;
}
/** Asks the platform for the line when the cache has none (older enquiries); generated once, then cached. */
export async function explainEnquiry(enquiryId: string): Promise<{ plain_english: string; model: string }> {
  const res = await invoke<{ explanation: { plain_english: string; model: string } }>('enquiries', { action: 'explain', enquiryId });
  return res.explanation;
}

/**
 * The signed-in user's party on this deal, resolved server-side by
 * `enquiry_party()`: a conveyancer is the panel row with an accepted quote on
 * the deal (conveyancers never hold a party-role row), everyone else is their
 * party-role row. Null when not a party or not signed in.
 */
export async function myPartyOn(transactionId: string): Promise<MyParty | null> {
  // Signed out is 'nobody', not an error — the tab renders the not-a-party state.
  const { data: auth } = await supabase.auth.getSession();
  if (!auth.session) return null;
  const { data, error } = await supabase.rpc('enquiry_party', { p_transaction_id: transactionId });
  if (error) throw new Error(`Failed to resolve your role on this transaction: ${error.message}`);
  const row = Array.isArray(data) ? (data[0] as { role: PartyRole; side: DealSide | null } | undefined) : undefined;
  return row ? { role: row.role, side: row.side } : null;
}

/** Base64 body of a File without the data-URL prefix, for the transcribe action. */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.onload = () => {
      const s = String(reader.result ?? '');
      resolve(s.includes(',') ? s.slice(s.indexOf(',') + 1) : s);
    };
    reader.readAsDataURL(file);
  });
}
export const MAX_PDF_BYTES = 9 * 1024 * 1024;
