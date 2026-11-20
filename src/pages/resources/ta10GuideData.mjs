// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Content for /resources/selling/ta10-form-explained that appears in both the
 * React page and its static prerender, so the two cannot drift apart.
 *
 * Plain ESM (.mjs) on purpose: imported by the React page via Vite and by
 * scripts/prerender-resources.mjs under Node. Types live in ta10GuideData.d.ts.
 *
 * Edition facts are from the Law Society's transaction forms page (read
 * 2026-11-20): "TA10 Fittings and contents form (3rd edition) (2013)", for the
 * seller "to identify what's included and excluded from the sale price",
 * likely needed "for every sale and purchase", and not available to the
 * public. On 30 March 2026 only the TA6 and TA7 were replaced; the TA10 was
 * not. No Law Society form wording is reproduced here.
 */

export const LAW_SOCIETY_TA_FORMS_URL = 'https://www.lawsociety.org.uk/topics/property/transaction-forms/';

export const TA10_EDITION = Object.freeze({ edition: '3rd edition', year: 2013 });

/** The items that most often cause a dispute, and how to head it off. */
export const TA10_FLASHPOINTS = Object.freeze([
  { item: 'Light fittings', why: 'Buyers expect working lights in every room on completion day.', tip: 'If you are taking a pendant or chandelier, say so, and say whether you will leave a plain fitting and a bulb in its place.' },
  { item: 'Curtains, blinds and poles', why: 'Made-to-measure curtains and blinds look like part of the house.', tip: 'Mark poles, rails and blinds separately from the curtains themselves.' },
  { item: 'Fitted wardrobes and shelving', why: 'Anything screwed to a wall reads as staying.', tip: 'Mark fitted furniture included unless you really plan to remove it and make good the wall.' },
  { item: 'Kitchen appliances', why: 'Integrated appliances look built in; free-standing ones look optional.', tip: 'List each appliance by name. A buyer may be glad to pay for a fridge or washing machine rather than buy new.' },
  { item: 'Carpets and flooring', why: 'Buyers assume flooring stays unless told otherwise.', tip: 'Say so if a rug or a particular carpet is going with you.' },
  { item: 'Garden items', why: 'Sheds, greenhouses, plants and garden lighting are easy to forget.', tip: 'Walk the garden before you fill this in, including anything in pots you mean to take.' },
  { item: 'Aerials, dishes and alarms', why: 'Satellite dishes, TV aerials, alarms and smart thermostats are wired in.', tip: 'Include them, or say clearly that you are removing them and how the wiring will be left.' },
]);
