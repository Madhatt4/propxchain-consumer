// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

// Which regulator a conveyancer_panel firm answers to, and its number there.
// The panel holds CLC firms (clc_id) and SRA firms (sra_number); `regulator`
// says which number is the firm's own, and the database guarantees it is
// present (monorepo migration 20261116120000_conveyancer_panel_sra_firms).
// A row read before that column existed carries no regulator and is CLC.

export type Regulator = 'CLC' | 'SRA';

export interface RegulatedFirmRow {
  regulator?: Regulator | null;
  clc_id?: string | null;
  sra_number?: string | null;
}

export interface RegulatorNumber {
  regulator: Regulator;
  number: string;
}

/** The SRA asks re-publishers of its register data to link to this statement. */
export const SRA_ATTRIBUTION_URL = 'https://www.sra.org.uk/sra/how-we-work/privacy-data-information/data-sharing/attribution/';

/** The firm's own regulator and number, or null when that number is missing. */
export function regulatorNumber(row: RegulatedFirmRow): RegulatorNumber | null {
  const regulator: Regulator = row.regulator === 'SRA' ? 'SRA' : 'CLC';
  const number = (regulator === 'SRA' ? row.sra_number : row.clc_id)?.trim() ?? '';
  return number === '' ? null : { regulator, number };
}

/** "SRA 654648" / "CLC 1234567", or null when the firm's own number is missing. */
export function registrationText(row: RegulatedFirmRow): string | null {
  const reg = regulatorNumber(row);
  return reg ? `${reg.regulator} ${reg.number}` : null;
}

/** "SRA #654648" / "CLC #1234567" — the regulated line on a provider card. */
export function regulatedLabel(row: RegulatedFirmRow): string {
  const reg = regulatorNumber(row);
  if (!reg) return row.regulator === 'SRA' ? 'SRA regulated' : 'CLC regulated';
  return `${reg.regulator} #${reg.number}`;
}

/** True when any firm shown is SRA regulated, so the SRA must be credited on screen. */
export function showsSraFirm(firms: Array<Pick<RegulatedFirmRow, 'regulator'>>): boolean {
  return firms.some((f) => f.regulator === 'SRA');
}
