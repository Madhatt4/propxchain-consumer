// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

import { checkTypedAddress } from '@/components/property/__tests__/addressCheckDriver';
import { ThemeProvider } from '@/contexts/ThemeContext';

import PropertyCheckSpokePage, { type SpokeKey } from '../PropertyCheckSpokePage';
import { FLOOD_RISK_SPOKE, HERITAGE_SPOKE } from '../marketing/propertyCheckSpokesData';

// No homes listed, so the form takes the typed house-number route.
vi.mock('@/services/epc.service', () => ({ listPostcodeAddresses: async () => [] }));

function Landed(): JSX.Element {
  const location = useLocation();
  return (
    <div data-testid="landed" data-search={location.search}>
      {JSON.stringify(location.state)}
    </div>
  );
}

function renderSpoke(topic: SpokeKey): void {
  render(
    <MemoryRouter initialEntries={['/spoke']}>
      <ThemeProvider>
        <Routes>
          <Route path="/spoke" element={<PropertyCheckSpokePage topic={topic} />} />
          <Route path="/property-check" element={<Landed />} />
        </Routes>
      </ThemeProvider>
    </MemoryRouter>,
  );
}

describe.each([
  ['flood', FLOOD_RISK_SPOKE],
  ['heritage', HERITAGE_SPOKE],
] as const)('PropertyCheckSpokePage (%s)', (topic, spoke) => {
  it('should render the shared heading, every section and every FAQ', () => {
    renderSpoke(topic);

    expect(screen.getByRole('heading', { level: 1, name: spoke.h1 })).toBeInTheDocument();
    for (const section of spoke.sections) {
      expect(screen.getByRole('heading', { level: 2, name: section.heading })).toBeInTheDocument();
    }
    for (const faq of spoke.faqs) {
      expect(screen.getByRole('heading', { level: 3, name: faq.q })).toBeInTheDocument();
    }
  });

  it('should hand the address to the full check in router state, not the URL', async () => {
    renderSpoke(topic);

    await checkTypedAddress('14a', 'sg19 1ab');

    const landed = await screen.findByTestId('landed');
    expect(landed).toHaveAttribute('data-search', '');
    expect(JSON.parse(landed.textContent ?? '{}')).toEqual({
      address: { houseNumber: '14a', postcode: 'SG19 1AB' },
    });
  });

  it('should link to the full free property check', () => {
    renderSpoke(topic);

    expect(screen.getByRole('link', { name: 'See the full free property check' })).toHaveAttribute(
      'href',
      '/property-check',
    );
  });
});
