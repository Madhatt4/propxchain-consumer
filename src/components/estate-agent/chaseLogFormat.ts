// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Shared formatting for the chase log and the chase list's due-date line.
 */
import type { ChaseKind } from '@/services/chaseLog.service';

export const KIND_LABELS: Record<ChaseKind, string> = {
  call: 'Call',
  note: 'Note',
  next_action: 'Next action',
};

export function formatDueDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function formatEntryTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
