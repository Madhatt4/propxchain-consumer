// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/** Type declarations for ta6GuideData.mjs — see its header comment. */

export interface Ta6SectionSummary {
  readonly n: number;
  readonly title: string;
  readonly asks: string;
  readonly ready: string;
}

export declare const LAW_SOCIETY_TA6_URL: string;
export declare const REMOVED_SECTIONS: readonly string[];
export declare const TA6_SECTIONS: readonly Ta6SectionSummary[];
