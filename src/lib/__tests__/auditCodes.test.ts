// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect } from 'vitest';

import { AUDIT_CODES, auditLogHash, describeAuditCode, isAuditCode, shortLogHash } from '../auditCodes';

const P = 'rrkah-fqaaa-aaaaa-aaaaq-cai';
const HASH = 'ab'.repeat(32);

// One example of every code, exactly as the canisters write it, and the
// sentence it reads as. A code with no row here fails the coverage test.
const CASES: Array<[string, string]> = [
  ['logbook_not_configured', 'Property logbook not created: the logbook service is not set up'],
  ['logbook_no_uprn', 'Property logbook not created: no valid UPRN on the TA6 (section 1)'],
  ['logbook_no_valid_claims', "Property logbook not created: no fact passed the logbook's checks"],
  ['logbook_created|7', 'Property logbook created with 7 entries'],
  ['logbook_sale_recorded|3', 'Property logbook updated with 3 entries and passed to the buyer'],
  ['logbook_sale_not_recorded', 'Property logbook: the sale could not be recorded'],
  ['logbook_call_failed', 'Property logbook could not be reached'],
  ['tx_created', 'Transaction created'],
  ['tx_deleted_by_seller', 'Transaction deleted by the seller'],
  ['tx_force_deleted', 'Transaction deleted by an admin'],
  ['exchange_signed|buyer', 'Exchange signed for the buyer side; waiting for the seller side'],
  ['contracts_exchanged', 'Contracts exchanged'],
  ['party_signed|seller', 'Seller signed the transaction'],
  ['keys_released|agent', "Keys released, confirmed by the seller's agent"],
  ['deposit_sent|2026-11-10',
    "Deposit sent by the buyer's conveyancer on 2026-11-10 (recorded only; PropXchain does not hold or move money)"],
  ['lr_application_recorded', "Registration application submitted to HM Land Registry by the buyer's conveyancer"],
  ['completion_side_confirmed|buyer|conveyancer|waiting',
    "Completion confirmed for the buyer side by the buyer's conveyancer; waiting for the seller side"],
  ['completed_on_chain', 'Transaction completed on blockchain'],
  ['registration_awaited', "Awaiting registration application from the buyer's conveyancer"],
  ['solicitor_assigned', 'Solicitor assigned'],
  ['solicitor_removed', 'Solicitor removed'],
  ['conveyancer_joined_quote|seller', 'Conveyancer joined via accepted estimate, acting for seller'],
  ['buyer_assigned', 'Buyer assigned'],
  ['buyer_joined_with_code', "Buyer joined with the deal's invite code; the code was replaced"],
  ['buyer_join_refused_taken', 'A buyer join with the invite code was refused: the deal already has a buyer'],
  ['buyer_removed', 'Buyer removed from the deal'],
  [`party_left|${P}`, `${P} left the transaction`],
  ['party_added', 'Party added'],
  ['party_removed', 'Party removed'],
  ['seller_handed_over', 'Seller slot handed from the agent to the invited seller; the agent acts for them'],
  ['bot_connected', 'Bot connected by a participant'],
  ['bot_disconnected', 'Bot disconnected from transaction'],
  ['wiring_changed|setLedgerManagerCanister', 'Canister wiring changed (setLedgerManagerCanister)'],
  [`doc_registered|completion_statement|${P}`, `Document completion_statement registered by ${P}`],
  [`member_doc_recorded|${P}`, `Checklist document recorded for ${P}`],
  ['listing_stored', 'Listing data stored'],
  ['listing_updated', 'Listing data updated'],
  ['title_number_updated', 'Title number updated'],
  ['hmlr_register_fetched', 'HMLR title register fetched'],
  ['pdtf_exported', 'PDTF claim set exported'],
  ['pdtf_imported', 'PDTF claim set imported'],
  [`form_uploaded|ta6|${P}`, `TA6 form PDF uploaded by ${P}`],
  [`form_upload_withdrawn|ta10|${P}`, `TA10 form PDF upload withdrawn by ${P}`],
  [`doc_fact_confirmed|${P}`, `Document fact confirmed by ${P}`],
  [`doc_fact_rejected|${P}`, `Document fact suggestion rejected by ${P}`],
  [`ta6_updated|v6_2026_10_06|${P}`, `TA6 (v6_2026_10_06) updated by ${P}`],
  [`ta6_wording_acknowledged|v6_2026_10_06|${P}`, `TA6 (v6_2026_10_06) official Law Society wording acknowledged by ${P}`],
  [`ta7_updated|${P}`, `TA7 Leasehold Information Form updated by ${P}`],
  [`ta10_updated|${P}`, `TA10 Fittings and Contents Form updated by ${P}`],
  [`cross_reference_run|4|${P}`, `TA6 cross-reference run (4 anomalies) by ${P}`],
  [`quote_requested|${P}`, `Estimate requested from a conveyancer by ${P}`],
  ['quote_received', 'Estimate received from a conveyancer'],
  [`conveyancer_selected|${P}`, `Conveyancer selected by ${P}`],
  [`doc_shared|${P}`, `Document shared with a party by ${P}`],
  [`doc_share_revoked|${P}`, `Document share revoked by ${P}`],
  ['bank_warning_shown', 'Bank-detail warning shown to a recipient of a message'],
  ['property_attested', 'Property details attested'],
];

describe('describeAuditCode', () => {
  it.each(CASES)('should say %s in words', (details, sentence) => {
    expect(describeAuditCode(details)).toBe(sentence);
    expect(isAuditCode(details)).toBe(true);
  });

  it('should have an example for every code it knows', () => {
    const covered = new Set(CASES.map(([details]) => details.split('|')[0]));
    expect(Object.keys(AUDIT_CODES).filter((code) => !covered.has(code))).toEqual([]);
  });

  it('should read the variants of the codes that take a choice', () => {
    expect(describeAuditCode('contracts_exchanged|both_signed')).toBe('Both parties signed; contracts exchanged');
    expect(describeAuditCode('keys_released|seller')).toBe('Keys released, confirmed by the seller');
    expect(describeAuditCode('completion_side_confirmed|seller|client|both'))
      .toBe('Completion client-confirmed by the seller, not verified by a conveyancer; both sides confirmed');
    expect(describeAuditCode('exchange_signed|seller')).toBe('Exchange signed for the seller side; waiting for the buyer side');
  });

  it.each([
    ['an older event sentence', 'Transaction created for 1 High Street'],
    ['an older completion statement sentence', `Document completion_statement registered by ${P}`],
    ['an unknown code', 'something_new|1'],
    ['a known code with too few values', 'doc_registered|completion_statement'],
    ['a known code with too many values', `party_left|${P}|extra`],
    ['a known code with an empty value', 'logbook_created|'],
    ['a fixed code with a value', 'tx_created|x'],
    ['a side code with an unknown side', 'exchange_signed|both'],
    ['an empty string', ''],
  ])('should return %s unchanged', (_label, details) => {
    expect(describeAuditCode(details)).toBe(details);
    expect(isAuditCode(details)).toBe(false);
  });
});

describe('auditLogHash', () => {
  it('should read the hash from an older document log entry', () => {
    expect(auditLogHash(`Hash: ${HASH}, Type: completion_statement`)).toBe(HASH);
  });

  it('should read the hash from a code-form entry', () => {
    expect(auditLogHash(`hash=${HASH};docType=epc`)).toBe(HASH);
    expect(auditLogHash(`docType=epc;docHash=${HASH}`)).toBe(HASH);
  });

  it.each([
    ['no hash', 'Type: epc'],
    ['a hash key inside another word', `filehash=${HASH}`],
    ['not a string', undefined],
  ])('should return null for %s', (_label, metadata) => {
    expect(auditLogHash(metadata)).toBeNull();
  });

  it('should shorten the hash for a log line, and give nothing when there is none', () => {
    expect(shortLogHash(`Hash: ${HASH}`)).toBe(`${HASH.slice(0, 16)}...`);
    expect(shortLogHash('Type: epc')).toBeUndefined();
  });
});
