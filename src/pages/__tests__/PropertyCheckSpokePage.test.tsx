// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

import { ThemeProvider } from '@/contexts/ThemeContext';

import PropertyCheckSpokePage, { type SpokeKey } from '../PropertyCheckSpokePage';
import { FLOOD_RISK_SPOKE, HERITAGE_SPOKE } from '../marketing/propertyCheckSpokesData';

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

  it('should hand the address to the full check in router state, not the URL', () => {
    renderSpoke(topic);

    fireEvent.change(screen.getByLabelText('House name or number'), { target: { value: '14a' } });
    fireEvent.change(screen.getByLabelText('Postcode'), { target: { value: 'sg19 1ab' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check this property' }));

    const landed = screen.getByTestId('landed');
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
