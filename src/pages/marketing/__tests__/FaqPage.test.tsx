// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeContext';
import FaqPage from '../FaqPage';
import { FAQ_GROUPS, buildFaqJsonLd } from '../faqData';

function renderPage(): ReturnType<typeof render> {
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <FaqPage />
      </ThemeProvider>
    </MemoryRouter>,
  );
}

const ALL_ITEMS = FAQ_GROUPS.flatMap((group) => [...group.items]);

describe('FaqPage', () => {
  it('should render every question and answer from the FAQ data module', () => {
    renderPage();

    for (const group of FAQ_GROUPS) {
      expect(screen.getByRole('heading', { name: group.title })).toBeInTheDocument();
    }
    for (const item of ALL_ITEMS) {
      expect(screen.getByText(item.q)).toBeInTheDocument();
      expect(screen.getByText(item.a)).toBeInTheDocument();
    }
  });

  it('should embed FAQPage JSON-LD that exactly mirrors the visible Q&As', () => {
    const { container } = renderPage();

    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).not.toBeNull();

    const parsed = JSON.parse(script?.textContent ?? '') as ReturnType<typeof buildFaqJsonLd>;
    expect(parsed['@type']).toBe('FAQPage');
    expect(parsed.mainEntity).toHaveLength(ALL_ITEMS.length);

    parsed.mainEntity.forEach((entry, i) => {
      expect(entry.name).toBe(ALL_ITEMS[i].q);
      expect(entry.acceptedAnswer.text).toBe(ALL_ITEMS[i].a);
    });
  });

  it('should group questions into between 14 and 18 entries across five themes', () => {
    expect(FAQ_GROUPS).toHaveLength(5);
    expect(ALL_ITEMS.length).toBeGreaterThanOrEqual(14);
    expect(ALL_ITEMS.length).toBeLessThanOrEqual(18);
  });

  it('should never state a fixed conveyancer fee anywhere in the copy', () => {
    for (const item of ALL_ITEMS) {
      const text = `${item.q} ${item.a}`;
      // Conveyancers quote per transaction; a "£N conveyancer" claim is a copy bug.
      expect(text).not.toMatch(/conveyancer[^.]*£\d/i);
      expect(text).not.toMatch(/£\d+[^.]*conveyancer fee/i);
    }
  });
});
