// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The audit trail is permanent, so the canisters write it as codes and ids,
 * never sentences (ADR 0019 phase 1 step 1c): `details` is a code, then `|`
 * and the event's values, e.g. `doc_registered|completion_statement|<principal>`.
 * This turns a code into the sentence a person reads.
 *
 * The codes are a closed set defined in the monorepo's
 * packages/core/src/transaction_manager/audit_codes.mo, plus two written by
 * other canisters (bank_warning_shown, property_attested). Events written
 * before the codes existed carry a sentence and stay on the trail until the
 * phase-5 reinstall: anything that is not a known code with the right number
 * of values is returned unchanged, so those still read as they always did.
 */

type Render = (values: string[]) => string;

interface CodeSpec {
  /** How many `|` values follow the code. */
  arity: number;
  render: Render;
}

const SIDES = new Set(['buyer', 'seller']);
const FORM_NAMES: Record<string, string> = { ta6: 'TA6', ta7: 'TA7', ta10: 'TA10' };

function otherSide(side: string): string {
  return side === 'buyer' ? 'seller' : 'buyer';
}

function formName(form: string): string {
  return FORM_NAMES[form] ?? form;
}

function capitalise(word: string): string {
  return word.length > 0 ? word[0].toUpperCase() + word.slice(1) : word;
}

function completionSide([side, by, state]: string[]): string {
  const how = by === 'conveyancer'
    ? `Completion confirmed for the ${side} side by the ${side}'s conveyancer`
    : `Completion client-confirmed by the ${side}, not verified by a conveyancer`;
  return state === 'both' ? `${how}; both sides confirmed` : `${how}; waiting for the ${otherSide(side)} side`;
}

const fixed = (sentence: string): CodeSpec => ({ arity: 0, render: () => sentence });
const one = (render: Render): CodeSpec => ({ arity: 1, render });
const two = (render: Render): CodeSpec => ({ arity: 2, render });

export const AUDIT_CODES: Readonly<Record<string, CodeSpec>> = {
  logbook_not_configured: fixed('Property logbook not created: the logbook service is not set up'),
  logbook_no_uprn: fixed('Property logbook not created: no valid UPRN on the TA6 (section 1)'),
  logbook_no_valid_claims: fixed("Property logbook not created: no fact passed the logbook's checks"),
  logbook_created: one(([n]) => `Property logbook created with ${n} entries`),
  logbook_sale_recorded: one(([n]) => `Property logbook updated with ${n} entries and passed to the buyer`),
  logbook_sale_not_recorded: fixed('Property logbook: the sale could not be recorded'),
  logbook_call_failed: fixed('Property logbook could not be reached'),
  tx_created: fixed('Transaction created'),
  price_changed: fixed('Price changed'),
  tx_deleted_by_seller: fixed('Transaction deleted by the seller'),
  tx_force_deleted: fixed('Transaction deleted by an admin'),
  exchange_signed: one(([side]) => `Exchange signed for the ${side} side; waiting for the ${otherSide(side)} side`),
  contracts_exchanged: fixed('Contracts exchanged'),
  party_signed: one(([role]) => `${capitalise(role)} signed the transaction`),
  keys_released: one(([by]) => (by === 'agent'
    ? "Keys released, confirmed by the seller's agent"
    : 'Keys released, confirmed by the seller')),
  deposit_sent: one(([date]) =>
    `Deposit sent by the buyer's conveyancer on ${date} (recorded only; PropXchain does not hold or move money)`),
  lr_application_recorded: fixed("Registration application submitted to HM Land Registry by the buyer's conveyancer"),
  completion_side_confirmed: { arity: 3, render: completionSide },
  completed_on_chain: fixed('Transaction completed on blockchain'),
  registration_awaited: fixed("Awaiting registration application from the buyer's conveyancer"),
  solicitor_assigned: fixed('Solicitor assigned'),
  solicitor_removed: fixed('Solicitor removed'),
  conveyancer_joined_quote: one(([side]) => `Conveyancer joined via accepted estimate, acting for ${side}`),
  buyer_assigned: fixed('Buyer assigned'),
  buyer_joined_with_code: fixed("Buyer joined with the deal's invite code; the code was replaced"),
  buyer_join_refused_taken: fixed('A buyer join with the invite code was refused: the deal already has a buyer'),
  buyer_removed: fixed('Buyer removed from the deal'),
  party_left: one(([who]) => `${who} left the transaction`),
  party_added: fixed('Party added'),
  party_removed: fixed('Party removed'),
  seller_handed_over: fixed('Seller slot handed from the agent to the invited seller; the agent acts for them'),
  bot_connected: fixed('Bot connected by a participant'),
  bot_disconnected: fixed('Bot disconnected from transaction'),
  wiring_changed: one(([setter]) => `Canister wiring changed (${setter})`),
  doc_registered: two(([docType, by]) => `Document ${docType} registered by ${by}`),
  member_doc_recorded: one(([member]) => `Checklist document recorded for ${member}`),
  listing_stored: fixed('Listing data stored'),
  listing_updated: fixed('Listing data updated'),
  title_number_updated: fixed('Title number updated'),
  hmlr_register_fetched: fixed('HMLR title register fetched'),
  pdtf_exported: fixed('PDTF claim set exported'),
  pdtf_imported: fixed('PDTF claim set imported'),
  form_uploaded: two(([form, by]) => `${formName(form)} form PDF uploaded by ${by}`),
  form_upload_withdrawn: two(([form, by]) => `${formName(form)} form PDF upload withdrawn by ${by}`),
  doc_fact_confirmed: one(([by]) => `Document fact confirmed by ${by}`),
  doc_fact_rejected: one(([by]) => `Document fact suggestion rejected by ${by}`),
  ta6_updated: two(([version, by]) => `TA6 (${version}) updated by ${by}`),
  ta6_wording_acknowledged: two(([version, by]) =>
    `TA6 (${version}) official Law Society wording acknowledged by ${by}`),
  ta7_updated: one(([by]) => `TA7 Leasehold Information Form updated by ${by}`),
  ta10_updated: one(([by]) => `TA10 Fittings and Contents Form updated by ${by}`),
  cross_reference_run: two(([n, by]) => `TA6 cross-reference run (${n} anomalies) by ${by}`),
  quote_requested: one(([by]) => `Estimate requested from a conveyancer by ${by}`),
  quote_received: fixed('Estimate received from a conveyancer'),
  conveyancer_selected: one(([by]) => `Conveyancer selected by ${by}`),
  doc_shared: one(([by]) => `Document shared with a party by ${by}`),
  doc_share_revoked: one(([by]) => `Document share revoked by ${by}`),
  bank_warning_shown: fixed('Bank-detail warning shown to a recipient of a message'),
  property_attested: fixed('Property details attested'),
};

/** Codes whose payload must be a known side, checked before rendering. */
const SIDE_CODES = new Set(['exchange_signed', 'conveyancer_joined_quote', 'completion_side_confirmed']);

/** `contracts_exchanged|both_signed` is the one code with an optional value. */
function contractsExchangedBoth(details: string): string | null {
  return details === 'contracts_exchanged|both_signed' ? 'Both parties signed; contracts exchanged' : null;
}

/**
 * The sentence for an audit event's details, or the details unchanged when
 * they are not a known code (an older event's sentence, or a code this build
 * does not know yet).
 */
export function describeAuditCode(details: string): string {
  const both = contractsExchangedBoth(details);
  if (both) return both;
  const [code, ...values] = details.split('|');
  const spec = AUDIT_CODES[code];
  if (!spec || values.length !== spec.arity || values.some((v) => v.length === 0)) return details;
  if (SIDE_CODES.has(code) && !SIDES.has(values[0])) return details;
  return spec.render(values);
}

/** True when the details are in the code form rather than an older sentence. */
export function isAuditCode(details: string): boolean {
  return describeAuditCode(details) !== details;
}

const LOG_HASH_LEGACY = /(?:^|[\s,;])Hash: ([a-f0-9]+)/;
const LOG_HASH_FIELD = /(?:^|;)\s*(?:doc)?[hH]ash=([a-f0-9]+)(?:;|$)/;

/**
 * The file hash in a document_storage audit log's metadata. Its older entries
 * read `Hash: <hex>, Type: <type>`; entries in the code form carry it as a
 * `hash=` or `docHash=` field. Null when neither is there.
 */
export function auditLogHash(metadata: unknown): string | null {
  if (typeof metadata !== 'string') return null;
  return (LOG_HASH_LEGACY.exec(metadata) ?? LOG_HASH_FIELD.exec(metadata))?.[1] ?? null;
}

/** The first 16 characters of that hash for a log line, or undefined when there is none. */
export function shortLogHash(metadata: unknown): string | undefined {
  const hash = auditLogHash(metadata);
  return hash ? `${hash.slice(0, 16)}...` : undefined;
}
