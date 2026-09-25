// PropXchain - Open Source Blockchain Property Conveyancing Platform
// Copyright (C) 2025 PropXchain Contributors
// SPDX-License-Identifier: Proprietary

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AuthClient, Principal } from '@propxchain/core-client';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { icpService } from '../services/icp.service';
import { supabaseAuthService } from '../services/supabase.auth.service';
import { clearDealStorage } from '@/utils/clearDealStorage';
import { logger } from '@/utils/logger';

interface UserProfile {
  principal: Principal;
  name: string;
  email: string;
  mobile: string;
  userType: string;
  isVerified: boolean;
  createdAt: bigint;
  solicitorLicenseNumber: string | null;
  lawFirmName: string | null;
  lawFirmAddress: string | null;
  isPlatformOnlySolicitor: boolean;
  clientPrincipals: Principal[];
  managedBySolicitor: Principal | null;
  firmId?: string;
  username?: string;
}

let delegationExpiryInterval: ReturnType<typeof setInterval> | null = null;

interface AuthState {
  isAuthenticated: boolean;
  isInitialized: boolean;
  authMethod: 'supabase' | 'ii' | null;
  principal: Principal | null;
  principalId: string | null;
  authClient: AuthClient | null;
  supabaseUser: SupabaseUser | null;
  userProfile: UserProfile | null;
  isLoading: boolean;
  error: string | null;
  identityError: string | null;
  /**
   * Set to true on the sign-in immediately after a developer signup's
   * first-login hook successfully created their organisation. LoginPage
   * reads this to route to /post-login?fresh=1 instead of /dashboard,
   * triggering the freshSignup branch in decideRoute. Cleared on the
   * next login.
   */
  orgJustCreated: boolean;

  initialize: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<boolean>;
  registerWithEmail: (email: string, password: string, name: string, role: string) => Promise<boolean>;
  completeOAuthLogin: () => Promise<boolean>;
  loginWithII: () => Promise<boolean>;
  logout: () => Promise<void>;
  fetchProfile: () => Promise<UserProfile | null>;
  startDelegationExpiryCheck: () => void;
  needsProfileSetup: () => boolean;
  clearError: () => void;
  clearIdentityError: () => void;
  setLoading: (loading: boolean) => void;
}

/**
 * Map the role string used in Supabase signup metadata (or II profile setup)
 * to the userType text the user_management canister expects. Anything unknown
 * falls back to 'buyer' so the canister stores a valid enum.
 */
function mapRoleToUserType(role: string | undefined | null): string {
  switch ((role || '').toLowerCase()) {
    case 'developer':
    case 'property_developer':
      return 'property_developer';
    case 'conveyancer':
    case 'solicitor':
    case 'solicitor_client_linked':
      return 'solicitor_client_linked';
    case 'estate_agent':
      return 'estate_agent';
    case 'mortgage_broker':
      return 'mortgage_broker';
    case 'seller':
      return 'seller';
    case 'buyer':
    default:
      return 'buyer';
  }
}

/**
 * Fire-and-forget wrapper around icpService.ensureUserProfileOnChain.
 * Pulls name/email/role out of the Supabase user metadata and runs the
 * mirror in the background — login flows never await this. Idempotent
 * (via getUserProfile pre-check) so re-running on every login is safe and
 * cheap. Returning users with no profile get backfilled the next time they
 * sign in.
 */
function mirrorUserProfileToChain(
  principalId: string | null | undefined,
  user: SupabaseUser | null,
): void {
  if (!principalId || !user) return;
  const meta = (user.user_metadata ?? {}) as Record<string, string | undefined>;
  const name = meta.name || meta.full_name || (user.email?.split('@')[0] ?? '');
  const email = user.email || '';
  if (!name || !email) return;
  void icpService
    .ensureUserProfileOnChain({
      principalId,
      name,
      email,
      mobile: meta.phone || meta.mobile || '',
      userType: mapRoleToUserType(meta.role),
    })
    .catch((err) => logger.warn('mirrorUserProfileToChain failed:', err));
}

const getIdentityProviderUrl = (): string => {
  const network = import.meta.env.VITE_DFX_NETWORK || 'ic';
  if (network === 'ic') {
    // v7 SDK opens this URL as-is and expects /authorize — v3 used to hash-route from
    // the homepage, but v7 doesn't, so explicitly point at /authorize.
    return 'https://id.ai/authorize?feature_flag_guided_upgrade=true';
  }
  const canisterId = import.meta.env.VITE_INTERNET_IDENTITY_CANISTER_ID;
  return `http://localhost:4943/authorize?canisterId=${canisterId}`;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      isInitialized: false,
      authMethod: null,
      principal: null,
      principalId: null,
      authClient: null,
      supabaseUser: null,
      orgJustCreated: false,
      userProfile: null,
      isLoading: false,
      error: null,
      identityError: null,

      initialize: async () => {
        try {
          set({ isLoading: true, error: null });

          // 1. Check for existing Supabase session first
          let session = null;
          try {
            session = await supabaseAuthService.getSession();
          } catch (sessionErr) {
            logger.warn('initialize: Supabase session check failed (token may have expired):', sessionErr);
            // Clear stale session data — fall through to II check
          }
          if (session) {
            logger.info('initialize: Found existing Supabase session');
            const user = await supabaseAuthService.getUser();
            const identity = await supabaseAuthService.restoreIdentity();

            if (identity) {
              const principal = identity.getPrincipal();
              const principalId = principal.toText();

              await icpService.setIdentity(identity);

              set({
                isAuthenticated: true,
                isInitialized: true,
                authMethod: 'supabase',
                principal,
                principalId,
                supabaseUser: user,
                isLoading: false,
              });

              get().fetchProfile();
              mirrorUserProfileToChain(principalId, user);
              return;
            }

            // First restore failed — retry once
            logger.info('initialize: First restoreIdentity failed, retrying...');
            const retryIdentity = await supabaseAuthService.restoreIdentity();

            if (retryIdentity) {
              const retryPrincipal = retryIdentity.getPrincipal();
              const retryPrincipalId = retryPrincipal.toText();

              await icpService.setIdentity(retryIdentity);

              set({
                isAuthenticated: true,
                isInitialized: true,
                authMethod: 'supabase',
                principal: retryPrincipal,
                principalId: retryPrincipalId,
                supabaseUser: user,
                isLoading: false,
              });

              get().fetchProfile();
              mirrorUserProfileToChain(retryPrincipalId, user);
              return;
            }

            // Both attempts failed — still keep user authenticated via Supabase
            // They can browse the dashboard; canister writes will prompt re-auth via RequirePrincipal
            logger.warn('initialize: Supabase session valid but ICP identity unrecoverable');

            set({
              isAuthenticated: true,
              isInitialized: true,
              authMethod: 'supabase',
              principal: null,
              principalId: null,
              supabaseUser: user,
              identityError: 'Blockchain identity needs refresh. Some features may require re-login.',
              isLoading: false,
            });
            return;
          }

          // 2. Fall back to Internet Identity
          const authClient = new AuthClient({
            identityProvider: getIdentityProviderUrl(),
          });
          // signIn-flow auth client needs an explicit identity load before
          // isAuthenticated() reflects an existing IndexedDB session in v7.
          await authClient.getIdentity();
          const isAuthenticated = authClient.isAuthenticated();

          if (isAuthenticated) {
            const identity = await authClient.getIdentity();
            const principal = identity.getPrincipal();
            const principalId = principal.toText();

            // Use initAuth() — initialize() only creates anonymous agents.
            // initAuth() detects the II session and creates an authenticated HttpAgent.
            await icpService.initAuth();

            set({
              authClient,
              isAuthenticated: true,
              isInitialized: true,
              authMethod: 'ii',
              principal,
              principalId,
              isLoading: false,
            });

            get().startDelegationExpiryCheck();
            get().fetchProfile();
          } else {
            set({
              authClient,
              isAuthenticated: false,
              isInitialized: true,
              authMethod: null,
              principal: null,
              principalId: null,
              isLoading: false,
            });
          }
        } catch (error) {
          logger.error('Auth initialization failed:', error);
          set({
            error: 'Failed to initialize authentication',
            isInitialized: true,
            isLoading: false,
          });
        }
      },

      loginWithEmail: async (email: string, password: string) => {
        set({ isLoading: true, error: null });

        try {
          const result = await supabaseAuthService.signIn(email, password);

          if (result.error) {
            set({
              error: result.error.message || 'Sign in failed',
              isLoading: false,
            });
            return false;
          }

          // Identity can come back null if crypto.subtle races or the
          // encrypted_icp_key lands half-written — retry once via
          // retryKeyGeneration before failing the login. Without this
          // fallback, users had to reload the page for initialize() to
          // recover the identity, which broke any canister-write route
          // reached directly after sign-in (see onboarding/join).
          let identity = result.identity;
          if (!identity && result.user) {
            identity = await supabaseAuthService.retryKeyGeneration(result.user.id);
          }

          if (!identity) {
            set({
              error: 'Failed to create blockchain identity. Please try again or contact support.',
              isLoading: false,
            });
            return false;
          }

          const principal = identity.getPrincipal();
          const principalId = principal.toText();

          await icpService.setIdentity(identity);

          // Sync onboarding-state keys from this user's metadata. These keys
          // are read across the app (ComposeMessageModal, RoleSelectionPage,
          // CreateTransactionPage, etc.) but are written only at register /
          // onboarding time — so when a buyer logs in after a seller used
          // the same device, the stale 'seller' lingers and the buyer's UI
          // renders the wrong journey. Rewrite from the JWT user_metadata
          // on every login so the local mirror tracks the signed-in user.
          const metaRole = (result.user?.user_metadata?.role as string | undefined) || '';
          const metaName = (result.user?.user_metadata?.name as string | undefined) || '';
          if (metaRole) {
            localStorage.setItem('userType', metaRole);
            localStorage.setItem('onboardingRole', metaRole);
          } else {
            localStorage.removeItem('userType');
            localStorage.removeItem('onboardingRole');
          }
          if (metaName) {
            localStorage.setItem('userName', metaName);
          } else {
            localStorage.removeItem('userName');
          }

          set({
            isAuthenticated: true,
            isInitialized: true,
            authMethod: 'supabase',
            principal,
            principalId,
            supabaseUser: result.user,
            isLoading: false,
            // 1a.9: surfaces the freshly-created developer org so LoginPage
            // can route to /post-login?fresh=1 instead of the legacy
            // dashboard. Cleared on next login.
            orgJustCreated: result.orgJustCreated === true,
          });

          await get().fetchProfile();
          // Mirror Supabase metadata onto user_management. Idempotent — skipped
          // if a profile already exists. Fire-and-forget so login UX never
          // waits on a canister write; fetchProfile() runs again on the next
          // login or page reload to surface the freshly created profile.
          mirrorUserProfileToChain(principalId, result.user);

          return true;
        } catch (error) {
          logger.error('Email login failed:', error);
          set({
            error: 'Login failed. Please check your credentials.',
            isLoading: false,
          });
          return false;
        }
      },

      completeOAuthLogin: async () => {
        set({ isLoading: true, error: null });

        try {
          const result = await supabaseAuthService.completeOAuthSession();

          if (result.error) {
            set({ error: result.error.message || 'Sign in failed', isLoading: false });
            return false;
          }

          let identity = result.identity;
          if (!identity && result.user) {
            identity = await supabaseAuthService.retryKeyGeneration(result.user.id);
          }
          if (!identity) {
            set({
              error: 'Failed to create blockchain identity. Please try again or contact support.',
              isLoading: false,
            });
            return false;
          }

          const principal = identity.getPrincipal();
          const principalId = principal.toText();
          await icpService.setIdentity(identity);

          const meta = (result.user?.user_metadata ?? {}) as Record<string, string | undefined>;
          const metaRole = meta.role || '';
          const metaName = meta.name || meta.full_name || '';
          if (metaRole) {
            localStorage.setItem('userType', metaRole);
            localStorage.setItem('onboardingRole', metaRole);
          } else {
            localStorage.removeItem('userType');
            localStorage.removeItem('onboardingRole');
          }
          if (metaName) localStorage.setItem('userName', metaName);
          else localStorage.removeItem('userName');

          set({
            isAuthenticated: true,
            isInitialized: true,
            authMethod: 'supabase',
            principal,
            principalId,
            supabaseUser: result.user,
            isLoading: false,
            orgJustCreated: result.orgJustCreated === true,
          });

          await get().fetchProfile();
          // Only mirror when a role is known. Social sign-ups arrive with no
          // role; mirroring here would default them to 'buyer'. They complete
          // /profile-setup first, which writes the profile with the chosen role.
          if (metaRole) {
            mirrorUserProfileToChain(principalId, result.user);
          }

          return true;
        } catch (error) {
          logger.error('OAuth login completion failed:', error);
          set({ error: 'Login failed. Please try again.', isLoading: false });
          return false;
        }
      },

      registerWithEmail: async (email: string, password: string, name: string, role: string) => {
        set({ isLoading: true, error: null });

        try {
          const result = await supabaseAuthService.signUp(email, password, { name, role });

          if (result.error) {
            set({
              error: result.error.message || 'Registration failed',
              isLoading: false,
            });
            return false;
          }

          // With email confirmation ON, no session/identity yet.
          // User must verify email first, then ICP key is generated on first login.
          set({ isLoading: false });
          return true;
        } catch (error) {
          logger.error('Email registration failed:', error);
          set({
            error: 'Registration failed. Please try again.',
            isLoading: false,
          });
          return false;
        }
      },

      loginWithII: async () => {
        let authClient = get().authClient;
        if (!authClient) {
          authClient = new AuthClient({
            identityProvider: getIdentityProviderUrl(),
          });
          set({ authClient });
        }

        set({ isLoading: true, error: null });

        try {
          // v7: signIn() returns Promise<Identity>; identityProvider was set at construction.
          const identity = await authClient.signIn({
            maxTimeToLive: BigInt(24 * 60 * 60 * 1000 * 1000 * 1000), // 24 hours in nanoseconds
          });
          const principal = identity.getPrincipal();
          const principalId = principal.toText();

          // Use initAuth() to create authenticated agent (not anonymous)
          await icpService.initAuth();

          set({
            isAuthenticated: true,
            authMethod: 'ii',
            principal,
            principalId,
            isLoading: false,
          });

          // Match initialize()'s II branch: monitor the delegation so an
          // expired II session logs the user out instead of silently failing
          // canister writes. Without this a fresh II login wasn't watched
          // until the next page reload re-ran initialize().
          get().startDelegationExpiryCheck();
          await get().fetchProfile();
          return true;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          logger.error('II Login failed:', error);
          set({
            error: message || 'Login failed',
            isLoading: false,
          });
          return false;
        }
      },

      logout: async () => {
        const { authClient, authMethod } = get();

        set({ isLoading: true });

        if (delegationExpiryInterval !== null) {
          clearInterval(delegationExpiryInterval);
          delegationExpiryInterval = null;
        }

        try {
          if (authMethod === 'supabase') {
            await supabaseAuthService.signOut();
          } else if (authMethod === 'ii' && authClient) {
            await authClient.signOut();
          }

          localStorage.removeItem('user');
          localStorage.removeItem('token');
          localStorage.removeItem('propxchain-session-start');

          // Onboarding / role state written across the app — kept in localStorage
          // for convenience but never tied to the authenticated user, so they
          // leak across sign-outs. A buyer signing in after a seller session
          // would otherwise read 'seller' from userType and render the seller
          // view of their transaction.
          localStorage.removeItem('userType');
          localStorage.removeItem('userName');
          localStorage.removeItem('onboardingRole');
          localStorage.removeItem('pendingTier');

          // Deal data (form drafts, doc lists, KYC, transaction UI state)
          // persists across logouts on shared devices. Wipe it so the next
          // sign-in starts clean (security scan L8).
          clearDealStorage();

          set({
            isAuthenticated: false,
            authMethod: null,
            principal: null,
            principalId: null,
            supabaseUser: null,
            userProfile: null,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          logger.error('Logout failed:', error);
          set({
            error: 'Logout failed',
            isLoading: false,
          });
        }
      },

      fetchProfile: async () => {
        try {
          await icpService.initialize();
          const profile = await icpService.getMyProfile();

          if (profile) {
            set({ userProfile: profile as UserProfile });
            return profile as UserProfile;
          }
          return null;
        } catch (error) {
          logger.error('Failed to fetch profile:', error);
          return null;
        }
      },

      needsProfileSetup: () => {
        const { userProfile } = get();
        return !userProfile || !userProfile.email || !userProfile.mobile;
      },

      startDelegationExpiryCheck: () => {
        if (delegationExpiryInterval !== null) {
          clearInterval(delegationExpiryInterval);
        }

        delegationExpiryInterval = setInterval(async () => {
          const { authClient, isAuthenticated, authMethod } = get();
          if (!authClient || !isAuthenticated || authMethod !== 'ii') {
            if (delegationExpiryInterval !== null) {
              clearInterval(delegationExpiryInterval);
              delegationExpiryInterval = null;
            }
            return;
          }
          const stillValid = await authClient.isAuthenticated();
          if (!stillValid) {
            logger.warn('Internet Identity delegation expired, logging out');
            if (delegationExpiryInterval !== null) {
              clearInterval(delegationExpiryInterval);
              delegationExpiryInterval = null;
            }
            set({
              isAuthenticated: false,
              authMethod: null,
              principal: null,
              principalId: null,
              userProfile: null,
              error: 'Session expired. Please log in again.',
              isLoading: false,
            });
          }
        }, 5 * 60 * 1000);
      },

      clearError: () => set({ error: null }),
      clearIdentityError: () => set({ identityError: null }),
      setLoading: (loading: boolean) => set({ isLoading: loading }),
    }),
    {
      name: 'propxchain-auth',
      // RFC 9700: do NOT persist isAuthenticated or principalId — XSS-readable.
      // Full-page reload forces re-auth (see project_dual_auth_fix flow).
      partialize: (state) => ({
        authMethod: state.authMethod,
      }),
    }
  )
);

// Selector hooks for common use cases
export const useIsAuthenticated = (): boolean => useAuthStore((state) => state.isAuthenticated);
export const usePrincipal = (): Principal | null => useAuthStore((state) => state.principal);
export const usePrincipalId = (): string | null => useAuthStore((state) => state.principalId);
export const useUserProfile = (): UserProfile | null => useAuthStore((state) => state.userProfile);
export const useAuthLoading = (): boolean => useAuthStore((state) => state.isLoading);
export const useAuthError = (): string | null => useAuthStore((state) => state.error);
export const useNeedsProfileSetup = (): boolean => useAuthStore((state) => state.needsProfileSetup());
export const useAuthMethod = (): 'supabase' | 'ii' | null => useAuthStore((state) => state.authMethod);
export const useHasPrincipal = (): boolean => useAuthStore((state) => state.principal !== null);
export const useIdentityError = (): string | null => useAuthStore((state) => state.identityError);

/** Non-hook accessor for services/non-React code */
export const getStorePrincipalId = (): string | null => useAuthStore.getState().principalId;

/** Non-hook accessor for services/non-React code */
export const getStoreIsAuthenticated = (): boolean => useAuthStore.getState().isAuthenticated;
