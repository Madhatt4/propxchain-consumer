// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Select options shared by the Stage 1 form and the Sales pack's inline
 * "About your property" form, so the two can never offer different values.
 */
export const PROPERTY_TYPES = [
  'Detached', 'Semi-detached', 'Terraced', 'End-of-terrace', 'Flat',
  'Maisonette', 'Bungalow', 'Cottage', 'Other',
];

/** England uses A to H; Wales adds band I. */
export const COUNCIL_TAX_BANDS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
