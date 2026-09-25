// PropXchain - Open Source Blockchain Property Conveyancing Platform
// Copyright (C) 2026 PropXchain Contributors
// SPDX-License-Identifier: Proprietary

/**
 * Reads completed OneSearch (PISCES) results back out of Supabase and shapes
 * them for the AI search scan.
 *
 * OneSearch pushes results asynchronously to onesearch-worker's
 * `/webhook/results`, which persists the raw `<SearchResultsSend>` XML onto
 * `onesearch_orders.results_xml`. Nothing in the consumer ever read it, so a
 * paid search could come back and sit unnoticed — the first live order's
 * results arrived ten days before their own quoted ETA and no part of the app
 * showed it.
 *
 * SECURITY — read before widening anything here. PISCES authenticates in-band,
 * so `results_xml` contains our live `<Username>` and `<Password>` inside its
 * `<Authentication>` block. This parser reads ONLY `SearchProduct` and
 * `Attachment` nodes, which means credentials are *structurally* excluded from
 * everything it returns. Never change it to serialise the whole document, echo
 * unmatched nodes, or pass raw XML onward — the bundle it produces is sent to a
 * third-party model.
 */

import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';

/** One attachment on a returned product, in the shape `search-scan` expects. */
export interface OneSearchScanAttachment {
  contentBase64: string;
  format: string;
  filename?: string;
  description?: string;
}

export interface OneSearchScanProduct {
  productType: string;
  attachments: OneSearchScanAttachment[];
}

/**
 * The `provider: 'onesearch'` bundle shape consumed by the search-scan edge
 * function's `normalizeOneSearch`. Field names must stay byte-for-byte aligned
 * with that normaliser.
 */
export interface OneSearchScanBundle {
  products: OneSearchScanProduct[];
}

export interface ReturnedOneSearchSearch {
  /** onesearch_orders.id */
  id: string;
  ourReference: string;
  /** OneSearch's own reference / invoice number, once they've allocated one. */
  supplierReference: string | null;
  productCodes: string[];
  returnedAt: string;
  bundle: OneSearchScanBundle;
}

/**
 * Descendants matching a local element name, whatever namespace they sit in.
 *
 * `<SearchResultsSend>` carries a default OSCRE namespace but `<SearchOrder>`
 * resets it with `xmlns=""`, so today's payload is unnamespaced below the
 * envelope and plain `getElementsByTagName` matches. The local-name fallback
 * covers a prefixed or namespaced document — this is a supplier-controlled
 * format we don't version — and is also required because jsdom's
 * `getElementsByTagNameNS` matches nothing at all, even for ('*','*'), so the
 * obvious namespace-agnostic call cannot be used or tested.
 */
function byLocalName(root: Element | Document, tag: string): Element[] {
  const direct = Array.from(root.getElementsByTagName(tag));
  if (direct.length > 0) return direct;
  return Array.from(root.getElementsByTagName('*')).filter((el) => el.localName === tag);
}

function firstChildText(parent: Element, tag: string): string {
  return byLocalName(parent, tag)[0]?.textContent?.trim() ?? '';
}

/**
 * Parse a `<SearchResultsSend>` document into a scan bundle.
 *
 * Pure and exported for unit testing. Products and attachments are passed
 * through faithfully even when an attachment carries no content — the
 * normaliser downstream already turns those into "missing section" warnings,
 * and dropping them here would silently hide that a product returned nothing.
 */
export function parseOneSearchResultsXml(xml: string): OneSearchScanBundle {
  if (!xml) return { products: [] };

  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(xml, 'text/xml');
  } catch {
    return { products: [] };
  }
  if (doc.getElementsByTagName('parsererror').length > 0) return { products: [] };

  const products: OneSearchScanProduct[] = byLocalName(doc, 'SearchProduct').map((productEl) => {
    const attachments = byLocalName(productEl, 'Attachment').map((attachmentEl) => {
      const fileEl = byLocalName(attachmentEl, 'EmbeddedFileBinaryObject')[0];
      const description = firstChildText(attachmentEl, 'Description');
      const filename = fileEl?.getAttribute('filename') ?? '';
      return {
        // PISCES base64 arrives pretty-printed inside the element, so strip
        // whitespace rather than trusting a single-line payload.
        contentBase64: (fileEl?.textContent ?? '').replace(/\s+/g, ''),
        format: fileEl?.getAttribute('format') ?? '',
        ...(filename ? { filename } : {}),
        ...(description ? { description } : {}),
      };
    });
    return {
      productType: firstChildText(productEl, 'ProductType') || 'UNKNOWN',
      attachments,
    };
  });

  return { products };
}

interface OneSearchOrderRow {
  id: string;
  our_reference: string;
  supplier_reference: string | null;
  product_codes: string[] | null;
  results_xml: string | null;
  updated_at: string;
}

/**
 * Every OneSearch order on this transaction whose results have come back and
 * contain at least one readable document.
 *
 * RLS on `onesearch_orders` limits this to the caller's own orders
 * (`user_id = auth.uid()`), so this is safe to call from the consumer.
 * `client_reference` is where the worker stores our transaction id.
 */
export async function fetchReturnedOneSearchResults(
  transactionId: string,
): Promise<ReturnedOneSearchSearch[]> {
  const { data, error } = await supabase
    .from('onesearch_orders')
    .select('id, our_reference, supplier_reference, product_codes, results_xml, updated_at')
    .eq('client_reference', transactionId)
    .eq('status', 'results_received')
    .not('results_xml', 'is', null)
    .order('updated_at', { ascending: false });

  if (error || !data) {
    // Never log the row itself — results_xml carries our PISCES credentials.
    if (error) logger.error('Failed to read returned OneSearch results:', error.message);
    return [];
  }

  return (data as OneSearchOrderRow[])
    .map((row) => ({
      id: row.id,
      ourReference: row.our_reference,
      supplierReference: row.supplier_reference,
      productCodes: row.product_codes ?? [],
      returnedAt: row.updated_at,
      bundle: parseOneSearchResultsXml(row.results_xml ?? ''),
    }))
    .filter((r) => r.bundle.products.some((p) => p.attachments.some((a) => a.contentBase64)));
}
