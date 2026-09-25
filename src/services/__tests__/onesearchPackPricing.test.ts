import { describe, it, expect } from 'vitest';
import { onesearchPacks } from '../searchProviderData';

/**
 * THE BUG CLASS THIS FILE EXISTS TO CATCH, which has already fired live: the
 * consumer builds a OneSearch basket from productType codes; the worker prices
 * it by matching a sorted, deduped signature of those codes against
 * ONESEARCH_PACK_PRICES_GBP. Nothing checked the two sides agreed, so a pack
 * the consumer could offer but the worker could not price returned 400
 * `unpriced_products` — at checkout, in front of a paying customer.
 *
 * THE MIRROR PROBLEM, stated openly. The worker lives in the monorepo
 * (onesearch-worker/index.js) and this repo cannot import from it, so the
 * signatures below are a copy. A copy nobody updates reproduces the very bug
 * it guards. Two things keep it honest:
 *
 * The mirror holds pack IDENTITY only — the code sets, never the prices. That
 * is deliberate: prices move often and would rot immediately, whereas a pack's
 * code set changes only on a product decision that has to be taken on both
 * sides anyway. It also keeps commercial terms out of a public repo.
 *
 * WHAT THIS CANNOT CATCH, stated plainly rather than papered over: drift in the
 * WORKER's direction. If the worker changes or drops a pack signature, nothing
 * here notices — this repo cannot import from the monorepo, so the mirror is
 * only ever as fresh as the last person to update it. The tests below prove
 * that every pack the consumer OFFERS is priceable according to the mirror;
 * they do not prove the mirror still matches the worker.
 *
 * Source of truth: onesearch-worker/index.js, ONESEARCH_PACK_PRICES_GBP.
 * Mirrored 2026-08-06. If you change a pack's codes, change it in both places.
 */
const WORKER_PRICED_SIGNATURES: Record<string, readonly string[]> = {
  standard: ['HOMECHECKPRO', 'LLC1CON29', 'ONESEARCHDW'],
  standard_refresh: ['HOMECHECKPRO', 'LLC1CON29', 'ONESEARCHDW', 'REFRESH'],
  premium_frv: ['LLC1CON29', 'LMKRVResi', 'ONESEARCHDW', 'REFRESH'],
};

/** The worker matches on a sorted, deduped join — mirror that exactly. */
function signature(codes: readonly string[]): string {
  return [...new Set(codes)].sort().join('|');
}

const workerSignatures = new Set(
  Object.values(WORKER_PRICED_SIGNATURES).map(signature),
);

function packSignature(pack: (typeof onesearchPacks)[number]): string {
  // productType is optional on SearchItem. Dropping a missing one is safe here
  // rather than masking it: the resulting signature simply will not match a
  // worker pack, so the first test fails and names the offending pack.
  const codes = pack.items
    .map((item) => item.productType)
    .filter((code): code is string => typeof code === 'string');
  return signature(codes);
}

describe('OneSearch pack codes vs the worker price table', () => {
  it('offers no pack the worker cannot price', () => {
    const unpriceable = onesearchPacks
      .filter((pack) => !workerSignatures.has(packSignature(pack)))
      .map((pack) => `${pack.id} [${packSignature(pack)}]`);

    // Case-exact on purpose: the worker's own comment warns that 'LMKRVResi'
    // cannot be upper-cased to match its siblings, because matching is a
    // sorted join over the raw strings.
    expect(unpriceable).toEqual([]);
  });

  it('does not withhold a pack the worker can already price', () => {
    // ENABLED 2026-08-06, once the last gate cleared. standard-refresh and
    // premium were held back in turn by the code, the fee and the copy; when
    // the first two lifted, nothing noticed, and both stayed switched off
    // behind a stated reason — "the worker has no pack entry" — that had
    // quietly stopped being true.
    //
    // That is the failure this guards: not a wrong price, but a sellable pack
    // sitting idle because the condition that gated it passed unobserved. It
    // currently passes trivially, since no pack is withheld — it earns its
    // keep the next time one is.
    const withheldButPriceable = onesearchPacks
      .filter((pack) => pack.orderCodesPending === true)
      .filter((pack) => workerSignatures.has(packSignature(pack)))
      .map((pack) => pack.id);

    expect(withheldButPriceable).toEqual([]);
  });
});
