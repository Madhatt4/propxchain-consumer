// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Type declarations for faqData.mjs (plain ESM shared with the Node
 * prerender script — see the header comment in faqData.mjs).
 */

export interface FaqItem {
  readonly q: string;
  readonly a: string;
}

export interface FaqGroup {
  readonly id: string;
  readonly title: string;
  readonly items: readonly FaqItem[];
}

export interface FaqQuestionJsonLd {
  readonly '@type': 'Question';
  readonly name: string;
  readonly acceptedAnswer: {
    readonly '@type': 'Answer';
    readonly text: string;
  };
}

export interface FaqPageJsonLd {
  readonly '@context': 'https://schema.org';
  readonly '@type': 'FAQPage';
  readonly mainEntity: readonly FaqQuestionJsonLd[];
}

export declare const FAQ_GROUPS: readonly FaqGroup[];

export declare function buildFaqJsonLd(): FaqPageJsonLd;
