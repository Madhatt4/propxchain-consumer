// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * property_logbook canister client. The canister is UPRN-keyed and
 * append-only; `getMyLogbooks` returns the CALLER's logbooks, so the actor is
 * built on the authenticated agent from icp.service (same reuse pattern as
 * message.service). Canister id follows the icp.service idiom: env override,
 * falling back to the mainnet id (public, not a secret). Set the env var to
 * '' to force the 'unavailable' state; the service never throws.
 */

import { Actor, HttpAgent } from '@propxchain/core-client';
import { icpService } from './icp.service';

/** Mainnet property_logbook, created 2026-08-15 (monorepo canister_ids.json). */
const MAINNET_LOGBOOK_CANISTER_ID = '43x7o-qaaaa-aaaaa-qhm6q-cai';
import { logger } from '@/utils/logger';
import type { Logbook, LogbookClaim, LogbookEntry, LogbookEvidence } from '../types/logbook.types';

const IC_HOST = (import.meta.env.VITE_IC_HOST as string) || 'https://icp-api.io';

// core-client's Actor bundles its own candid (@icp-sdk/core), which is
// nominally distinct from the app's @dfinity/candid (private fields make the
// Type classes incompatible to tsc). Build the factory against the IDL
// namespace Actor itself injects, so the production path needs no casts.
type CoreIdlFactory = Parameters<typeof Actor.createActor>[0];
export type CandidIdl = Parameters<CoreIdlFactory>[0]['IDL'];
type CandidRecord = ReturnType<CandidIdl['Record']>;

/**
 * Candid type for LogbookView — exported so tests can encode/decode fixtures
 * against exactly the shape the actor uses. The wire record also carries a
 * `derived : DerivedState` field the v1 UI does not consume; Candid record
 * subtyping lets the decoder drop fields absent from the expected type, so it
 * is deliberately omitted here (type what you consume).
 */
export const logbookViewType = (c: CandidIdl): CandidRecord => {
  const Claim = c.Variant({
    propertyIdentity: c.Record({
      uprn: c.Text,
      addressLine: c.Text,
      postcode: c.Text,
      propertyType: c.Text,
    }),
    titleFacts: c.Record({
      titleNumber: c.Text,
      classOfTitle: c.Opt(c.Text),
      editionDate: c.Opt(c.Text),
      hasCharges: c.Opt(c.Bool),
      hasRestrictions: c.Opt(c.Bool),
    }),
    tenure: c.Record({
      tenure: c.Variant({ freehold: c.Null, leasehold: c.Null, shareOfFreehold: c.Null }),
      leaseYearsRemaining: c.Opt(c.Nat),
      groundRentPerYearPence: c.Opt(c.Nat),
      serviceChargePerYearPence: c.Opt(c.Nat),
    }),
    ratings: c.Record({
      epcBand: c.Opt(c.Text),
      epcCertRef: c.Opt(c.Text),
      councilTaxBand: c.Opt(c.Text),
    }),
    priceEvent: c.Record({
      kind: c.Variant({ listed: c.Null, sold: c.Null }),
      pricePence: c.Nat,
      occurredAt: c.Int,
    }),
    searchFact: c.Record({
      provider: c.Text,
      productCodes: c.Vec(c.Text),
      orderedAt: c.Opt(c.Int),
      resultsReturnedAt: c.Opt(c.Int),
      resultHashes: c.Vec(c.Text),
    }),
    documentAnchor: c.Record({
      docType: c.Text,
      sha256: c.Text,
      validUntil: c.Opt(c.Int),
      anchoredAt: c.Int,
    }),
    milestone: c.Record({
      kind: c.Variant({ listed: c.Null, saleAgreed: c.Null, completed: c.Null }),
      transactionId: c.Text,
      occurredAt: c.Int,
    }),
  });
  const LogbookEntry = c.Record({
    id: c.Nat,
    claim: Claim,
    recordedAt: c.Int,
    recordedByTransaction: c.Opt(c.Text),
    evidence: c.Variant({ onchainAnchor: c.Null, sellerVouch: c.Null, systemDerived: c.Null }),
  });
  return c.Record({
    uprn: c.Text,
    owner: c.Principal,
    createdAt: c.Int,
    entries: c.Vec(LogbookEntry),
  });
};

const logbookIdlFactory: CoreIdlFactory = ({ IDL: c }) => {
  const LogbookView = logbookViewType(c);
  return c.Service({
    getLogbook: c.Func([c.Text], [c.Variant({ ok: LogbookView, err: c.Text })], ['query']),
    getMyLogbooks: c.Func([], [c.Vec(LogbookView)], ['query']),
  });
};

// ---- Raw wire shapes (what the hand-written IDL decodes to) ----

type COpt<T> = [] | [T];

export type RawClaim =
  | {
      propertyIdentity: { uprn: string; addressLine: string; postcode: string; propertyType: string };
    }
  | {
      titleFacts: {
        titleNumber: string;
        classOfTitle: COpt<string>;
        editionDate: COpt<string>;
        hasCharges: COpt<boolean>;
        hasRestrictions: COpt<boolean>;
      };
    }
  | {
      tenure: {
        tenure: { freehold: null } | { leasehold: null } | { shareOfFreehold: null };
        leaseYearsRemaining: COpt<bigint>;
        groundRentPerYearPence: COpt<bigint>;
        serviceChargePerYearPence: COpt<bigint>;
      };
    }
  | { ratings: { epcBand: COpt<string>; epcCertRef: COpt<string>; councilTaxBand: COpt<string> } }
  | { priceEvent: { kind: { listed: null } | { sold: null }; pricePence: bigint; occurredAt: bigint } }
  | {
      searchFact: {
        provider: string;
        productCodes: string[];
        orderedAt: COpt<bigint>;
        resultsReturnedAt: COpt<bigint>;
        resultHashes: string[];
      };
    }
  | { documentAnchor: { docType: string; sha256: string; validUntil: COpt<bigint>; anchoredAt: bigint } }
  | {
      milestone: {
        kind: { listed: null } | { saleAgreed: null } | { completed: null };
        transactionId: string;
        occurredAt: bigint;
      };
    };

export interface RawLogbookEntry {
  id: bigint;
  claim: RawClaim;
  recordedAt: bigint;
  recordedByTransaction: COpt<string>;
  evidence: { onchainAnchor: null } | { sellerVouch: null } | { systemDerived: null };
}

export interface RawLogbookView {
  uprn: string;
  // Principal, typed structurally so tests and the (version-pinned) agent's
  // own Principal class both satisfy it without cross-package imports.
  owner: { toText(): string };
  createdAt: bigint;
  entries: RawLogbookEntry[];
}

interface LogbookActor {
  getMyLogbooks(): Promise<RawLogbookView[]>;
}

// ---- Converters ----

const fromOpt = <T>(o: COpt<T>): T | null => (o.length === 1 ? o[0] : null);
const unitKey = <K extends string>(v: Partial<Record<K, null>>): K => Object.keys(v)[0] as K;

function convertClaim(raw: RawClaim): LogbookClaim {
  if ('propertyIdentity' in raw) return { kind: 'propertyIdentity', ...raw.propertyIdentity };
  if ('titleFacts' in raw) {
    const t = raw.titleFacts;
    return {
      kind: 'titleFacts',
      titleNumber: t.titleNumber,
      classOfTitle: fromOpt(t.classOfTitle),
      editionDate: fromOpt(t.editionDate),
      hasCharges: fromOpt(t.hasCharges),
      hasRestrictions: fromOpt(t.hasRestrictions),
    };
  }
  if ('tenure' in raw) {
    const t = raw.tenure;
    return {
      kind: 'tenure',
      tenure: unitKey(t.tenure),
      leaseYearsRemaining: fromOpt(t.leaseYearsRemaining),
      groundRentPerYearPence: fromOpt(t.groundRentPerYearPence),
      serviceChargePerYearPence: fromOpt(t.serviceChargePerYearPence),
    };
  }
  if ('ratings' in raw) {
    const r = raw.ratings;
    return {
      kind: 'ratings',
      epcBand: fromOpt(r.epcBand),
      epcCertRef: fromOpt(r.epcCertRef),
      councilTaxBand: fromOpt(r.councilTaxBand),
    };
  }
  if ('priceEvent' in raw) {
    const p = raw.priceEvent;
    return { kind: 'priceEvent', priceKind: unitKey(p.kind), pricePence: p.pricePence, occurredAt: p.occurredAt };
  }
  if ('searchFact' in raw) {
    const s = raw.searchFact;
    return {
      kind: 'searchFact',
      provider: s.provider,
      productCodes: s.productCodes,
      orderedAt: fromOpt(s.orderedAt),
      resultsReturnedAt: fromOpt(s.resultsReturnedAt),
      resultHashes: s.resultHashes,
    };
  }
  if ('documentAnchor' in raw) {
    const d = raw.documentAnchor;
    return {
      kind: 'documentAnchor',
      docType: d.docType,
      sha256: d.sha256,
      validUntil: fromOpt(d.validUntil),
      anchoredAt: d.anchoredAt,
    };
  }
  const m = raw.milestone;
  return { kind: 'milestone', milestoneKind: unitKey(m.kind), transactionId: m.transactionId, occurredAt: m.occurredAt };
}

function convertEntry(raw: RawLogbookEntry): LogbookEntry {
  return {
    id: raw.id,
    claim: convertClaim(raw.claim),
    recordedAt: raw.recordedAt,
    recordedByTransaction: fromOpt(raw.recordedByTransaction),
    evidence: unitKey<LogbookEvidence>(raw.evidence),
  };
}

export function convertLogbook(raw: RawLogbookView): Logbook {
  return {
    uprn: raw.uprn,
    owner: raw.owner.toText(),
    createdAt: raw.createdAt,
    entries: raw.entries.map(convertEntry),
  };
}

// ---- Service ----

export type MyLogbooksResult = { status: 'ok'; logbooks: Logbook[] } | { status: 'unavailable' };

/**
 * The caller's logbooks. Degrades to 'unavailable' — never throws — when the
 * canister id env var is unset (canister not yet on mainnet) or the query
 * fails. The env var is read at call time, not import time, so it reflects
 * the environment per call and stays testable via `vi.stubEnv`.
 */
export async function getMyLogbooks(): Promise<MyLogbooksResult> {
  const envId = import.meta.env.VITE_LOGBOOK_CANISTER_ID as string | undefined;
  const canisterId = envId === undefined ? MAINNET_LOGBOOK_CANISTER_ID : envId;
  if (!canisterId) return { status: 'unavailable' };
  try {
    await icpService.initialize();
    // getMyLogbooks is caller-scoped, so reuse the authenticated agent
    // (II delegation or Supabase-derived key) rather than a fresh anon one.
    const authAgent = await icpService.getAuthenticatedAgent();
    const agent = authAgent ?? new HttpAgent({ host: IC_HOST });
    const actor = Actor.createActor<LogbookActor>(logbookIdlFactory, { agent, canisterId });
    const raw = await actor.getMyLogbooks();
    return { status: 'ok', logbooks: raw.map(convertLogbook) };
  } catch (err) {
    logger.warn('[logbook] getMyLogbooks failed; showing unavailable state', err);
    return { status: 'unavailable' };
  }
}
