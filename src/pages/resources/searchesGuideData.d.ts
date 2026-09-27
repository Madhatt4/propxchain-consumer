// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/** Type declarations for searchesGuideData.mjs — see its header comment. */

export interface SearchSummary {
  readonly name: string;
  readonly tells: string;
  readonly when: string;
  readonly speed: string;
}

export declare const HMLR_ANNUAL_REPORT_URL: string;
export declare const LLC_MIGRATION: Readonly<{ migrated: number; total: number; targetYear: string }>;
export declare const SEARCHES_AT_A_GLANCE: readonly SearchSummary[];
export declare const CORE_PACK_FROM: string;
