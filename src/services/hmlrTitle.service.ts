// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * HMLR Title Pull Service — Tier 1
 *
 * Pulls a single HMLR Register Extract via the PropXchain Render proxy,
 * stores the canonical JSON in Supabase off-chain (GDPR), and writes the
 * SHA-256 hash on-chain to `document_storage` for tamper-proof audit.
 *
 * Three outputs for one pull:
 *  1. Structured data returned to caller for the dashboard HTML view
 *  2. Raw JSON persisted in Supabase storage (the canonical artefact)
 *  3. Hash + provenance recorded on the IC for audit trail
 *
 * Hashes the RAW response, not the rendered view — rendering can evolve
 * over time without breaking the audit chain.
 *
 * Auth: forwards the user's Supabase JWT to the proxy (Path A — frontend
 * → Render direct). Path B (canister → proxy) lives in the future Tier 2
 * Addon #3 "HMLR title deep-query".
 */

import { icpService } from './icp.service';
import { supabase } from '../lib/supabase';
import { generateBufferHash, isValidSHA256Hash } from '../utils/hashGenerator';
import { logger } from '@/utils/logger';

// ============================================
// CONFIG
// ============================================

const PROXY_URL =
  import.meta.env.VITE_HMLR_PROXY_URL ??
  'https://propxchain-proxy-render.onrender.com';

const STORAGE_BUCKET =
  import.meta.env.VITE_HMLR_DOCUMENTS_BUCKET ?? 'propxchain-documents';

const TITLE_NUMBER_RE = /^[A-Z]{1,3}\d{1,6}$/;

// localStorage key for "this transaction already has a completed pull"
// markers. Keyed by transactionId; each entry remembers which titleNumber
// the pull was for so that changing the title invalidates the cache.
const COMPLETED_PULLS_KEY = 'propxchain.hmlr.completed';

interface CompletedPullMarker {
  titleNumber: string;
  responseHash: string;
  canisterDocId: number | null;
  /** Full supabase:// URL written by uploadCanonicalJson — empty if upload
   *  failed at pull time, in which case the cached pull can't be re-loaded. */
  storageLocation: string;
  /** ISO timestamp for "Pulled 21 May 2026, 14:28" display */
  pulledAt: string;
}

function readAllCompletedMarkers(): Record<string, CompletedPullMarker> {
  try {
    const raw = localStorage.getItem(COMPLETED_PULLS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, CompletedPullMarker>;
  } catch {
    return {};
  }
}

function readCompletedMarker(transactionId: string): CompletedPullMarker | null {
  return readAllCompletedMarkers()[transactionId] ?? null;
}

function writeCompletedMarker(transactionId: string, marker: CompletedPullMarker): void {
  const all = readAllCompletedMarkers();
  all[transactionId] = marker;
  try {
    localStorage.setItem(COMPLETED_PULLS_KEY, JSON.stringify(all));
  } catch {
    /* localStorage full / blocked — soft-fail; cache is best-effort */
  }
}

// ============================================
// TYPES — mirror the Render proxy's response shape
// (packages/hmlr-proxy-render/src/types.ts → RegisterExtract)
// ============================================

export interface HmlrProprietor {
  name: string;
  addresses: string[];
  aliases: string[];
}

export interface HmlrCharge {
  chargeId: number;
  chargeDate: string;
  chargee: string;
  description: string;
}

export interface HmlrRegisterExtract {
  titleNumber: string;
  messageId: string;
  registeredAddress: string;
  addressLines: string[];
  classOfTitle: string;
  tenure: string;
  editionDate: string;
  officialCopyDateTime: string;
  proprietors: HmlrProprietor[];
  charges: HmlrCharge[];
  hasCharges: boolean;
  hasRestrictions: boolean;
  hasCautions: boolean;
  hasNotices: boolean;
  leaseCount: number;
  titlePlanZipBase64: string | null;
  /**
   * HMLR GatewayResponse.TypeCode delivery discriminator (proxy types.ts):
   *   30 — success, full register data delivered electronically
   *   20 — cannot deliver electronically (paper-only title)
   *   10 — system out of hours / queued for later delivery
   *    0 — TypeCode absent (SOAP fault / pre-Gateway error)
   * Only 30 carries renderable register data — see {@link classifyTypeCode}.
   */
  typeCode: number;
  raw: string;
}

export interface HmlrTitlePullResult {
  /** Structured register data for rendering */
  register: HmlrRegisterExtract;
  /** SHA-256 hex hash of the canonical JSON response */
  responseHash: string;
  /** Supabase storage path of the raw JSON */
  storageLocation: string;
  /** document_storage canister doc id (numeric), or null on canister-write failure */
  canisterDocId: number | null;
  /** Non-fatal audit warnings (e.g. storage upload failed but data still returned) */
  warnings: string[];
  /** Cost in pence — currently fixed at the HMLR Business Gateway register-extract fee */
  costPence: number;
}

// ============================================
// TYPES — Search by Property Description (free address → title lookup)
// (packages/hmlr-proxy-render → TitleSearchResult / TitleSearchMatch)
// ============================================

export interface TitleSearchAddress {
  postcode: string;
  houseNumber?: string;
  houseName?: string;
  streetName?: string;
}

export interface HmlrTitleMatch {
  titleNumber: string;
  addressDisplay: string;
  tenure: string;
}

export interface HmlrTitleSearchResult {
  /**
   * HMLR GatewayResponse.TypeCode (proxy types.ts):
   *   30 — Result delivered (matches populated)
   *   20 — Rejection (rejection populated; e.g. insufficient address detail)
   *   10 — Acknowledgement / queued async (acknowledgement populated)
   *    0 — TypeCode absent (SOAP fault / pre-Gateway error)
   */
  typeCode: number;
  matches: HmlrTitleMatch[];
  rejection: { reason: string; code: string } | null;
  acknowledgement: {
    uniqueId: string;
    expectedResponseDateTime: string;
    message: string;
  } | null;
}

/** Common UK street-name suffixes. A number-less line ENDING in one of these
 *  is a street, not a building name — Rightmove imports give street-only
 *  addresses ("Ivel Road"), and sending those as HMLR BuildingName guarantees
 *  a TypeCode 20 "insufficient data" rejection (seen live 2026-07-22). */
const STREET_SUFFIX_RE =
  /\b(road|street|lane|avenue|close|drive|way|court|gardens?|grove|crescent|place|terrace|hill|park|row|green|walk|rise|mews|square|view|meadows?|fields?)$/i;

/**
 * Split a free-text "address line 1" into the OSCRE fields HMLR's property
 * search expects. A leading number (optionally with a trailing letter, e.g.
 * "12A") becomes the houseNumber and the remainder the streetName; a
 * number-less line ending in a street suffix (e.g. "Ivel Road") becomes the
 * streetName; otherwise the whole line is treated as a houseName (e.g.
 * "Rose Cottage"). Pure + exported for unit testing.
 */
export function splitAddressLine1(line1: string): {
  houseNumber?: string;
  houseName?: string;
  streetName?: string;
} {
  const trimmed = line1.trim();
  if (!trimmed) return {};
  const m = trimmed.match(/^(\d+[A-Za-z]?)\s+(.+)$/);
  if (m) {
    const street = m[2].trim();
    return { houseNumber: m[1], streetName: street.length > 0 ? street : undefined };
  }
  if (STREET_SUFFIX_RE.test(trimmed)) return { streetName: trimmed };
  return { houseName: trimmed };
}

/**
 * Per-call overrides — currently used for BG-Test fixture playback during
 * development. In production these should be left undefined; the proxy
 * generates a fresh MessageID per call and defaults the externalReference
 * to differ from the customerReference (BG-Test rejects equal values).
 *
 * HMLR BG-Test is fixture playback — Simon Devey pre-loads (MessageID,
 * titleNumber) pairs that return canned data. Known fixture as of
 * 2026-05-15: messageId=170100 + titleNumber=GR506405 returns full
 * register data (proprietors ROBERT JONES + JOHN DAVIES).
 */
export interface PullTitleOptions {
  /**
   * The Stripe Checkout Session that paid the £7. Required: the proxy claims
   * that session's one-use pull credit before it contacts HMLR and refuses
   * the pull (402) without it (security scan 2026-09-23, H1).
   */
  stripeSessionId: string;
  /** Override the auto-generated MessageID. Use to hit a known BG-Test fixture. */
  messageId?: string;
  /**
   * Override the HMLR CustomerReference field. Defaults (proxy-side) to the
   * caller's Supabase user UUID. BG-Test fixtures pin on `Bguser1`; production
   * accepts any unique value, so leaving this unset is correct there.
   */
  customerReference?: string;
  /** Override the HMLR externalReference field (must differ from customerReference). */
  externalReference?: string;
  /** Ask HMLR to include the title plan ZIP in the response. Costs more on production. */
  includeTitlePlan?: boolean;
}

interface ProxyEnvelope {
  titleNumber: string;
  result: HmlrRegisterExtract;
}

/** Row shape returned from the public.hmlr_pulls index lookup. */
export interface HmlrPullIndexRow {
  id: string;
  user_id: string;
  title_number: string;
  transaction_id: string;
  storage_path: string;
  response_hash: string | null;
  canister_doc_id: number | null;
  pulled_at: string;
}

/** Thrown when the proxy refuses the request (auth, validation, HMLR error) */
export class HmlrPullError extends Error {
  readonly status: number;
  readonly cause: string;
  constructor(status: number, cause: string, message: string) {
    super(message);
    this.name = 'HmlrPullError';
    this.status = status;
    this.cause = cause;
  }
}

// ============================================
// HMLR DELIVERY TYPECODE
// ============================================

/**
 * HMLR GatewayResponse.TypeCode values. Only SUCCESS (30) returns deliverable
 * register data; the others come back HTTP 200 with empty defaults and must
 * not be rendered as a (blank) success or persisted. See card b93a8984.
 */
export const HmlrTypeCode = {
  SUCCESS: 30,
  CANNOT_DELIVER: 20,
  QUEUED: 10,
  ABSENT: 0,
} as const;

/** Stable `HmlrPullError.cause` strings the UI branches messaging on. */
export type HmlrPullCause =
  | 'hmlr_cannot_deliver'
  | 'hmlr_queued'
  | 'hmlr_unavailable';

export type HmlrDeliveryOutcome =
  | { deliverable: true }
  | { deliverable: false; cause: HmlrPullCause; status: number; message: string };

/**
 * Map an HMLR delivery TypeCode to a render/refund decision. Pure — unit
 * tested in isolation. `pullTitleRegister` throws on a non-deliverable
 * outcome before hashing/uploading/caching so non-30 results never get
 * rendered blank or charged for.
 */
export function classifyTypeCode(typeCode: number): HmlrDeliveryOutcome {
  switch (typeCode) {
    case HmlrTypeCode.SUCCESS:
      return { deliverable: true };
    case HmlrTypeCode.CANNOT_DELIVER:
      return {
        deliverable: false,
        cause: 'hmlr_cannot_deliver',
        status: 200,
        message:
          'HM Land Registry holds this title but cannot deliver it ' +
          'electronically — typically a paper-only or pre-digital title. ' +
          'An Official Copy (OC1) must be ordered by post.',
      };
    case HmlrTypeCode.QUEUED:
      return {
        deliverable: false,
        cause: 'hmlr_queued',
        status: 200,
        message:
          'HM Land Registry is temporarily unavailable (out-of-hours or ' +
          'queued for later delivery). Please try again shortly.',
      };
    default:
      return {
        deliverable: false,
        cause: 'hmlr_unavailable',
        status: 502,
        message:
          `HM Land Registry returned an unrecognised delivery status ` +
          `(TypeCode ${typeCode}). The request could not be completed.`,
      };
  }
}

// ============================================
// SERVICE
// ============================================

class HmlrTitleService {
  // HMLR Business Gateway charges ~£7 per Official Copy with Summary.
  // Surfaced here so the UI can display the pass-through cost.
  readonly HMLR_REGISTER_EXTRACT_COST_PENCE = 700;

  /**
   * Pull an HMLR Register Extract for a title number.
   *
   * Steps:
   *  1. Validate format
   *  2. POST to Render proxy with Supabase JWT
   *  3. Hash the canonical JSON response
   *  4. Upload raw JSON to Supabase storage (GDPR off-chain)
   *  5. Register hash on `document_storage` canister
   *  6. Return structured data + audit references
   *
   * Partial-failure semantics: if Supabase upload or canister write fails
   * AFTER a successful HMLR fetch, the data is still returned and the
   * failure surfaces as a `warning`. The user paid £7 — they always get
   * the data. The audit gap is logged for follow-up.
   */
  async pullTitleRegister(
    titleNumber: string,
    transactionId: string,
    opts: PullTitleOptions,
  ): Promise<HmlrTitlePullResult> {
    const normalised = titleNumber.trim().toUpperCase();
    if (!TITLE_NUMBER_RE.test(normalised)) {
      throw new HmlrPullError(
        400,
        'invalid_title_format',
        `Title number "${titleNumber}" is not in the expected HMLR format ` +
          `(1-3 letters followed by 1-6 digits, e.g. GR506405).`,
      );
    }

    const session = await this.getSupabaseJwt();
    const proxyResponse = await this.callProxy(normalised, session, opts);

    // Branch on the HMLR delivery TypeCode before we spend effort hashing,
    // uploading and caching. Only TypeCode 30 carries deliverable register
    // data; 20/10/0 come back HTTP 200 with empty defaults and must NOT be
    // persisted or rendered as a blank success. Throw a typed outcome so the
    // button shows the right message and refunds the £7. See card b93a8984.
    const delivery = classifyTypeCode(proxyResponse.result.typeCode);
    if (!delivery.deliverable) {
      throw new HmlrPullError(delivery.status, delivery.cause, delivery.message);
    }

    const { responseHash, canonicalJson } =
      await this.hashCanonicalResponse(proxyResponse);

    const warnings: string[] = [];

    const storageLocation = await this.uploadCanonicalJson(
      canonicalJson,
      transactionId,
      normalised,
      proxyResponse.result.messageId,
    ).catch((err) => {
      logger.error('HMLR canonical JSON upload to Supabase failed', err);
      warnings.push(
        `Supabase upload failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return null;
    });

    const canisterDocId = await this.registerOnChain({
      titleNumber: normalised,
      transactionId,
      responseHash,
      canonicalJson,
      storageLocation:
        storageLocation ?? `supabase-upload-failed://${normalised}`,
      messageId: proxyResponse.result.messageId,
    }).catch((err) => {
      logger.error('HMLR audit hash write to document_storage failed', err);
      warnings.push(
        `Canister audit write failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return null;
    });

    // Record the on-chain HMLR-fetched milestone so getNextStep stops
    // reporting `hmlr_not_fetched` — the NextStepCard and the premium AI
    // Move Narrator mirror getNextStep, so they advance automatically. The
    // register is general/non-PII, so we anchor only its responseHash
    // (matrix: On+hash). Best-effort and unconditional on a deliverable
    // pull: the document_storage write above also sets this milestone via
    // onDocumentRegistered, and the register is already fetched, so a
    // failure here must never fail the paid pull.
    try {
      const milestone = await icpService.recordHmlrFetched(
        transactionId,
        normalised,
        responseHash,
      );
      if ('err' in milestone) {
        logger.warn('HMLR fetched-milestone write failed (non-fatal)', {
          err: milestone.err,
        });
        warnings.push(`On-chain milestone write failed: ${milestone.err}`);
      }
    } catch (err) {
      logger.warn('HMLR fetched-milestone write threw (non-fatal)', err);
      warnings.push(
        `On-chain milestone write threw: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    // Remember the completed pull so the button on subsequent visits can
    // offer "View existing Title" instead of charging the user a second
    // £7 to re-fetch data they already paid for. Skipped when the
    // Supabase upload itself failed because there's nothing to re-load.
    if (storageLocation) {
      writeCompletedMarker(transactionId, {
        titleNumber: normalised,
        responseHash,
        canisterDocId,
        storageLocation,
        pulledAt: new Date().toISOString(),
      });

      // Also persist to the public.hmlr_pulls index so the Stage 1
      // listing form can find this pull across other transactions /
      // browsers / devices the same user owns. RLS auto-scopes the
      // insert to the authenticated user. Best-effort: if the insert
      // fails (auth race, DB down), the localStorage marker above
      // still lets THIS browser short-circuit, and the next mount in
      // any browser falls back to the £7 path — never lies about
      // having a cached pull when it doesn't.
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) {
          const { error } = await supabase.from('hmlr_pulls').insert({
            user_id: user.id,
            title_number: normalised,
            transaction_id: transactionId,
            storage_path: storageLocation,
            response_hash: responseHash,
            canister_doc_id: canisterDocId,
          });
          if (error) {
            logger.warn('hmlr_pulls insert failed', { error });
          }
        }
      } catch (err) {
        logger.warn('hmlr_pulls insert threw', err);
      }
    }

    // Fire-and-forget: kick off the server-side AI HMLR scan, which distils
    // this register into a cached, non-PII seller explainer plus the
    // conveyancer-quote enrichment block. The edge function is idempotent on
    // (titleNumber, editionDate), so a repeat pull is a cache hit. Best-effort
    // and non-blocking — it must never delay or fail the £7 paid pull.
    void this.triggerHmlrScan(proxyResponse.result, transactionId);

    return {
      register: proxyResponse.result,
      responseHash,
      storageLocation: storageLocation ?? '',
      canisterDocId,
      warnings,
      costPence: this.HMLR_REGISTER_EXTRACT_COST_PENCE,
    };
  }

  /**
   * Trigger the AI HMLR scan for a freshly-pulled, deliverable register.
   * Fire-and-forget: any failure is logged and swallowed so it can never
   * affect the pull flow. The `hmlr-scan` edge function does its own auth
   * and is idempotent server-side on (titleNumber, editionDate).
   */
  private async triggerHmlrScan(
    register: HmlrRegisterExtract,
    transactionId: string,
  ): Promise<void> {
    try {
      const { error } = await supabase.functions.invoke('hmlr-scan', {
        body: { register, transactionId },
      });
      if (error) {
        logger.warn('hmlr-scan invoke failed (non-fatal)', { error });
      }
    } catch (err) {
      logger.warn('hmlr-scan invoke threw (non-fatal)', err);
    }
  }

  /**
   * Sync, cheap check used by the button at mount time to decide between
   * the £7 paid path and the "View existing Title" path. Returns true
   * only when the cached marker's titleNumber matches the current
   * transaction's title (so changing the title invalidates the cache).
   */
  hasCompletedPull(transactionId: string, titleNumber: string): boolean {
    const marker = readCompletedMarker(transactionId);
    if (!marker) return false;
    return marker.titleNumber === titleNumber.trim().toUpperCase();
  }

  /**
   * Per-user, cross-transaction lookup. Queries the public.hmlr_pulls
   * index in Supabase for ANY prior pull this user has done for the
   * given title number, regardless of which transaction it was filed
   * under. Returns the most recent row, or null.
   *
   * RLS auto-scopes the SELECT to the authenticated user — there's no
   * cross-user leakage; one user pulling GR506405 doesn't unlock the
   * data for another. Pricing model charges for access, not data.
   *
   * Stage 1's listing form calls this when the user enters a title
   * number. If a row comes back, the button switches to "View existing
   * Title" and the £7 charge is skipped.
   */
  async findPullByTitleNumber(
    titleNumber: string,
  ): Promise<HmlrPullIndexRow | null> {
    const normalised = titleNumber.trim().toUpperCase();
    if (!TITLE_NUMBER_RE.test(normalised)) return null;

    const { data, error } = await supabase
      .from('hmlr_pulls')
      .select('id,user_id,title_number,transaction_id,storage_path,response_hash,canister_doc_id,pulled_at')
      .eq('title_number', normalised)
      .order('pulled_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      logger.warn('findPullByTitleNumber: query failed', { error });
      return null;
    }
    return data ?? null;
  }

  /**
   * Find HMLR title numbers for an address via the free Search by Property
   * Description service (HMLR: "Enquiry by Property Description"). No charge,
   * no Stripe — it's a pre-purchase lookup so a seller who doesn't know their
   * title number can find it, then feed it into the (paid) register pull.
   *
   * Returns the proxy's TypeCode-discriminated result: 30 → matches, 20 →
   * rejection (e.g. insufficient address detail), 10 → async acknowledgement
   * (not expected — the live service answers synchronously).
   */
  async searchTitlesByAddress(
    address: TitleSearchAddress,
  ): Promise<HmlrTitleSearchResult> {
    const postcode = address.postcode.trim();
    if (!postcode) {
      throw new HmlrPullError(
        400,
        'postcode_required',
        'A postcode is required to search for a title.',
      );
    }

    const token = await this.getSupabaseJwt();
    const url = `${PROXY_URL}/api/title-search`;
    const body: Record<string, unknown> = { postcode };
    if (address.houseNumber) body.houseNumber = address.houseNumber;
    if (address.houseName) body.houseName = address.houseName;
    if (address.streetName) body.streetName = address.streetName;

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      throw new HmlrPullError(
        0,
        'network_error',
        `Could not reach HMLR proxy: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    const text = await response.text();
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      // Non-JSON body — keep parsed null and surface raw status below.
    }

    if (!response.ok) {
      const cause = this.extractString(parsed, 'error') ?? 'proxy_error';
      const reason =
        this.extractString(parsed, 'reason') ??
        this.extractString(parsed, 'message') ??
        text.slice(0, 200);
      throw new HmlrPullError(
        response.status,
        cause,
        `Title search failed (${response.status}): ${reason}`,
      );
    }

    if (!parsed || typeof parsed !== 'object') {
      throw new HmlrPullError(
        response.status,
        'invalid_body',
        'Title search returned a non-JSON response.',
      );
    }

    const obj = parsed as Record<string, unknown>;
    const matches: HmlrTitleMatch[] = (
      Array.isArray(obj.matches) ? obj.matches : []
    )
      .filter(
        (m): m is Record<string, unknown> => !!m && typeof m === 'object',
      )
      .map((m) => ({
        titleNumber: this.extractString(m, 'titleNumber') ?? '',
        addressDisplay: this.extractString(m, 'addressDisplay') ?? '',
        tenure: this.extractString(m, 'tenure') ?? '',
      }))
      .filter((m) => m.titleNumber.length > 0);

    const rej = obj.rejection;
    const rejection =
      rej && typeof rej === 'object'
        ? {
            reason: this.extractString(rej, 'reason') ?? '',
            code: this.extractString(rej, 'code') ?? '',
          }
        : null;

    const ack = obj.acknowledgement;
    const acknowledgement =
      ack && typeof ack === 'object'
        ? {
            uniqueId: this.extractString(ack, 'uniqueId') ?? '',
            expectedResponseDateTime:
              this.extractString(ack, 'expectedResponseDateTime') ?? '',
            message: this.extractString(ack, 'message') ?? '',
          }
        : null;

    return {
      typeCode: typeof obj.typeCode === 'number' ? obj.typeCode : 0,
      matches,
      rejection,
      acknowledgement,
    };
  }

  /**
   * Download + reconstruct the HmlrTitlePullResult for a given index
   * row from findPullByTitleNumber. Returns null if the row's storage
   * path can't be re-fetched (file deleted, RLS denied, network).
   */
  async loadPullByIndexRow(
    row: HmlrPullIndexRow,
  ): Promise<HmlrTitlePullResult | null> {
    const m = row.storage_path.match(/^supabase:\/\/([^/]+)\/(.+)$/);
    if (!m) return null;
    const [, bucket, path] = m;

    const { data: blob, error } = await supabase.storage.from(bucket).download(path);
    if (error || !blob) {
      logger.warn('loadPullByIndexRow: storage download failed', { error });
      return null;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(await blob.text());
    } catch (err) {
      logger.warn('loadPullByIndexRow: JSON parse failed', err);
      return null;
    }
    if (!parsed || typeof parsed !== 'object' || !('result' in parsed)) {
      return null;
    }

    const envelope = parsed as ProxyEnvelope;
    return {
      register: envelope.result,
      responseHash: row.response_hash ?? '',
      storageLocation: row.storage_path,
      canisterDocId: row.canister_doc_id,
      warnings: [],
      costPence: 0, // already paid for, this is a re-view
    };
  }

  /**
   * Re-download a previously-pulled title report from Supabase storage
   * and reconstruct an HmlrTitlePullResult that can be passed straight
   * into the modal. Returns null if no cache marker exists, the title
   * doesn't match, or the file can't be read.
   *
   * Doesn't re-charge the user. Doesn't re-write the on-chain audit
   * hash. Just renders what was already paid for.
   */
  async loadExistingTitlePull(
    transactionId: string,
    titleNumber: string,
  ): Promise<HmlrTitlePullResult | null> {
    const marker = readCompletedMarker(transactionId);
    if (!marker) return null;
    if (marker.titleNumber !== titleNumber.trim().toUpperCase()) return null;

    const m = marker.storageLocation.match(/^supabase:\/\/([^/]+)\/(.+)$/);
    if (!m) return null;
    const [, bucket, path] = m;

    const { data, error } = await supabase.storage.from(bucket).download(path);
    if (error || !data) {
      logger.warn('loadExistingTitlePull: storage download failed', { error });
      return null;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(await data.text());
    } catch (err) {
      logger.warn('loadExistingTitlePull: JSON parse failed', err);
      return null;
    }
    if (!parsed || typeof parsed !== 'object' || !('result' in parsed)) {
      return null;
    }

    const envelope = parsed as ProxyEnvelope;
    return {
      register: envelope.result,
      responseHash: marker.responseHash,
      storageLocation: marker.storageLocation,
      canisterDocId: marker.canisterDocId,
      warnings: [],
      costPence: 0, // already paid for; this is a re-view
    };
  }

  /**
   * Return the stored register for a transaction's completed pull, keyed by
   * transactionId alone (the marker remembers which title it was for). Lets the
   * AI Scans tab read the already-pulled register — and thus the warmed
   * hmlr-scan cache — without the caller knowing the title number. Returns null
   * when there's no completed pull or the stored JSON can't be re-read.
   */
  async getStoredRegisterForTransaction(
    transactionId: string,
  ): Promise<HmlrRegisterExtract | null> {
    const marker = readCompletedMarker(transactionId);
    if (!marker) return null;
    const pull = await this.loadExistingTitlePull(transactionId, marker.titleNumber);
    return pull?.register ?? null;
  }

  // ============================================
  // PRIVATE — proxy call
  // ============================================

  private async callProxy(
    titleNumber: string,
    bearerToken: string,
    opts: PullTitleOptions,
  ): Promise<ProxyEnvelope> {
    const url = `${PROXY_URL}/api/title/${encodeURIComponent(titleNumber)}`;
    const body: Record<string, unknown> = { stripeSessionId: opts.stripeSessionId };
    if (opts.messageId) body.messageId = opts.messageId;
    if (opts.customerReference) body.customerReference = opts.customerReference;
    if (opts.externalReference) body.externalReference = opts.externalReference;
    if (opts.includeTitlePlan) body.includeTitlePlan = opts.includeTitlePlan;

    logger.info('HMLR pull: calling proxy', {
      url,
      titleNumber,
      hasMessageIdOverride: Boolean(opts.messageId),
      hasCustomerReferenceOverride: Boolean(opts.customerReference),
      hasExternalReferenceOverride: Boolean(opts.externalReference),
      includeTitlePlan: opts.includeTitlePlan ?? false,
    });

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${bearerToken}`,
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      throw new HmlrPullError(
        0,
        'network_error',
        `Could not reach HMLR proxy: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    const bodyText = await response.text();
    let parsedBody: unknown = null;
    try {
      parsedBody = bodyText ? JSON.parse(bodyText) : null;
    } catch {
      // Non-JSON body — keep parsedBody null and surface raw status
    }

    if (!response.ok) {
      const cause =
        this.extractString(parsedBody, 'error') ?? 'proxy_error';
      const reason =
        this.extractString(parsedBody, 'reason') ??
        this.extractString(parsedBody, 'message') ??
        bodyText.slice(0, 200);
      throw new HmlrPullError(
        response.status,
        cause,
        `HMLR proxy returned ${response.status}: ${reason}`,
      );
    }

    if (!parsedBody || typeof parsedBody !== 'object') {
      throw new HmlrPullError(
        response.status,
        'invalid_body',
        'HMLR proxy returned a non-JSON success response.',
      );
    }

    const envelope = parsedBody as ProxyEnvelope;
    if (!envelope.result || !envelope.result.titleNumber) {
      throw new HmlrPullError(
        response.status,
        'invalid_shape',
        'HMLR proxy response did not contain a `result` block.',
      );
    }

    return envelope;
  }

  private extractString(body: unknown, key: string): string | null {
    if (!body || typeof body !== 'object') return null;
    const value = (body as Record<string, unknown>)[key];
    return typeof value === 'string' ? value : null;
  }

  // ============================================
  // PRIVATE — hashing
  // ============================================

  /**
   * Canonicalise the proxy response and SHA-256 it.
   *
   * Hashing the *response*, not the rendered HTML, anchors the audit chain
   * to the data HMLR actually returned. Canonical form: JSON-stringify the
   * full envelope (no key reordering — proxy returns deterministic shape).
   */
  private async hashCanonicalResponse(
    envelope: ProxyEnvelope,
  ): Promise<{ responseHash: string; canonicalJson: string }> {
    const canonicalJson = JSON.stringify(envelope);
    const buffer = new TextEncoder().encode(canonicalJson).buffer;
    const responseHash = await generateBufferHash(buffer);

    if (!isValidSHA256Hash(responseHash)) {
      throw new HmlrPullError(
        500,
        'hash_invalid',
        'Internal: computed hash failed format validation.',
      );
    }

    return { responseHash, canonicalJson };
  }

  // ============================================
  // PRIVATE — Supabase storage
  // ============================================

  /**
   * Persist the raw JSON to Supabase storage (off-chain).
   *
   * GDPR: title-register data contains proprietor PII (name + address) and
   * is not safe to push to an IC asset canister. Supabase storage carries
   * the existing data-processing posture for the rest of the platform.
   */
  private async uploadCanonicalJson(
    canonicalJson: string,
    transactionId: string,
    titleNumber: string,
    messageId: string,
  ): Promise<string> {
    const path =
      `transactions/${transactionId}` +
      `/hmlr-register-${titleNumber}-${messageId}.json`;

    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, canonicalJson, {
        contentType: 'application/json',
        upsert: false,
      });

    if (error) {
      throw new Error(`Supabase storage upload failed: ${error.message}`);
    }

    return `supabase://${STORAGE_BUCKET}/${path}`;
  }

  // ============================================
  // PRIVATE — canister write
  // ============================================

  private async registerOnChain(args: {
    titleNumber: string;
    transactionId: string;
    responseHash: string;
    canonicalJson: string;
    storageLocation: string;
    messageId: string;
  }): Promise<number> {
    await icpService.initialize();
    await icpService.ensureDocumentStorageActor();

    if (!icpService.documentStorageActor) {
      throw new Error('document_storage actor not available after initialise');
    }

    const fileName =
      `hmlr-register-${args.titleNumber}-${args.messageId}.json`;
    const fileSize = new TextEncoder().encode(args.canonicalJson).byteLength;

    // document_storage requires a CSRF token as the final arg. Fetch
    // a fresh one before each write — tokens are short-lived and
    // single-canister scoped per icpService.getDocumentStorageCsrfToken.
    const csrfToken = await icpService.getDocumentStorageCsrfToken();

    const result = await icpService.documentStorageActor.registerDocumentProof(
      fileName,
      args.responseHash,
      BigInt(fileSize),
      'application/json',
      args.storageLocation,
      [args.transactionId],
      'hmlr-register-extract',
      csrfToken,
    );

    if ('err' in result) {
      throw new Error(`document_storage rejected proof: ${result.err}`);
    }

    const docId = Number(result.ok);
    logger.info('HMLR audit hash registered on chain', {
      docId,
      titleNumber: args.titleNumber,
      messageId: args.messageId,
    });

    return docId;
  }

  // ============================================
  // PRIVATE — auth
  // ============================================

  private async getSupabaseJwt(): Promise<string> {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      throw new HmlrPullError(
        401,
        'session_unavailable',
        `Could not read Supabase session: ${error.message}`,
      );
    }
    const token = data?.session?.access_token;
    if (!token) {
      throw new HmlrPullError(
        401,
        'not_authenticated',
        'You must be signed in to request an HMLR title report.',
      );
    }
    return token;
  }
}

export const hmlrTitleService = new HmlrTitleService();
export default hmlrTitleService;
