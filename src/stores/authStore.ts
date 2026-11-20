// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AuthClient, Principal } from '@propxchain/core-client';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { icpService } from '../services/icp.service';
import { supabaseAuthService } from '../services/supabase.auth.service';
import { removeDevicePushToken } from '../services/devicePushToken.service';
import { clearDealStorage, rememberSignedInPrincipal } from '@/utils/clearDealStorage';
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

const NANOSECONDS_PER_SECOND = 1_000_000_000n;
const II_SESSION_TTL_NANOSECONDS = 24n * 60n * 60n * NANOSECONDS_PER_SECOND;
const DELEGATION_CHECK_INTERVAL_MS = 5 * 60 * 1000;

let delegationExpiryInterval: ReturnType<typeof setInterval> | null = null;

async function resetPerUserSingletons(): Promise<void> {
  try {
    await icpService.logout();
  } catch (err) {
    logger.error('Sign-out: ICP service reset failed', err);
  }
  try {
    const { messageService } = await import('../services/message.service');
    await messageService.reinitialize();
  } catch (err) {
    logger.error('Sign-out: messaging reset failed', err);
  }
  try {
    const { queryClient } = await import('@/lib/queryClient');
    queryClient.clear();
  } catch (err) {
    logger.error('Sign-out: query cache clear failed', err);
  }
}

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
  errorCode: string | null;
  identityError: string | null;
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
      errorCode: null,
      identityError: null,

      initialize: async () => {
        try {
          set({ isLoading: true, error: null });

          let session = null;
          try {
            session = await supabaseAuthService.getSession();
          } catch (sessionErr) {
            logger.warn('initialize: Supabase session check failed (token may have expired):', sessionErr);
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

          const authClient = new AuthClient({
            identityProvider: getIdentityProviderUrl(),
          });
          await authClient.getIdentity();
          const isAuthenticated = authClient.isAuthenticated();

          if (isAuthenticated) {
            const identity = await authClient.getIdentity();
            const principal = identity.getPrincipal();
            const principalId = principal.toText();

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
        set({ isLoading: true, error: null, errorCode: null });

        try {
          const result = await supabaseAuthService.signIn(email, password);

          if (result.error) {
            set({
              error: result.error.message || 'Sign in failed',
              errorCode: result.error.code ?? null,
              isLoading: false,
            });
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
            orgJustCreated: result.orgJustCreated === true,
          });

          await get().fetchProfile();
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
          const identity = await authClient.signIn({
            maxTimeToLive: II_SESSION_TTL_NANOSECONDS,
          });
          const principal = identity.getPrincipal();
          const principalId = principal.toText();

          await icpService.initAuth();

          set({
            isAuthenticated: true,
            authMethod: 'ii',
            principal,
            principalId,
            isLoading: false,
          });

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

        await removeDevicePushToken().catch(() => undefined);

        try {
          if (authMethod === 'supabase') {
            await supabaseAuthService.signOut();
          } else if (authMethod === 'ii' && authClient) {
            await authClient.signOut();
          }
        } catch (error) {
          logger.error('Sign-out: ending the session failed; clearing this browser anyway', error);
        }

        try {
          localStorage.removeItem('user');
          localStorage.removeItem('token');
          localStorage.removeItem('propxchain-session-start');

          localStorage.removeItem('userType');
          localStorage.removeItem('userName');
          localStorage.removeItem('onboardingRole');
          localStorage.removeItem('pendingTier');

          localStorage.removeItem('wizardData');
          localStorage.removeItem('currentPhase');
          localStorage.removeItem('completedPhases');
          localStorage.removeItem('wizardSaves');

          clearDealStorage();

          await resetPerUserSingletons();

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
        }, DELEGATION_CHECK_INTERVAL_MS);
      },

      clearError: () => set({ error: null, errorCode: null }),
      clearIdentityError: () => set({ identityError: null }),
      setLoading: (loading: boolean) => set({ isLoading: loading }),
    }),
    {
      name: 'propxchain-auth',
      partialize: (state) => ({
        authMethod: state.authMethod,
      }),
    }
  )
);

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

useAuthStore.subscribe((state, previous) => {
  if (state.principalId && state.principalId !== previous.principalId) {
    rememberSignedInPrincipal(state.principalId);
  }
});

export const getStorePrincipalId = (): string | null => useAuthStore.getState().principalId;

export const getStoreIsAuthenticated = (): boolean => useAuthStore.getState().isAuthenticated;
