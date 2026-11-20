// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/** Type declarations for ta10GuideData.mjs — see its header comment. */

export interface Ta10Flashpoint {
  readonly item: string;
  readonly why: string;
  readonly tip: string;
}

export declare const LAW_SOCIETY_TA_FORMS_URL: string;
export declare const TA10_EDITION: { readonly edition: string; readonly year: number };
export declare const TA10_FLASHPOINTS: readonly Ta10Flashpoint[];
