import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const mockSignInWithOAuth = vi.fn();
vi.mock('../../../services/supabase.auth.service', () => ({
  supabaseAuthService: { signInWithOAuth: (p: string) => mockSignInWithOAuth(p) },
}));

import OAuthButtons from '../OAuthButtons';

beforeEach(() => {
  vi.clearAllMocks();
  mockSignInWithOAuth.mockResolvedValue({ error: null });
});

describe('OAuthButtons', () => {
  it('should render Google and Microsoft buttons', () => {
    render(<OAuthButtons />);
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue with microsoft/i })).toBeInTheDocument();
  });

  it('should start the google OAuth flow when the Google button is clicked', () => {
    render(<OAuthButtons />);
    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }));
    expect(mockSignInWithOAuth).toHaveBeenCalledWith('google');
  });

  it('should start the azure OAuth flow when the Microsoft button is clicked', () => {
    render(<OAuthButtons />);
    fireEvent.click(screen.getByRole('button', { name: /continue with microsoft/i }));
    expect(mockSignInWithOAuth).toHaveBeenCalledWith('azure');
  });

  it('should disable both buttons when disabled prop is set', () => {
    render(<OAuthButtons disabled />);
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /continue with microsoft/i })).toBeDisabled();
  });
});
