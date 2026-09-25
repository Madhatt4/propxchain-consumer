// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ChatTurn } from '../conversation';
import SupportChatMessage from '../SupportChatMessage';

function renderTurn(turn: Partial<ChatTurn>): void {
  render(
    <MemoryRouter>
      <ul>
        <SupportChatMessage turn={{ id: 't1', role: 'assistant', text: 'Here is the answer.', ...turn }} />
      </ul>
    </MemoryRouter>,
  );
}

describe('SupportChatMessage', () => {
  it('should link a source that is a path inside the app', () => {
    renderTurn({ sources: ['/resources/selling/what-is-a-property-pack'] });

    const link = screen.getByRole('link', { name: 'What is a property pack' });
    expect(link.getAttribute('href')).toBe('/resources/selling/what-is-a-property-pack');
  });

  it('should label a source by its fragment when it has one', () => {
    renderTurn({ sources: ['/faq#security'] });

    expect(screen.getByRole('link', { name: 'Security' }).getAttribute('href')).toBe('/faq#security');
  });

  it('should show an offsite source as plain text, never as a link', () => {
    renderTurn({ sources: ['https://evil.example/pricing'] });

    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('Pricing')).toBeTruthy();
  });

  it('should not treat a protocol-relative source as internal', () => {
    // `//evil.example/faq` starts with a slash but resolves offsite.
    renderTurn({ sources: ['//evil.example/faq'] });

    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('Faq')).toBeTruthy();
  });

  it('should render a mixed list, linking only the internal one', () => {
    renderTurn({ sources: ['/pricing', 'https://evil.example/x'] });

    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Pricing' })).toBeTruthy();
  });

  it('should show no source list on a turn that has none', () => {
    renderTurn({ sources: [] });

    expect(screen.queryByLabelText('Pages this answer came from')).toBeNull();
  });

  it('should carry the disclaimer only on the turn that is marked for it', () => {
    renderTurn({ showDisclaimer: true });

    expect(screen.getByText(/not legal advice/i)).toBeTruthy();
  });

  it('should say who is speaking for a screen reader', () => {
    renderTurn({ role: 'user', text: 'My question' });

    expect(screen.getByText('You said:')).toBeTruthy();
  });
});
