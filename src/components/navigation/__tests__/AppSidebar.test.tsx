import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AppSidebar from '../AppSidebar';

const logout = vi.fn().mockResolvedValue(undefined);
vi.mock('@/stores/authStore', () => ({
  useAuthStore: { getState: () => ({ logout }) },
}));

const SECTIONS = [
  { label: 'Transactions', to: '/dashboard', end: true },
  { label: 'Analytics', to: '/dashboard/analytics' },
];

function renderAt(path: string): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppSidebar sections={SECTIONS} ariaLabel="Dashboard sections" />
    </MemoryRouter>,
  );
}

describe('AppSidebar', () => {
  it('should render every section plus Profile and Log out', () => {
    renderAt('/dashboard');
    const nav = screen.getByRole('navigation', { name: 'Dashboard sections' });
    expect(nav.querySelectorAll('a')).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument();
  });

  it('should mark only the current section active', () => {
    renderAt('/dashboard/analytics');
    expect(screen.getByRole('link', { name: 'Analytics' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Transactions' })).not.toHaveAttribute('aria-current');
  });

  it('should call logout when Log out is clicked', async () => {
    renderAt('/dashboard');
    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));
    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
  });
});
