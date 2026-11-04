// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

import { HeroAddressCheck } from '../HeroAddressCheck';

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

function check(houseNumber: string, postcode: string): void {
  fireEvent.change(screen.getByLabelText('House name or number'), { target: { value: houseNumber } });
  fireEvent.change(screen.getByLabelText('Postcode'), { target: { value: postcode } });
  fireEvent.click(screen.getByRole('button', { name: 'Check this property' }));
}

describe('HeroAddressCheck', () => {
  it('should open the property check carrying the address in router state, not the URL', () => {
    renderHeroBox();

    check(' 14a ', 'sg19 1ab');

    const landed = screen.getByTestId('landed');
    expect(landed).toHaveAttribute('data-path', '/property-check');
    expect(landed).toHaveAttribute('data-search', '');
    expect(JSON.parse(landed.textContent ?? '{}')).toEqual({
      address: { houseNumber: '14a', postcode: 'SG19 1AB' },
    });
  });

  it('should stay on the homepage and explain when the postcode is incomplete', () => {
    renderHeroBox();

    check('14a', 'SG19');

    expect(screen.getByRole('alert').textContent).toContain('full UK postcode');
    expect(screen.queryByTestId('landed')).not.toBeInTheDocument();
  });
});
