// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Type declarations for propertyCheckData.mjs (plain ESM shared with the Node
 * prerender script — see the header comment in propertyCheckData.mjs).
 */

export interface PropertyCheckCover {
  readonly label: string;
  readonly body: string;
}

export interface PropertyCheckSection {
  readonly id: string;
  readonly heading: string;
  readonly paragraphs: readonly string[];
}

export interface PropertyCheckFaq {
  readonly q: string;
  readonly a: string;
}

export interface PropertyCheckFaqJsonLd {
  readonly '@context': 'https://schema.org';
  readonly '@type': 'FAQPage';
  readonly mainEntity: ReadonlyArray<{
    readonly '@type': 'Question';
    readonly name: string;
    readonly acceptedAnswer: { readonly '@type': 'Answer'; readonly text: string };
  }>;
}

export declare const PROPERTY_CHECK_META: { readonly title: string; readonly description: string };
export declare const PROPERTY_CHECK_HERO: { readonly h1: string; readonly intro: string };
export declare const PROPERTY_CHECK_COVERS: readonly PropertyCheckCover[];
export declare const PROPERTY_CHECK_SECTIONS: readonly PropertyCheckSection[];
export declare const PROPERTY_CHECK_FAQS: readonly PropertyCheckFaq[];
export declare function buildPropertyCheckFaqJsonLd(): PropertyCheckFaqJsonLd;
