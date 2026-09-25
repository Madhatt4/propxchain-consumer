// PropXchain - Open Source Blockchain Property Conveyancing Platform
// Copyright (C) 2026 PropXchain Contributors
// SPDX-License-Identifier: Proprietary

/**
 * Redaction for the public pack view (decision: Madhatt4/Propxchain#116).
 *
 * The share link shows a stranger the property's information, never the
 * people's: TA6 section 1 loses the seller parties, any company seller
 * (its director is a person), and the solicitor's personal contact — the
 * firm's identity stays, because "which conveyancer acts" is legitimate
 * pack content. Completion/modification principals are stripped from both
 * forms. Everything else — the question answers — passes through untouched.
 *
 * Both functions return deep copies; inputs are never mutated.
 */
import type { TA6PropertyInformation } from '@/types/ta6.types';
import type { TA10FittingsAndContents } from '@/types/ta10.types';

/** Keys that carry an identity principal on form records. */
const PRINCIPAL_KEYS = ['completedBy', 'lastModifiedBy'] as const;

function deepCopy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function stripPrincipals(record: Record<string, unknown>): void {
  for (const key of PRINCIPAL_KEYS) {
    if (key in record) record[key] = null;
  }
}

export function redactTa6ForSharing(ta6: TA6PropertyInformation): TA6PropertyInformation {
  const out = deepCopy(ta6);
  out.section1 = {
    ...out.section1,
    sellers: [],
    sellerCompany: null,
    solicitor: {
      ...out.section1.solicitor,
      contactName: '',
      email: null,
      phone: null,
    },
  };
  stripPrincipals(out as unknown as Record<string, unknown>);
  return out;
}

export function redactTa10ForSharing(ta10: TA10FittingsAndContents): TA10FittingsAndContents {
  const out = deepCopy(ta10);
  stripPrincipals(out as unknown as Record<string, unknown>);
  return out;
}
