// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { FreeReportSection } from '../FreeReportSection';

/**
 * The homepage card no longer gates the report behind a form: it shows the
 * seller tour and sends people to the ungated check at /property-check.
 */
function renderSection(): HTMLElement {
  const { container } = render(
    <MemoryRouter>
      <FreeReportSection />
    </MemoryRouter>,
  );
  return container;
}

describe('FreeReportSection', () => {
  it('should keep the #report anchor that the hero and pricing CTAs scroll to', () => {
    const container = renderSection();

    expect(container.querySelector('section#report')).not.toBeNull();
  });

  it('should play the narrated seller tour without preloading it', () => {
    const container = renderSection();

    const video = container.querySelector('video');
    expect(video).toHaveAttribute('preload', 'none');
    expect(video).toHaveAttribute('poster', '/videos/propxchain-seller-promo-v2-poster.jpg');
    expect(container.querySelector('video source')).toHaveAttribute('src', '/videos/propxchain-seller-promo-v2.mp4');
  });

  it('should send visitors to the free property check page', () => {
    renderSection();

    expect(screen.getByRole('link', { name: 'Check a property free' })).toHaveAttribute('href', '/property-check');
  });

  it('should put the call to action above the video', () => {
    const container = renderSection();

    const link = screen.getByRole('link', { name: 'Check a property free' });
    const video = container.querySelector('video') as HTMLVideoElement;
    expect(link.compareDocumentPosition(video) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('should not ask for any personal details on the homepage', () => {
    renderSection();

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Get my free report' })).not.toBeInTheDocument();
  });

  it('should not claim England and Wales coverage the designation data does not have', () => {
    renderSection();

    expect(screen.queryByText(/Wales/)).not.toBeInTheDocument();
  });
});
