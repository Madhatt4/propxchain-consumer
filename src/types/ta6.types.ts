// TA6 Property Information Form — 6th edition (Law Society standard form,
// mandatory for instructions on/after 30 March 2026). UI-friendly model.
//
// This tree mirrors the on-chain candid schema FIELD-FOR-FIELD (authoritative
// shape: core-client transaction_manager.did.d.ts; semantics: core
// forms_types.mo) so the icp.service.ts mapping is mechanical — every candid
// field has a UI counterpart with the SAME name (q2_3MovedOrAltered, ...).
//
// Conversion conventions (candid -> UI):
//   - variants                -> kebab-case string unions
//   - optionals ([] | [T])    -> T | null
//   - money Nats              -> number (amounts in pence; well under 2^53)
//   - documentId Nat FKs      -> string | null (stringified Nat — a Nat can
//                                exceed Number.MAX_SAFE_INTEGER)
//   - dates / timestamps      -> ISO strings
//   - Principal               -> principal text (string), so drafts survive
//                                JSON round-trips (localStorage)
//
// Question wording is licensing-sensitive (© Law Society) and lives in the
// consumer paraphrase bundle, NOT here — field names are qN_M references only.

import type {
  TA6Section1PropertyAndSeller,
  TA6Section2Boundaries,
  TA6Section3Disputes,
  TA6Section4Notices,
  TA6Section5Alterations,
  TA6Section6Guarantees,
  TA6Section7Insurance,
  TA6Section8Environmental,
  TA6Section9Rights,
  TA6Section10Parking,
  TA6Section11Services,
  TA6Section12Connections,
  TA6Section13Transaction,
  TA6Section14Completion,
  TA6Section15AdditionalInfo,
} from './ta6.sections';

// ---------- Foundational answer / document values ----------

// 'not-answered' is a DRAFT marker (question not yet reached), not a legal
// answer — the form saves per-section across sessions, so untouched questions
// must be representable without forging a 'not-known' legal statement.
export type TA6AnswerValue =
  | 'yes'
  | 'no'
  | 'not-known'
  | 'not-applicable'
  | 'not-answered';

// Most questions are an answer plus free-text elaboration. details is ?Text
// on-chain; the UI keeps '' for "no details" and the mapper sends [].
export interface TA6ResponseValue {
  answer: TA6AnswerValue;
  details: string;
}

export type TA6DocumentStatus =
  | 'attached'
  | 'to-follow'
  | 'not-applicable'
  | 'not-available'
  | 'not-answered';

// Attachment slot (candid TA6Document). documentId is the document_storage
// canister FK; it is non-null exactly when status === 'attached'.
export interface TA6DocumentValue {
  status: TA6DocumentStatus;
  documentId: string | null;
}

// Derived from postcode at form creation — several regulations diverge
// between the two (electrical install dates, sewerage discharge rules, ...).
export type TA6Jurisdiction = 'england' | 'wales';

// ---------- Shared variant vocabularies ----------

export type TA6SellerRole =
  | 'seller'
  | 'executor'
  | 'administrator'
  | 'attorney'
  | 'trustee';

export type TA6BoundaryOwnership =
  | 'owned-by-seller'
  | 'shared'
  | 'owned-by-neighbour'
  | 'not-known';

export type TA6ParkingType =
  | 'garage'
  | 'driveway'
  | 'allocated'
  | 'on-road'
  | 'permit'
  | 'none'
  | 'other';

export type TA6HeatingType =
  | 'gas-central'
  | 'oil'
  | 'lpg'
  | 'electric'
  | 'heat-pump-air'
  | 'heat-pump-ground'
  | 'solid-fuel'
  | 'solar-thermal'
  | 'district-heating'
  | 'other';

export type TA6SewerageSource =
  | 'mains'
  | 'septic-tank'
  | 'cesspool'
  | 'sewage-treatment-plant'
  | 'other';

export type TA6DischargeType = 'ground-water' | 'surface-water';

// ---------- Shared composite records ----------

// §6.1 checklist entry: answer + certificate slot per warranty type.
export interface TA6WarrantyItem {
  present: TA6AnswerValue;
  document: TA6DocumentValue;
}

// §12 grid rows. connected is yes/no on the form; the UI constrains.
export interface TA6ServiceConnection {
  connected: TA6AnswerValue;
  provider: string | null;
}

export interface TA6MeteredConnection {
  connected: TA6AnswerValue;
  provider: string | null;
  meterLocation: string | null;
  supplyNumber: string | null; // MPAN (electricity) / MPRN (gas)
}

export interface TA6WaterConnection {
  connected: TA6AnswerValue;
  provider: string | null;
  stopcockLocation: string | null;
  meterLocation: string | null;
}

export interface TA6ServicedPlantConnection {
  connected: TA6AnswerValue;
  provider: string | null;
  makeModel: string | null;
  serviceProvider: string | null;
}

// ---------- Master record ----------

export interface TA6PropertyInformation {
  // Canister-stamped discriminator (ADR 0007): the client sends
  // TA6_FORM_VERSION but the canister overwrites it — it cannot be forged.
  formVersion: string;
  jurisdiction: TA6Jurisdiction;

  section1: TA6Section1PropertyAndSeller;
  section2: TA6Section2Boundaries;
  section3: TA6Section3Disputes;
  section4: TA6Section4Notices;
  section5: TA6Section5Alterations;
  section6: TA6Section6Guarantees;
  section7: TA6Section7Insurance;
  section8: TA6Section8Environmental;
  section9: TA6Section9Rights;
  section10: TA6Section10Parking;
  section11: TA6Section11Services;
  section12: TA6Section12Connections;
  section13: TA6Section13Transaction;
  section14: TA6Section14Completion;
  section15: TA6Section15AdditionalInfo;

  // Canister stamps these from the authenticated caller + Time.now.
  completedBy: string; // principal text
  completedAt: string | null; // ISO timestamp
  lastModifiedBy: string; // principal text
  lastModifiedAt: string; // ISO timestamp
}

// Section interfaces + section-specific supporting records.
export * from './ta6.sections';

// Compatibility re-exports — existing code imports these from ta6.types.
export {
  TA6_FORM_VERSION,
  emptyTA6Form,
  emptyResponse,
  emptyDocument,
  calculateTA6Completion,
} from './ta6.defaults';
