// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/** Type declarations for categoryOverviews.mjs — see its header comment. */

export interface CategoryOverview {
  readonly metaDescription: string;
  readonly overview: readonly string[];
}

export declare const CATEGORY_OVERVIEWS: Readonly<Record<string, CategoryOverview>>;
