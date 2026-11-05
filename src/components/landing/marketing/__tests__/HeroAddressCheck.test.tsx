// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

import { checkTypedAddress, findAddresses } from '@/components/property/__tests__/addressCheckDriver';

import { HeroAddressCheck } from '../HeroAddressCheck';

// No homes listed, so the form takes the typed house-number route.
vi.mock('@/services/epc.service', () => ({ listPostcodeAddresses: async () => [] }));

/** Shows where the hero sent the visitor, and what it carried. */
function Landed(): JSX.Element {
  const location = useLocation();
  return (
    <div data-testid="landed" data-path={location.pathname} data-search={location.search}>
      {JSON.stringify(location.state)}
    </div>
  );
}

function renderHeroBox(): void {
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<HeroAddressCheck />} />
        <Route path="/property-check" element={<Landed />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('HeroAddressCheck', () => {
  it('should open the property check carrying the address in router state, not the URL', async () => {
    renderHeroBox();

    await checkTypedAddress(' 14a ', 'sg19 1ab');

    const landed = await screen.findByTestId('landed');
    expect(landed).toHaveAttribute('data-path', '/property-check');
    expect(landed).toHaveAttribute('data-search', '');
    expect(JSON.parse(landed.textContent ?? '{}')).toEqual({
      address: { houseNumber: '14a', postcode: 'SG19 1AB' },
    });
  });

  it('should stay on the homepage and explain when the postcode is incomplete', () => {
    renderHeroBox();

    findAddresses('SG19');

    expect(screen.getByRole('alert').textContent).toContain('full UK postcode');
    expect(screen.queryByTestId('landed')).not.toBeInTheDocument();
  });
});
