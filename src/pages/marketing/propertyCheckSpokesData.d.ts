// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Type declarations for propertyCheckSpokesData.mjs (plain ESM shared with
 * the Node prerender script — see its header comment).
 */

import type { PropertyCheckFaq, PropertyCheckFaqJsonLd, PropertyCheckSection } from './propertyCheckData';

export interface PropertyCheckSpoke {
  /** Route without the leading slash, as the prerender script keys it. */
  readonly route: string;
  readonly meta: { readonly title: string; readonly description: string };
  readonly h1: string;
  readonly intro: string;
  readonly sections: readonly PropertyCheckSection[];
  readonly faqs: readonly PropertyCheckFaq[];
}

export declare const FLOOD_RISK_SPOKE: PropertyCheckSpoke;
export declare const HERITAGE_SPOKE: PropertyCheckSpoke;
export declare const PROPERTY_CHECK_SPOKES: readonly PropertyCheckSpoke[];
export declare function buildSpokeFaqJsonLd(spoke: PropertyCheckSpoke): PropertyCheckFaqJsonLd;
