// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import type { PostcodeAddress } from '@/services/epc.service';

import { AddressCheckForm } from '../AddressCheckForm';

import { checkPickedAddress, checkTypedAddress, findAddresses } from './addressCheckDriver';

const mockList = vi.fn<(postcode: string) => Promise<PostcodeAddress[] | null>>();
vi.mock('@/services/epc.service', () => ({
  listPostcodeAddresses: (postcode: string) => mockList(postcode),
}));

const HOMES: PostcodeAddress[] = [
  { label: '12 Mill Lane', line1: '12 Mill Lane', uprn: '100012345678' },
  { label: 'Rose Cottage, Mill Lane', line1: 'Rose Cottage', uprn: null },
];

function renderForm(): ReturnType<typeof vi.fn> {
  const onCheck = vi.fn();
  render(<AddressCheckForm onCheck={onCheck} />);
  return onCheck;
}

describe('AddressCheckForm', () => {
  beforeEach(() => {
    mockList.mockReset();
  });

  it('should list the homes on the postcode and hand over the picked UPRN', async () => {
    mockList.mockResolvedValue(HOMES);
    const onCheck = renderForm();

    await checkPickedAddress('12 Mill Lane', 'sg19 1ab');

    expect(mockList).toHaveBeenCalledWith('SG19 1AB');
    expect(screen.getByRole('option', { name: 'Choose your address (2 found)' })).toBeInTheDocument();
    expect(onCheck).toHaveBeenCalledWith({ postcode: 'SG19 1AB', houseNumber: '12 Mill Lane', uprn: '100012345678' });
  });

  it('should hand over a picked home without a UPRN as its first address line only', async () => {
    mockList.mockResolvedValue(HOMES);
    const onCheck = renderForm();

    await checkPickedAddress('Rose Cottage, Mill Lane', 'SG19 1AB');

    expect(onCheck).toHaveBeenCalledWith({ postcode: 'SG19 1AB', houseNumber: 'Rose Cottage' });
  });

  it('should ask the visitor to choose before checking', async () => {
    mockList.mockResolvedValue(HOMES);
    const onCheck = renderForm();
    findAddresses('SG19 1AB');
    await screen.findByLabelText('Your address');

    fireEvent.click(screen.getByRole('button', { name: 'Check this property' }));

    expect(screen.getByRole('alert').textContent).toContain('choose your address');
    expect(onCheck).not.toHaveBeenCalled();
  });

  it('should let the visitor type the house when theirs is not listed', async () => {
    mockList.mockResolvedValue(HOMES);
    const onCheck = renderForm();
    findAddresses('SG19 1AB');
    fireEvent.change(await screen.findByLabelText('Your address'), { target: { value: 'not-listed' } });

    fireEvent.change(screen.getByLabelText('House name or number'), { target: { value: ' 14a ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check this property' }));

    expect(onCheck).toHaveBeenCalledWith({ postcode: 'SG19 1AB', houseNumber: '14a' });
  });

  it('should fall back to typing the house when the lookup fails', async () => {
    mockList.mockResolvedValue(null);
    const onCheck = renderForm();

    await checkTypedAddress('14a', 'SG19 1AB');

    expect(screen.getByText(/couldn’t list the homes/)).toBeInTheDocument();
    expect(onCheck).toHaveBeenCalledWith({ postcode: 'SG19 1AB', houseNumber: '14a' });
  });

  it('should reject a partial postcode without looking anything up', () => {
    renderForm();

    findAddresses('SG19');

    expect(screen.getByRole('alert').textContent).toContain('full UK postcode');
    expect(mockList).not.toHaveBeenCalled();
  });

  it('should drop the list when the postcode changes', async () => {
    mockList.mockResolvedValue(HOMES);
    renderForm();
    findAddresses('SG19 1AB');
    await screen.findByLabelText('Your address');

    fireEvent.change(screen.getByLabelText('Postcode'), { target: { value: 'SG18 0AA' } });

    await waitFor(() => expect(screen.queryByLabelText('Your address')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Find address' })).toBeInTheDocument();
  });

  it('should ignore a slow answer for a postcode that is no longer in the box', async () => {
    let answerFirst: (list: PostcodeAddress[]) => void = () => undefined;
    mockList.mockImplementationOnce(() => new Promise((resolve) => { answerFirst = resolve; }));
    mockList.mockResolvedValueOnce([]);
    renderForm();
    findAddresses('SG19 1AB');
    findAddresses('SG18 0AA');
    await screen.findByLabelText('House name or number');

    answerFirst(HOMES);

    await waitFor(() => expect(screen.queryByLabelText('Your address')).not.toBeInTheDocument());
  });
});
