// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

const SALE_EVENT_SENTENCES: Readonly<Record<string, string>> = {
  instruction_taken: 'Estate agent instructed; the terms are recorded as a fingerprint',
  offer_accepted: 'Offer accepted by the seller',
  memorandum_issued: 'Memorandum of sale issued',
  sale_fell_through: 'Sale fell through',
};
const PRICE_CHANGED = 'price_changed';
const PRICE_BASIS_LABELS: Readonly<Record<string, string>> = { asking: 'Asking price', agreed: 'Agreed price' };
const POUNDS = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 });

function field(metadata: string, key: string): string | null {
  const pair = metadata.split(';').find((part) => part.startsWith(`${key}=`));
  return pair ? pair.slice(key.length + 1) : null;
}

function priceSentence(metadata: string | null | undefined): string | null {
  if (!metadata) return null;
  const label = PRICE_BASIS_LABELS[field(metadata, 'basis') ?? ''];
  const amount = field(metadata, 'amount_gbp') ?? '';
  if (!label || !/^[1-9]\d*$/.test(amount)) return null;
  return `${label} set to ${POUNDS.format(Number(amount))}`;
}

export function describeSaleEvent(eventType: string, metadata?: string | null): string | null {
  if (eventType === PRICE_CHANGED) return priceSentence(metadata);
  return SALE_EVENT_SENTENCES[eventType] ?? null;
}
