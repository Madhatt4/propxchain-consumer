// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { useState, type FormEvent } from 'react';

import { postcodeService } from '@/services/postcodeService';

import { useAddressLookup, type AddressLookup } from './useAddressLookup';

/**
 * Postcode first, then the visitor picks their home from a list. Nothing else.
 * The public property check is deliberately ungated: the report runs on free
 * open-government data, so asking for an email first only costs us the visitor.
 *
 * Why a list rather than a typed house number: a typed number cannot be tied
 * to one building, so the report fell back to the postcode's centre and the
 * map pin, flood and heritage checks could land on a neighbour. A picked home
 * carries its UPRN, which puts the pin on the house itself. The list comes from
 * the EPC register, so a home that never had a certificate is missing from it;
 * "My address isn't listed" keeps the typed route for those.
 */

export interface CheckedAddress {
  postcode: string;
  /** House name or number, or the picked home's first address line. */
  houseNumber: string;
  /** Set when the home was picked from the list. */
  uprn?: string;
}

/**
 * `page` is the light marketing-page look; `landing` uses the cinematic
 * landing page's own input and button classes so it sits in the hero.
 */
export type AddressCheckAppearance = 'page' | 'landing';

interface AddressCheckFormProps {
  onCheck: (address: CheckedAddress) => void;
  appearance?: AddressCheckAppearance;
  /** Keeps label/input ids unique when the form appears more than once. */
  idPrefix?: string;
}

const NOT_LISTED = 'not-listed';
const POSTCODE_ERROR = 'Please enter a full UK postcode, for example SG19 1AB.';

const STYLES: Record<AddressCheckAppearance, { form: string; input: string; button: string; error: string; note: string }> = {
  page: {
    form: 'mt-8',
    input:
      'w-full rounded-md border border-[#D1D5DB] bg-white px-4 py-3 font-[DM_Sans] text-base text-[#1A1A1A] placeholder:text-[#9CA3AF] focus:border-[#0D9488] focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 dark:border-[#334155] dark:bg-[#0F172A] dark:text-[#F1F5F9] dark:[color-scheme:dark] [&_option]:bg-white [&_option]:text-[#1A1A1A] dark:[&_option]:bg-[#0F172A] dark:[&_option]:text-[#F1F5F9]',
    button:
      'inline-flex min-h-12 items-center justify-center rounded-md bg-[#0D9488] px-8 py-3 font-[DM_Sans] text-base font-medium text-white transition-colors hover:bg-[#0F766E] disabled:opacity-60',
    error: 'mt-3 font-[DM_Sans] text-sm text-[#B91C1C] dark:text-[#F87171]',
    note: 'mt-3 font-[DM_Sans] text-sm text-[#4B5563] dark:text-[#CBD5E1]',
  },
  landing: {
    form: 'w-full text-left',
    input: 'cta-input w-full px-4 py-3 text-base min-h-12',
    button: 'btn-primary px-7 py-3 text-base min-h-12 disabled:opacity-60',
    error: 'mt-3 text-sm text-[#F87171]',
    note: 'mt-3 text-sm',
  },
};

interface HomeFieldProps {
  lookup: AddressLookup;
  idPrefix: string;
  inputCls: string;
  picked: string;
  onPick: (value: string) => void;
  houseNumber: string;
  onHouseNumber: (value: string) => void;
}

/** The second box: the list of homes, or a typed name or number. */
function HomeField({ lookup, idPrefix, inputCls, picked, onPick, houseNumber, onHouseNumber }: HomeFieldProps): JSX.Element {
  const typed = lookup.status === 'unlisted' || picked === NOT_LISTED;
  return (
    <div className="space-y-3">
      {lookup.status === 'listed' && (
        <div>
          <label htmlFor={`${idPrefix}-home`} className="sr-only">Your address</label>
          <select id={`${idPrefix}-home`} value={picked} onChange={(e) => onPick(e.target.value)} className={inputCls}>
            <option value="">Choose your address ({lookup.addresses.length} found)</option>
            {lookup.addresses.map((a, i) => (
              <option key={a.uprn ?? `${a.label}-${i}`} value={String(i)}>{a.label}</option>
            ))}
            <option value={NOT_LISTED}>My address isn’t listed</option>
          </select>
        </div>
      )}
      {typed && (
        <div>
          <label htmlFor={`${idPrefix}-house`} className="sr-only">House name or number</label>
          <input
            id={`${idPrefix}-house`}
            type="text"
            autoComplete="address-line1"
            value={houseNumber}
            onChange={(e) => onHouseNumber(e.target.value)}
            placeholder="House name or number"
            className={inputCls}
          />
        </div>
      )}
    </div>
  );
}

export function AddressCheckForm({
  onCheck,
  appearance = 'page',
  idPrefix = 'pc',
}: AddressCheckFormProps): JSX.Element {
  const cls = STYLES[appearance];
  const lookup = useAddressLookup();
  const [postcode, setPostcode] = useState('');
  const [picked, setPicked] = useState('');
  const [houseNumber, setHouseNumber] = useState('');
  const [error, setError] = useState<string | null>(null);

  const formatted = postcodeService.isValidPostcodeFormat(postcode) ? postcodeService.formatPostcode(postcode) : null;
  const isCurrent = formatted !== null && formatted === lookup.lookedUp;
  const isChoosing = isCurrent && (lookup.status === 'listed' || lookup.status === 'unlisted');

  const changePostcode = (value: string): void => {
    setPostcode(value);
    setPicked('');
    setError(null);
    if (lookup.status !== 'idle') lookup.reset();
  };

  const submit = (): string | null => {
    if (!formatted) return POSTCODE_ERROR;
    if (!isChoosing) {
      void lookup.find(formatted);
      return null;
    }
    const home = lookup.addresses[Number(picked)];
    if (lookup.status === 'listed' && picked !== NOT_LISTED) {
      if (!picked || !home) return 'Please choose your address from the list.';
      onCheck({ postcode: formatted, houseNumber: home.line1, ...(home.uprn ? { uprn: home.uprn } : {}) });
      return null;
    }
    if (!houseNumber.trim()) return 'Please enter the house name or number.';
    onCheck({ postcode: formatted, houseNumber: houseNumber.trim() });
    return null;
  };

  const handleSubmit = (e: FormEvent): void => {
    e.preventDefault();
    setError(submit());
  };

  const isLoading = lookup.status === 'loading';
  return (
    <form onSubmit={handleSubmit} noValidate className={cls.form} aria-label="Check a property">
      <div className={`grid gap-3 ${isChoosing ? 'sm:grid-cols-[minmax(0,10rem)_1fr_auto]' : 'sm:grid-cols-[1fr_auto]'}`}>
        <div>
          <label htmlFor={`${idPrefix}-postcode`} className="sr-only">Postcode</label>
          <input
            id={`${idPrefix}-postcode`}
            type="text"
            autoComplete="postal-code"
            value={postcode}
            onChange={(e) => changePostcode(e.target.value)}
            placeholder="Enter your postcode"
            className={cls.input}
          />
        </div>
        {isChoosing && (
          <HomeField
            lookup={lookup}
            idPrefix={idPrefix}
            inputCls={cls.input}
            picked={picked}
            onPick={setPicked}
            houseNumber={houseNumber}
            onHouseNumber={setHouseNumber}
          />
        )}
        <button type="submit" disabled={isLoading} className={`${cls.button} self-start`}>
          {isLoading ? 'Finding addresses…' : isChoosing ? 'Check this property' : 'Find address'}
        </button>
      </div>
      {isChoosing && lookup.status === 'unlisted' && (
        <p className={cls.note}>We couldn’t list the homes on this postcode. Type the house name or number instead.</p>
      )}
      {error && (
        <p role="alert" className={cls.error}>
          {error}
        </p>
      )}
    </form>
  );
}
