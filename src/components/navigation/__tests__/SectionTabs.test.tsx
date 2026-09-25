import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SectionTabs from '../SectionTabs';
import { siteSections } from '@/components/builder/builderSections';

function renderAt(path: string): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <SectionTabs sections={siteSections('s1')} ariaLabel="Builder portal sections" />
    </MemoryRouter>,
  );
}

describe('SectionTabs', () => {
  it('should render one link per section under a labelled nav', () => {
    renderAt('/builder/sites/s1');
    const nav = screen.getByRole('navigation', { name: 'Builder portal sections' });
    expect(nav.querySelectorAll('a')).toHaveLength(5);
  });

  it('should mark only the Overview tab current on the site root', () => {
    renderAt('/builder/sites/s1');
    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Plots' })).not.toHaveAttribute('aria-current');
  });

  it('should keep Plots current on a plot sub-route and not Overview', () => {
    renderAt('/builder/sites/s1/plots/import');
    expect(screen.getByRole('link', { name: 'Plots' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Overview' })).not.toHaveAttribute('aria-current');
  });
});
