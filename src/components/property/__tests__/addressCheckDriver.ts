// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { fireEvent, screen } from '@testing-library/react';

/**
 * Drives the two-step address form the way a visitor does: postcode, Find
 * address, then either pick a listed home or type the house. Shared by every
 * page that embeds AddressCheckForm, so a change to the steps is fixed once.
 * Callers mock `listPostcodeAddresses` to decide which route the form takes.
 */

export function findAddresses(postcode: string): void {
  fireEvent.change(screen.getByLabelText('Postcode'), { target: { value: postcode } });
  fireEvent.click(screen.getByRole('button', { name: 'Find address' }));
}

/** Unlisted route: the lookup returned no homes, so the house is typed. */
export async function checkTypedAddress(houseNumber: string, postcode: string): Promise<void> {
  findAddresses(postcode);
  const house = await screen.findByLabelText('House name or number');
  fireEvent.change(house, { target: { value: houseNumber } });
  fireEvent.click(screen.getByRole('button', { name: 'Check this property' }));
}

/** Listed route: pick the home whose label matches. */
export async function checkPickedAddress(label: string, postcode: string): Promise<void> {
  findAddresses(postcode);
  const select = await screen.findByLabelText('Your address');
  const option = screen.getByRole('option', { name: label }) as HTMLOptionElement;
  fireEvent.change(select, { target: { value: option.value } });
  fireEvent.click(screen.getByRole('button', { name: 'Check this property' }));
}
