// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@/components/common/ThemeToggle', () => ({
  ThemeToggleWithLabel: () => null,
}));

vi.mock('@/hooks/useIsAdmin', () => ({
  useIsAdmin: vi.fn(),
}));

import { useIsAdmin } from '@/hooks/useIsAdmin';
import DashboardSidebar from '../DashboardSidebar';

const mockUseIsAdmin = vi.mocked(useIsAdmin);

function renderSidebar(): void {
  render(
    <MemoryRouter>
      <DashboardSidebar activeRoute="/dashboard" />
    </MemoryRouter>,
  );
}

describe('DashboardSidebar', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
  });

  it('should show the estate agent portal link to admins and navigate to it', () => {
    mockUseIsAdmin.mockReturnValue({ isAdmin: true, role: 'regular', isLoading: false });

    renderSidebar();
    fireEvent.click(screen.getByRole('button', { name: /estate agent portal/i }));

    expect(screen.getByRole('button', { name: /admin dashboard/i })).toBeInTheDocument();
    expect(mockNavigate).toHaveBeenCalledWith('/estate-agent');
  });

  it('should hide the admin-only items from non-admins', () => {
    mockUseIsAdmin.mockReturnValue({ isAdmin: false, role: null, isLoading: false });

    renderSidebar();

    expect(screen.queryByRole('button', { name: /estate agent portal/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /admin dashboard/i })).not.toBeInTheDocument();
  });
});
