import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProviderRow } from '../ProviderRow';
import { SEARCH_COMPATIBILITY_REASONS } from '../../../services/searchCompatibility.service';
import type { Provider } from '../types';

function makeProvider(overrides: Partial<Provider> = {}): Provider {
  return {
    id: 'p1', name: 'Test Firm', logo: 'TF', tagline: 'x', tier: 1, price: 0,
    turnaround: 'Quote', rating: 4.5, reviews: 12,
    features: ['a', 'b', 'c', 'd'], regulated: 'CLC #123',
    ...overrides,
  };
}

describe('ProviderRow lender panel badges', () => {
  it("should show the green on-panel badge when lenderPanelStatus is 'on'", () => {
    render(<ProviderRow provider={makeProvider({ lenderPanelStatus: 'on', lenderPanelName: 'Santander' })} selected={false} onSelect={vi.fn()} />);
    expect(screen.getByText("On Santander's panel ✓")).toBeInTheDocument();
  });

  it("should show the amber off-panel badge when lenderPanelStatus is 'off'", () => {
    render(<ProviderRow provider={makeProvider({ lenderPanelStatus: 'off', lenderPanelName: 'Santander' })} selected={false} onSelect={vi.fn()} />);
    expect(screen.getByText("Not on Santander's panel")).toBeInTheDocument();
  });

  it('should show no panel badge when lenderPanelStatus is unset', () => {
    render(<ProviderRow provider={makeProvider()} selected={false} onSelect={vi.fn()} />);
    expect(screen.queryByText(/panel ✓|Not on/)).not.toBeInTheDocument();
  });
});

// Badge text always comes straight from searchCompatibilityReason (as the
// real decorator stamps it) rather than a literal re-typed here — this is
// the same value ProviderRow renders, so the test can never drift from the
// component's actual copy source the way two independent literals could.
const ANY_REASON_TEXT = new RegExp(
  Object.values(SEARCH_COMPATIBILITY_REASONS).map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'),
);

describe('ProviderRow search compatibility badges', () => {
  it("should show the green accepts badge with the decorator's reason text when searchCompatibility is 'accepts'", () => {
    render(<ProviderRow provider={makeProvider({ searchCompatibility: 'accepts', searchCompatibilityReason: SEARCH_COMPATIBILITY_REASONS.accepts })} selected={false} onSelect={vi.fn()} />);
    expect(screen.getByText(SEARCH_COMPATIBILITY_REASONS.accepts)).toBeInTheDocument();
  });

  it("should show a neutral (non-amber) badge with the decorator's reason text when searchCompatibility is 'reorders'", () => {
    render(<ProviderRow provider={makeProvider({ searchCompatibility: 'reorders', searchCompatibilityReason: SEARCH_COMPATIBILITY_REASONS.reorders })} selected={false} onSelect={vi.fn()} />);
    const badge = screen.getByText(SEARCH_COMPATIBILITY_REASONS.reorders);
    expect(badge).toBeInTheDocument();
    // Neutral distinction, not a warning — must not use the amber classes
    // reserved for the lender off-panel mismatch above.
    expect(badge.className).not.toMatch(/amber/);
  });

  it("should show a neutral badge with the decorator's reason text when searchCompatibility is 'unknown'", () => {
    render(<ProviderRow provider={makeProvider({ searchCompatibility: 'unknown', searchCompatibilityReason: SEARCH_COMPATIBILITY_REASONS.unknown })} selected={false} onSelect={vi.fn()} />);
    const badge = screen.getByText(SEARCH_COMPATIBILITY_REASONS.unknown);
    expect(badge).toBeInTheDocument();
    expect(badge.className).not.toMatch(/amber/);
  });

  it("should show no search compatibility badge when 'not_applicable', even if a reason were somehow set", () => {
    render(<ProviderRow provider={makeProvider({ searchCompatibility: 'not_applicable' })} selected={false} onSelect={vi.fn()} />);
    expect(screen.queryByText(ANY_REASON_TEXT)).not.toBeInTheDocument();
  });

  it('should show no search compatibility badge when unset', () => {
    render(<ProviderRow provider={makeProvider()} selected={false} onSelect={vi.fn()} />);
    expect(screen.queryByText(ANY_REASON_TEXT)).not.toBeInTheDocument();
  });

  it('should show no badge when searchCompatibility is set but searchCompatibilityReason is missing', () => {
    render(<ProviderRow provider={makeProvider({ searchCompatibility: 'accepts' })} selected={false} onSelect={vi.fn()} />);
    expect(screen.queryByText(ANY_REASON_TEXT)).not.toBeInTheDocument();
  });
});
