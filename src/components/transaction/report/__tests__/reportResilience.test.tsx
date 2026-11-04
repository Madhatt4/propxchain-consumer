// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { ReportMap } from '../ReportMap';

// A map library that throws at render, as Leaflet can on an odd geometry.
vi.mock('../../../property/PropertyMap', () => ({
  default: () => {
    throw new Error('leaflet failed');
  },
}));

describe('ReportMap', () => {
  it('should fall back to a note instead of taking the report down when the map throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <div>
        <p>Report text</p>
        <ReportMap lat={52} lng={-0.3} label="SG19 1AB" geometry={null} datasets={[]} variant="street" caption="The plot and its roads." />
      </div>,
    );

    expect(await screen.findByText('The map couldn’t load here.')).toBeInTheDocument();
    expect(screen.getByText('Report text')).toBeInTheDocument();
    expect(screen.getByText('The plot and its roads.')).toBeInTheDocument();
  });
});
