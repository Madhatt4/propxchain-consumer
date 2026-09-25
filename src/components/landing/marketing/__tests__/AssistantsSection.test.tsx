// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { AssistantsSection } from '../AssistantsSection';
import { ASSISTANTS, MCP_CONNECTOR_URL } from '../data';

/**
 * The section makes an availability claim per assistant, so the failure that
 * matters is a false one: an assistant shown as available that cannot connect.
 * Claude is proven against the live connector (16 Sep 2026); ChatGPT is not yet.
 */
function renderSection(): void {
  render(
    <MemoryRouter>
      <AssistantsSection />
    </MemoryRouter>,
  );
}

function cardFor(name: string): HTMLElement {
  const heading = screen.getByRole('heading', { name });
  const card = heading.closest('[data-assistant-status]');
  if (!(card instanceof HTMLElement)) throw new Error(`No card for ${name}`);
  return card;
}

describe('landing AI assistants section', () => {
  it('should show Claude as available with the live connector address', () => {
    renderSection();

    const claude = cardFor('Claude');
    expect(claude).toHaveAttribute('data-assistant-status', 'available');
    expect(within(claude).getByText('Available now')).toBeInTheDocument();
    expect(within(claude).getByText(MCP_CONNECTOR_URL)).toBeInTheDocument();
    expect(MCP_CONNECTOR_URL).toBe('https://mcp.propxchain.com/mcp');
  });

  it('should not claim ChatGPT is available before a connection has been proven', () => {
    renderSection();

    const chatgpt = cardFor('ChatGPT');
    expect(chatgpt).toHaveAttribute('data-assistant-status', 'coming-soon');
    expect(within(chatgpt).queryByText('Available now')).not.toBeInTheDocument();
  });

  it('should send developers to the API guide', () => {
    renderSection();

    expect(screen.getByRole('link', { name: /read the developer guide/i })).toHaveAttribute('href', '/api');
  });

  it('should render one card per assistant', () => {
    renderSection();

    expect(document.querySelectorAll('[data-assistant-status]')).toHaveLength(ASSISTANTS.length);
  });
});
