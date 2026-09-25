import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => vi.fn() };
});
vi.mock('@/components/navigation/AppTopBar', () => ({ default: () => null }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/utils/logger', () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }));

const mockInitAuth = vi.fn().mockResolvedValue(true);
const mockGetMyProfile = vi.fn().mockResolvedValue(null); // no on-chain profile
vi.mock('../../../services/icp.service', () => ({
  icpService: {
    initAuth: () => mockInitAuth(),
    getMyProfile: () => mockGetMyProfile(),
    registerUser: vi.fn(),
    initialize: vi.fn(),
  },
}));

vi.mock('../../../stores/authStore', () => ({
  useAuthStore: {
    getState: () => ({
      principalId: 'aaaaa-bbbbb',
      isAuthenticated: true,
      supabaseUser: { email: 'jane@gmail.com', user_metadata: { full_name: 'Jane Doe' } },
      fetchProfile: vi.fn(),
    }),
  },
}));

import ProfileSetup from '../ProfileSetup';

beforeEach(() => vi.clearAllMocks());

describe('ProfileSetup prefill', () => {
  it('should prefill name and email from Supabase metadata when no on-chain profile exists', async () => {
    render(<MemoryRouter><ProfileSetup /></MemoryRouter>);
    await waitFor(() => {
      expect((screen.getByLabelText(/full name/i) as HTMLInputElement).value).toBe('Jane Doe');
    });
    expect((screen.getByLabelText(/email address/i) as HTMLInputElement).value).toBe('jane@gmail.com');
  });
});
