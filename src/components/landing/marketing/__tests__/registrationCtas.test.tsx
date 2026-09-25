import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import { render, screen, within, type RenderResult } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/**
 * Every CTA on the landing page used to scroll to #report whatever its label
 * said — including "Create a free buyer account" and all three pricing tiers.
 * That is the offer-and-destination mismatch config/registration.ts was
 * written to stop, and it survived on the landing page because nothing there
 * read the flag.
 *
 * These assert both states of VITE_MAINTENANCE_MODE, so a CTA can never again
 * offer an account while /register is showing the "not yet" notice — or, once
 * sign-ups open, keep sending people to the report form instead.
 */

const OPEN = 'false';
const CLOSED = 'true';

/** Loads a module fresh against a given maintenance-mode value. */
async function withFlag<T>(maintenance: string, load: () => Promise<T>): Promise<T> {
  vi.resetModules();
  vi.stubEnv('VITE_MAINTENANCE_MODE', maintenance);
  return load();
}

function inRouter(ui: React.ReactElement): RenderResult {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

/**
 * The rendered <section> for one audience, scoped to this render's container.
 *
 * Sellers and buyers can carry the same label at the same time — both offer
 * the report while sign-ups are shut — so a bare screen query would assert
 * against whichever matched first and pass even if the two swapped. Scoping
 * makes each assertion name the section it is actually about.
 */
function audience({ container }: RenderResult, id: string): HTMLElement {
  const el = container.querySelector<HTMLElement>(`section#${id}`);
  if (!el) throw new Error(`No audience section rendered with id "${id}"`);
  return el;
}

const noop = (): void => {};

describe('landing CTAs when sign-ups are open', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('should route the nav CTA to the register page', async () => {
    const { MarketingNav } = await withFlag(OPEN, () => import('../MarketingNav'));
    inRouter(<MarketingNav isDark={false} onToggleTheme={noop} onScrollTo={noop} />);

    expect(screen.getByRole('link', { name: 'Create account' })).toHaveAttribute(
      'href',
      '/register',
    );
  });

  it('should route the buyer CTA to the register page, matching its label', async () => {
    const { AudienceSections } = await withFlag(OPEN, () => import('../AudienceSections'));
    const view = inRouter(<AudienceSections onScrollTo={noop} />);

    expect(
      within(audience(view, 'buyers')).getByRole('link', { name: 'Create a free buyer account' }),
    ).toHaveAttribute('href', '/register');
  });

  it('should route the Starter tier CTA to the register page', async () => {
    const { PricingSection } = await withFlag(OPEN, () => import('../PricingSection'));
    inRouter(<PricingSection onScrollTo={noop} />);

    expect(screen.getByRole('link', { name: 'Get started free' })).toHaveAttribute(
      'href',
      '/register',
    );
  });

  it('should make the account the primary hero CTA, with the report beside it', async () => {
    const { HeroSection } = await withFlag(OPEN, () => import('../HeroSection'));
    inRouter(<HeroSection isDark={false} onToggleTheme={noop} onScrollTo={noop} />);

    expect(screen.getByRole('link', { name: 'Create your free account' })).toHaveAttribute(
      'href',
      '/register',
    );
    expect(screen.getByRole('link', { name: 'Get your free report' })).toHaveAttribute(
      'href',
      '#report',
    );
  });

  it('should keep the report reachable as the secondary seller CTA', async () => {
    const { AudienceSections } = await withFlag(OPEN, () => import('../AudienceSections'));
    const view = inRouter(<AudienceSections onScrollTo={noop} />);

    // Still an in-page scroll, not a route — the report section is on this page.
    expect(
      within(audience(view, 'sellers')).getByRole('link', { name: 'Get your free report' }),
    ).toHaveAttribute('href', '#report');
  });
});

describe('landing CTAs when sign-ups are closed', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('should offer the report instead of an account in the nav', async () => {
    const { MarketingNav } = await withFlag(CLOSED, () => import('../MarketingNav'));
    inRouter(<MarketingNav isDark={false} onToggleTheme={noop} onScrollTo={noop} />);

    expect(screen.queryByRole('link', { name: 'Create account' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Free report' })).toHaveAttribute('href', '#report');
  });

  it('should keep the hero on the report while there is no account to create', async () => {
    const { HeroSection } = await withFlag(CLOSED, () => import('../HeroSection'));
    inRouter(<HeroSection isDark={false} onToggleTheme={noop} onScrollTo={noop} />);

    expect(screen.queryByRole('link', { name: 'Create your free account' })).toBeNull();
    expect(
      screen.getByRole('link', { name: 'Get your free Home Mover Report' }),
    ).toHaveAttribute('href', '#report');
  });

  it('should stop offering the buyer an account it cannot create', async () => {
    const { AudienceSections } = await withFlag(CLOSED, () => import('../AudienceSections'));
    const view = inRouter(<AudienceSections onScrollTo={noop} />);
    const buyers = within(audience(view, 'buyers'));

    // Label and destination move together: no "create an account" button
    // that lands on the report form.
    expect(buyers.queryByRole('link', { name: 'Create a free buyer account' })).toBeNull();
    expect(buyers.getByRole('link', { name: 'Get your free report' })).toHaveAttribute(
      'href',
      '#report',
    );
  });

  it('should not send the Starter tier CTA to a register page that would refuse it', async () => {
    const { PricingSection } = await withFlag(CLOSED, () => import('../PricingSection'));
    inRouter(<PricingSection onScrollTo={noop} />);

    expect(screen.getByRole('link', { name: 'Get started free' })).toHaveAttribute(
      'href',
      '#report',
    );
  });
});

describe('tier CTA destinations that do not depend on sign-ups', () => {
  beforeAll(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('should route Enterprise to partners in both states', async () => {
    for (const state of [OPEN, CLOSED]) {
      const { PricingSection } = await withFlag(state, () => import('../PricingSection'));
      const { unmount } = render(
        <MemoryRouter>
          <PricingSection onScrollTo={noop} />
        </MemoryRouter>,
      );
      expect(screen.getByRole('link', { name: 'Contact sales' })).toHaveAttribute(
        'href',
        '/partners',
      );
      unmount();
    }
  });

  it('should keep the Premium notify CTA on the report form, as it is not yet sold', async () => {
    const { PricingSection } = await withFlag(OPEN, () => import('../PricingSection'));
    inRouter(<PricingSection onScrollTo={noop} />);

    expect(screen.getByRole('link', { name: 'Get notified' })).toHaveAttribute('href', '#report');
  });
});
