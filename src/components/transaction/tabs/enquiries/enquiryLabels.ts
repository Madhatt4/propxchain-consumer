// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Human labels for the closed vocabularies. Pure.
 */
import type { EnquiryCategory, EnquiryStatus, EvidenceKind } from '@/services/enquiries.service';

const CATEGORY: Record<EnquiryCategory, string> = {
  ta6_boundaries: 'Boundaries', ta6_disputes: 'Disputes & complaints', ta6_notices: 'Notices & proposals',
  ta6_alterations: 'Alterations, planning & building control', ta6_guarantees: 'Guarantees & warranties',
  ta6_insurance: 'Insurance', ta6_environmental: 'Environmental matters', ta6_rights: 'Rights & informal arrangements',
  ta6_services: 'Services', ta6_connections: 'Utilities & connections', ta6_occupiers: 'Occupiers',
  ta6_transaction: 'Transaction information', title: 'Title', searches: 'Searches', survey: 'Survey',
  leasehold: 'Leasehold', other: 'Other',
};
const STATUS: Record<EnquiryStatus, string> = {
  draft: 'Draft', raised: 'Awaiting answer', answered: 'Answered', closed: 'Closed', withdrawn: 'Withdrawn',
};
const KIND: Record<EvidenceKind, string> = {
  ta6: 'TA6', ta7: 'TA7', ta10: 'TA10', hmlr_scan: 'Title scan', search_scan: 'Search scan',
  survey_scan: 'Survey scan', document: 'Document', intel: 'Property intel',
};

export function categoryLabel(c: EnquiryCategory): string { return CATEGORY[c] ?? c; }
export function statusLabel(s: EnquiryStatus): string { return STATUS[s] ?? s; }
export function kindLabel(k: EvidenceKind): string { return KIND[k] ?? k; }
export type StatusTone = 'raised' | 'answered' | 'closed' | 'muted';
export function statusTone(s: EnquiryStatus): StatusTone {
  if (s === 'raised') return 'raised';
  if (s === 'answered') return 'answered';
  if (s === 'closed') return 'closed';
  return 'muted';
}
export const STATUS_CLASS: Record<StatusTone, string> = {
  raised: 'bg-amber-100 text-amber-900',
  answered: 'bg-emerald-100 text-emerald-900',
  closed: 'bg-slate-200 text-slate-800',
  muted: 'bg-slate-100 text-slate-600',
};
