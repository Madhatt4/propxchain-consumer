// TA6 6th edition: scalar/leaf conversions shared by the section mappers,
// in both directions (UI <-> candid). Conventions:
//   null <-> [] (candid opt)      pence number <-> bigint
//   ISO timestamp <-> bigint ns   documentId string <-> Attached bigint
//   '' details <-> empty optional (the UI keeps '' for "no details")

import {
  ANSWER_TO_CANDID,
  ANSWER_FROM_TAG,
  DOCUMENT_STATUS_TO_CANDID,
  DOCUMENT_STATUS_FROM_TAG,
  candidVariantTag,
} from './ta6CandidVariants';

import type {
  TA6AnswerValue,
  TA6DocumentStatus,
  TA6DocumentValue,
  TA6ResponseValue,
  TA6Right,
  TA6WarrantyItem,
} from '../../types/ta6.types';
import type {
  CandidOpt,
  CandidRight,
  CandidTA6Answer,
  CandidTA6Document,
  CandidTA6Response,
  CandidWarrantyItem,
} from './ta6Candid.types';

// ---------- UI -> candid ----------

export function toCandidOpt<T>(value: T | null): CandidOpt<T> {
  return value === null ? [] : [value];
}

export function toCandidOptMap<T, U>(value: T | null, map: (v: T) => U): CandidOpt<U> {
  return value === null ? [] : [map(value)];
}

export function toCandidPence(value: number | null): CandidOpt<bigint> {
  return value === null ? [] : [BigInt(value)];
}

export function isoToNs(iso: string): bigint {
  return BigInt(new Date(iso).getTime()) * BigInt(1_000_000);
}

export function toCandidAnswer(value: TA6AnswerValue): CandidTA6Answer {
  return ANSWER_TO_CANDID[value];
}

export function toCandidResponse(value: TA6ResponseValue): CandidTA6Response {
  return {
    answer: toCandidAnswer(value.answer),
    details: value.details === '' ? [] : [value.details],
  };
}

export function toCandidDocument(value: TA6DocumentValue): CandidTA6Document {
  if (value.status === 'attached') {
    if (value.documentId === null) {
      throw new Error('TA6 document slot marked attached without a documentId');
    }
    return { Attached: BigInt(value.documentId) };
  }
  return DOCUMENT_STATUS_TO_CANDID[value.status];
}

export function toCandidWarranty(value: TA6WarrantyItem): CandidWarrantyItem {
  return { present: toCandidAnswer(value.present), document: toCandidDocument(value.document) };
}

export function toCandidRight(value: TA6Right): CandidRight {
  return { description: value.description, overProperty: toCandidOpt(value.overProperty) };
}

// ---------- candid -> UI ----------

export function fromCandidOpt<T>(opt: CandidOpt<T>): T | null {
  return opt.length === 0 ? null : opt[0];
}

export function fromCandidOptMap<T, U>(opt: CandidOpt<T>, map: (v: T) => U): U | null {
  return opt.length === 0 ? null : map(opt[0]);
}

export function fromCandidPence(opt: CandidOpt<bigint>): number | null {
  return opt.length === 0 ? null : Number(opt[0]);
}

export function nsToIso(ns: bigint): string {
  return new Date(Number(ns) / 1_000_000).toISOString();
}

export function fromCandidAnswer(value: CandidTA6Answer): TA6AnswerValue {
  return ANSWER_FROM_TAG[candidVariantTag(value)];
}

export function fromCandidResponse(value: CandidTA6Response): TA6ResponseValue {
  return {
    answer: fromCandidAnswer(value.answer),
    details: value.details.length === 0 ? '' : value.details[0],
  };
}

export function fromCandidDocument(value: CandidTA6Document): TA6DocumentValue {
  if ('Attached' in value) {
    return { status: 'attached', documentId: value.Attached.toString() };
  }
  const status: TA6DocumentStatus = DOCUMENT_STATUS_FROM_TAG[candidVariantTag(value)];
  return { status, documentId: null };
}

export function fromCandidWarranty(value: CandidWarrantyItem): TA6WarrantyItem {
  return { present: fromCandidAnswer(value.present), document: fromCandidDocument(value.document) };
}

export function fromCandidRight(value: CandidRight): TA6Right {
  return { description: value.description, overProperty: fromCandidOpt(value.overProperty) };
}
