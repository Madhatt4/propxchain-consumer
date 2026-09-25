// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * formCheck.service — the consumer side of "Check my answers", a seller's
 * pre-submit read of their own TA6 or TA10. Wraps the monorepo-owned
 * `form-check` edge function (not one of this repo's own
 * `supabase/functions/`).
 *
 * The check is ADVISORY. It never blocks a submission, it never writes to the
 * chain, and it decides nothing about disclosure: the seller's conveyancer
 * does. The function reads the saved form off chain itself, so the client
 * sends only the transaction id and which form to read — never the answers,
 * and never any personal data.
 *
 * Two kinds of finding come back and they are not interchangeable:
 * `deterministic` are facts settled in code (a Yes with no detail, a missing
 * document) and carry no probability; `flags` are model judgements and each
 * carries one. The UI must keep them apart — see CheckMyAnswersPanel.
 *
 * Non-2xx becomes `FormCheckError` with the HTTP status and the body's
 * `error` code, the same technique as conveyancerBrief.service /
 * enquiries.service. The UI branches on 403 (not the seller's side), 404
 * (`form_not_found` — nothing saved to check yet), 429 (`rate_limited`,
 * `resetIn` seconds) and 503 (`server misconfigured` — feature off).
 */
import { supabase } from '../lib/supabase';

const FUNCTION_NAME = 'form-check';

/** Only TA6 and TA10 are checkable. TA7 has no check. */
export type FormCheckForm = 'ta6' | 'ta10';

/**
 * `block` is reserved server-side for a defect in the form itself (a
 * contradiction, a hidden dispute, a missing consent). It is still advice:
 * nothing in this repo may disable a submission because of it.
 */
export type FormCheckSeverity = 'info' | 'warn' | 'block';

/** A model judgement. `probability` is 0..1 and must always be shown with it. */
export interface FormCheckFlag {
  key: string;
  label: string;
  probability: number;
  /** `section5` or `section5_alterations` — absent on every TA10 flag. */
  section?: string;
  severity: FormCheckSeverity;
}

/** A fact settled in code. Never carries a probability — do not invent one. */
export interface FormCheckFinding {
  key: string;
  label: string;
  section?: string;
}

/** The `form-check` 200 body, mirrored from the function's own result type. */
export interface FormCheckResult {
  form: FormCheckForm;
  /** 0..1. */
  readyToSubmit: number;
  /** 0..FORM_CHECK_FOLLOW_UP_MAX, a float on the form's four-rung rubric. */
  followUpScore: number;
  /** A TA6 section name, or null when nothing stands out. Always null for TA10. */
  worstSection: string | null;
  flags: FormCheckFlag[];
  deterministic: FormCheckFinding[];
  model: string;
  checkedAt: string;
}

/** Both rubrics have four rungs, so the score runs 0..3. */
export const FORM_CHECK_FOLLOW_UP_MAX = 3;

/** `model` when the deterministic rules answered alone and no model was asked. */
export const FORM_CHECK_NO_MODEL = 'deterministic-only';

export class FormCheckError extends Error {
  readonly status: number;
  readonly code: string;
  readonly resetIn?: number;

  constructor(status: number, code: string, resetIn?: number) {
    super(code);
    this.name = 'FormCheckError';
    this.status = status;
    this.code = code;
    this.resetIn = resetIn;
  }
}

interface FunctionsInvokeError {
  message: string;
  context?: { status?: number; json?: () => Promise<Record<string, unknown>> };
}

/**
 * supabase-js throws a FunctionsHttpError on any non-2xx, whose `.context` is
 * the raw Response. Status 0 and the transport message are the fallback when
 * there is no response at all (a pure network failure) or the body is not the
 * JSON the contract promises.
 */
async function toFormCheckError(error: FunctionsInvokeError): Promise<FormCheckError> {
  const status = error.context?.status ?? 0;
  try {
    const body = (await error.context?.json?.()) as { error?: string; resetIn?: number } | undefined;
    const code = typeof body?.error === 'string' ? body.error : error.message;
    return new FormCheckError(status, code, body?.resetIn);
  } catch {
    return new FormCheckError(status, error.message);
  }
}

/**
 * Run the check on one saved form. Resolves with the advice; rejects with a
 * `FormCheckError` on anything else. The seller's session JWT rides along on
 * the invoke — the function admits the seller's side of the transaction only.
 */
export async function checkForm(transactionId: string, form: FormCheckForm): Promise<FormCheckResult> {
  const { data, error } = await supabase.functions.invoke<FormCheckResult>(FUNCTION_NAME, {
    body: { transactionId, form },
  });
  if (error) throw await toFormCheckError(error as FunctionsInvokeError);
  if (!data) throw new FormCheckError(0, 'empty_response');
  return data;
}
