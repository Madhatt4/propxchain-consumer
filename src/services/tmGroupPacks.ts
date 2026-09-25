// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * tmGroup's six pack configurations, as quoted by tmGroup on 2026-08-26.
 *
 * WHY THERE ARE NO PRICES HERE. tmGroup's sheet carries a net price per pack.
 * None of them are in this file and none of them reach the card. Two reasons,
 * and either alone is sufficient:
 *
 *   1. The card already prices tmGroup LIVE, per property, from a Draft — see
 *      useTmGroupCatalogueQuote. A hardcoded pack price would be a second
 *      source of truth for the same number, and the live one is the one the
 *      customer is actually charged.
 *   2. The sheet's net price is not confirmed as either a trade cost or a
 *      suggested retail, so it is not safe to compute against.
 *
 * Supplier prices never belong in this file: it ships in the public JavaScript
 * bundle.
 */

import { tmGroupProvider } from './searchProviderData';

export interface TmGroupPack {
  id: string;
  name: string;
  family: 'regulated' | 'official';
  tagline: string;
  /**
   * Product codes exactly as tmGroup wrote them on 2026-08-26. Kept verbatim so
   * the source document and this file can be diffed by eye.
   */
  quotedCodes: string[];
  /**
   * True when the quoted price excludes the Local Authority and water authority
   * fees. Official searches are sourced from the council and the water company,
   * so the pack price is a fraction of what the mover pays: LA runs £100–£300
   * by council and water £17–£98 (tmGroup, 2026-07-23).
   *
   * The live quote returns these as `nonVatablePence` disbursements, so the
   * card's total IS complete — but the pack must still say so, because the
   * headline pack price a customer may have seen elsewhere does not.
   */
  excludesAuthorityFees: boolean;
}

/**
 * tmGroup's codes that our verified catalogue carries under a different code.
 *
 * The catalogue was read from tmGroup's live AvailableProducts API on
 * 2026-08-09 (demo20, Residential/Purchase, 98 products). tmGroup abbreviated two
 * of the official-search codes in prose; these are the same products under the
 * codes the API actually accepts.
 *
 * INFERRED, not confirmed by tmGroup. Both entries map an abbreviation onto the
 * fuller code for the same named product, and ordering uses the catalogue code —
 * so a wrong guess here shows up as the wrong product NAME on the card before it
 * ever reaches an order. Confirm with tmGroup all the same.
 */
const CODE_ALIASES: Record<string, string> = {
  LLC1: 'TMGLLC1',
  Con29: 'TMGCon29',
  // tmGroup's chancel line reads "CDSCH500KR / FTResCR (Chancel Repair Policy
  // (Successor in Title))". FTResCR is the ProductType the API actually returns
  // (AvailableProducts line 208, confirmed by Halif 2026-08-28); CDSCH500KR
  // appears to be her pack reference rather than an orderable code. Sent to Halif
  // for confirmation alongside the two above.
  CDSCH500KR: 'FTResCR',
};

export const tmGroupPacks: TmGroupPack[] = [
  {
    id: 'tmg-regulated-homebuyers',
    name: 'Regulated — Homebuyers',
    family: 'regulated',
    tagline: 'Fixed price. Regulated local and water searches with a Groundsure Homebuyers environmental.',
    quotedCodes: ['PSReport12', 'CDSRegWDR', 'GSEnviro'],
    excludesAuthorityFees: false,
  },
  {
    id: 'tmg-regulated-avista',
    name: 'Regulated — Avista',
    family: 'regulated',
    tagline: 'Fixed price. Adds Groundsure Avista: coal, ground, flood, planning and climate.',
    quotedCodes: ['PSReport12', 'CDSRegWDR', 'GSAvistaR'],
    excludesAuthorityFees: false,
  },
  {
    id: 'tmg-regulated-avista-chancel',
    name: 'Regulated — Avista + Chancel',
    family: 'regulated',
    tagline: 'Fixed price. Avista plus a £500k chancel repair policy (successor in title).',
    quotedCodes: ['PSReport12', 'CDSRegWDR', 'GSAvistaR', 'CDSCH500KR'],
    excludesAuthorityFees: false,
  },
  {
    id: 'tmg-official-homebuyers',
    name: 'Official — Homebuyers',
    family: 'official',
    tagline: 'Council-sourced local search, for lenders that will not accept a regulated one.',
    quotedCodes: ['LLC1', 'Con29', 'Con29DW', 'GSEnviro'],
    excludesAuthorityFees: true,
  },
  {
    id: 'tmg-official-avista',
    name: 'Official — Avista',
    family: 'official',
    tagline: 'Council-sourced local search with Groundsure Avista.',
    quotedCodes: ['LLC1', 'Con29', 'Con29DW', 'GSAvistaR'],
    excludesAuthorityFees: true,
  },
  {
    id: 'tmg-official-avista-chancel',
    name: 'Official — Avista + Chancel',
    family: 'official',
    tagline: 'Council-sourced local search, Avista, and a £500k chancel repair policy.',
    quotedCodes: ['LLC1', 'Con29', 'Con29DW', 'GSAvistaR', 'CDSCH500KR'],
    excludesAuthorityFees: true,
  },
];

/** Every product code the verified tmGroup catalogue can actually order. */
function catalogueCodes(): Set<string> {
  return new Set(
    [...tmGroupProvider.standardPackSearches, ...tmGroupProvider.additionalSearches]
      .map((item) => item.productType)
      .filter((code): code is string => Boolean(code)),
  );
}

export interface ResolvedTmGroupPack extends TmGroupPack {
  /** Catalogue `SearchItem.id`s this pack selects. Empty when unavailable. */
  itemIds: string[];
  /** Catalogue product codes this pack orders with. Empty when unavailable. */
  orderCodes: string[];
  /**
   * Quoted codes with no catalogue entry. Non-empty means the pack cannot be
   * offered: we would be selling a basket we cannot price or order.
   */
  missingCodes: string[];
  isAvailable: boolean;
}

/**
 * Resolve one pack against the verified catalogue.
 *
 * Fails closed on purpose. A pack with an unknown code is returned unavailable
 * with the offending codes named, rather than silently dropping the line — a
 * quietly shortened basket is a customer paying for fewer searches than the pack
 * they chose says they are getting.
 */
export function resolveTmGroupPack(pack: TmGroupPack): ResolvedTmGroupPack {
  const known = catalogueCodes();
  const items = [...tmGroupProvider.standardPackSearches, ...tmGroupProvider.additionalSearches];

  const missingCodes: string[] = [];
  const orderCodes: string[] = [];
  const itemIds: string[] = [];

  pack.quotedCodes.forEach((quoted) => {
    const code = CODE_ALIASES[quoted] ?? quoted;
    if (!known.has(code)) {
      missingCodes.push(quoted);
      return;
    }
    orderCodes.push(code);
    const item = items.find((entry) => entry.productType === code);
    if (item) itemIds.push(item.id);
  });

  const isAvailable = missingCodes.length === 0;

  return {
    ...pack,
    itemIds: isAvailable ? itemIds : [],
    orderCodes: isAvailable ? orderCodes : [],
    missingCodes,
    isAvailable,
  };
}

export function resolveTmGroupPacks(): ResolvedTmGroupPack[] {
  return tmGroupPacks.map(resolveTmGroupPack);
}

/**
 * Every code tmGroup quoted that our catalogue cannot order.
 *
 * This is the list to put in front of tmGroup. As of 2026-09-01 it is EMPTY:
 * every code tmGroup quoted resolves, and all six packs are offerable.
 *
 * It was three, then one, then none — and not one of the three was a product
 * tmGroup does not sell. CDSRegWDR was simply not activated on our DEMO20
 * account; tmGroup had corporate ops enable the pack codes on 2026-09-01
 * and a re-pull the same day returned 100 products where the first read
 * returned 98.
 *
 * The other two failed differently. GSAvistaR and CDSCH500KR/FTResCR were
 * reported missing on 2026-08-26 after checking this repo's 11-item curated list
 * rather than tmGroup's 98-product response — both were in that response all
 * along, at lines 214 and 208. Halif Saddiquin corrected it on 2026-08-28 with a
 * screenshot of our own 2026-08-09 call.
 *
 * The lesson is in this function's own name: it reports what OUR catalogue
 * cannot order, which is a different question from what tmGroup does not sell.
 * Do not quote it to a supplier as the second thing.
 */
export function missingTmGroupCodes(): string[] {
  return [...new Set(resolveTmGroupPacks().flatMap((pack) => pack.missingCodes))];
}
