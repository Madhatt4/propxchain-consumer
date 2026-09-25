// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * ICP Canister Service
 * Connects React frontend to Internet Computer backend canisters
 */

import {
  Actor,
  HttpAgent,
  AuthClient,
  Principal,
  Ed25519KeyIdentity,
  propertyRegistryIdl,
  documentVerificationIdl,
  transactionManagerIdl,
  userManagementIdl,
  emailServiceIdl,
  ledgerManagerIdl,
  landRegistryIntegrationIdl,
  documentStorageIdl,
} from '@propxchain/core-client';
import type {
  ActorSubclass,
  PropertyRegistryService,
  DocumentVerificationService,
  TransactionManagerService,
  UserManagementService,
  EmailServiceService,
  LedgerManagerService,
  LandRegistryIntegrationService,
  DocumentStorageService,
} from '@propxchain/core-client';
// The user_management Candid variant ({ buyer: null } etc.). core-client's
// `exports` map only publishes ".", "./mock" and "./auth", so the generated
// type cannot be deep-imported — derive it from the public service signature
// instead, which also keeps it correct if the variant ever changes.
type UserType = Parameters<UserManagementService['addTransactionMember']>[2];

// Import rate limiting utilities
import { debounceAsync } from '../utils/debounce';
import { wrapReadCall, wrapWriteCall } from './canisterRateLimiter';

// TA6 6th-edition candid mapping (UI model <-> canister record)
import { toCandidTA6 } from './ta6/ta6ToCandid';
import { fromCandidTA6, fromCandidAnomaly } from './ta6/ta6FromCandid';
import type { TA6Anomaly } from './ta6/ta6FromCandid';
import type { CandidAnomaly, CandidTA6PropertyInformation } from './ta6/ta6Candid.types';

import { getStorePrincipalId, getStoreIsAuthenticated } from '../stores/authStore';

// Session management for secure auth state
import { SessionManager } from '../utils/sessionManager';
import { logger } from '@/utils/logger';

// Canister IDs for IC mainnet (from canister_ids.json)
const CANISTER_IDS = {
  property_registry: import.meta.env.VITE_PROPERTY_REGISTRY_CANISTER_ID || 'l6oow-dyaaa-aaaaa-qcwvq-cai',
  document_verification: import.meta.env.VITE_DOCUMENT_VERIFICATION_CANISTER_ID || 'xand7-wiaaa-aaaah-arlea-cai',
  transaction_manager: import.meta.env.VITE_TRANSACTION_MANAGER_CANISTER_ID || 'llj73-cqaaa-aaaaa-qcwwa-cai',
  user_management: import.meta.env.VITE_USER_MANAGEMENT_CANISTER_ID || 'lmizp-piaaa-aaaaa-qcwwq-cai',
  document_storage: import.meta.env.VITE_DOCUMENT_STORAGE_CANISTER_ID || '646az-pqaaa-aaaaa-qczja-cai',
  email_service: import.meta.env.VITE_EMAIL_SERVICE_CANISTER_ID || '5by6v-qyaaa-aaaaa-qc65a-cai',
  ledger_manager: import.meta.env.VITE_LEDGER_MANAGER_CANISTER_ID || 'hty74-maaaa-aaaaa-qcxza-cai',
  land_registry_integration: import.meta.env.VITE_LAND_REGISTRY_CANISTER_ID || 'o4flv-xaaaa-aaaaa-qdaeq-cai',
  message_manager: import.meta.env.VITE_MESSAGE_MANAGER_CANISTER_ID || '37una-maaaa-aaaaa-qd3mq-cai',
  skill_receipts: import.meta.env.VITE_SKILL_RECEIPTS_CANISTER_ID || 'f5gl2-eyaaa-aaaaa-qgypq-cai',
  entitlement: import.meta.env.VITE_ENTITLEMENT_CANISTER_ID || 'fiv22-eqaaa-aaaaa-qhcmq-cai',
  frontend: import.meta.env.VITE_ICP_CANISTER_ID || 'u4idr-jyaaa-aaaab-qco5q-cai',
};

// Production-only configuration - always use IC mainnet
const HOST = 'https://ic0.app';

// Internet Identity provider for II login flow (v7: passed at AuthClient construction time).
// v7 SDK opens this URL as-is and expects the authorize endpoint — v3 used to hash-route
// from the homepage, but v7 doesn't, so explicitly point at /authorize.
const II_PROVIDER = 'https://id.ai/authorize?feature_flag_guided_upgrade=true';

// A canister actor built by `Actor.createActor`.
//
// This is `any` because it is currently FORCED, not chosen. @propxchain/core-client
// advertises typed per-canister services (TransactionManagerService,
// UserManagementService, …) but its published dist ships a tsc-generated
// `*.did.d.ts` carrying only `idlFactory: any` — the Candid `_SERVICE`
// interface never makes it in, so all eight of those exported "types" resolve
// to `any`. Verified 2026-07-30 with an `0 extends (1 & T)` probe, alongside a
// control that correctly rejected a non-any type.
//
// One named, documented escape hatch is the honest encoding — better than
// thirteen bare `any`s that read as though nobody had looked. When core-client
// ships real declarations this becomes a one-line change.
//
// TODO(2026-07-30): replace with the real per-canister service types once
// core-client's dist carries them (needs fixing in the monorepo first).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CanisterActor = any;

// Candid `Result` variant returned by the transaction-manager canister. The
// actor is untyped (see CanisterActor above), so call sites pass the expected
// `ok` shape explicitly to recover narrowing on `'err' in result`.
type CandidResult<T> = { ok: T } | { err: string };

// `strict` gives catch bindings type `unknown`, which is correct — a thrown
// value need not be an Error. Narrow through here rather than asserting
// `error.message` on something that may be a string, a Candid reject object,
// or anything else the agent surfaced.
// Candid `opt T` encodes as a 0- or 1-element tuple. Writing `x != null ? [x] : []`
// inline widens to `T[]`, which the generated types reject — funnel through here.
function toOpt<T>(value: T | null | undefined): [] | [T] {
  return value != null ? [value] : [];
}

// Candid variant -> its key. The four keys match PropertyStatusString exactly
// (checked against property_registry.did), but this validates rather than
// asserting, so an unrecognised key from a future canister upgrade degrades to
// 'Listed' instead of smuggling an unmodelled string into the dashboard type.
const PROPERTY_STATUSES = ['Listed', 'InTransaction', 'Completed', 'Cancelled'] as const;
type PropertyStatusKey = (typeof PROPERTY_STATUSES)[number];

function propertyStatusKey(status: object): PropertyStatusKey {
  const key = Object.keys(status)[0];
  return (PROPERTY_STATUSES as readonly string[]).includes(key)
    ? (key as PropertyStatusKey)
    : 'Listed';
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error) return error;
  return fallback;
}

// Raw party-progress shapes as returned by the canister (pre-normalization).
// Fields stay `unknown` because they are coerced via normalizeParty/Number/Boolean.
type PartyGroupRaw = {
  parties?: unknown[];
  totalParties: unknown;
  completedParties: unknown;
  overallProgress: unknown;
  allAMLComplete: unknown;
};
type PartyProgressRaw = {
  buyers: PartyGroupRaw;
  sellers: PartyGroupRaw;
  readyToExchange: unknown;
};

/** Shape of one entry from getAllTransactions() / getTransactionSummary(). */
export type TransactionSummary = Record<string, unknown> & { id: string | number };

class ICPService {
  private agent: HttpAgent | null = null;
  private authClient: AuthClient | null = null;
  private propertyRegistryActor: ActorSubclass<PropertyRegistryService> | null = null;
  private _documentVerificationActor: ActorSubclass<DocumentVerificationService> | null = null;
  private transactionManagerActor: ActorSubclass<TransactionManagerService> | null = null;
  private userManagementActor: ActorSubclass<UserManagementService> | null = null;
  private _documentStorageActor: ActorSubclass<DocumentStorageService> | null = null;
  private emailServiceActor: ActorSubclass<EmailServiceService> | null = null;
  private ledgerManagerActor: ActorSubclass<LedgerManagerService> | null = null;
  private landRegistryIntegrationActor: ActorSubclass<LandRegistryIntegrationService> | null = null;

  // Per-browser-session identity used only for the public marketing-form
  // submitters on email_service. Anonymous calls into those methods now trap
  // canister-side, so unauthed visitors need a stable distinct principal —
  // otherwise every anon caller would share one rate-limit bucket again
  // (the bug this guards against). Persisted in localStorage so a refresh
  // does not reset the visitor's bucket.
  private marketingSessionIdentity: Ed25519KeyIdentity | null = null;
  private marketingFormActor: ActorSubclass<EmailServiceService> | null = null;
  private readonly MARKETING_SESSION_KEY = 'px_marketing_session_v1';

  // Flag: external identity (e.g. Supabase) has been set via setIdentity()
  private isExternalIdentitySet = false;
  // Store external identity for use by other services (e.g. message_manager)
  private externalIdentity: import('@propxchain/core-client').Identity | null = null;

  // Mutex for bootstrapAdmin() to prevent race condition
  private bootstrapAdminLock: Promise<{ success: boolean; message: string }> | null = null;

  // Mutex for initAuth() to prevent race condition during concurrent calls
  private initAuthLock: Promise<boolean> | null = null;

  // Rate limiting: Cache for getMyProfile (30 seconds minimum)
  private myProfileCache: { data: any; timestamp: number } | null = null;
  private readonly PROFILE_CACHE_TTL = 30000; // 30 seconds in milliseconds

  // Rate limiting: Debounced versions of frequently called methods
  private debouncedGetAllTransactions: ((...args: any[]) => Promise<any[]>) | null = null;

  // Rate limiting: Duplicate submission prevention for write operations (5 seconds)
  private submissionCache: Map<string, number> = new Map();
  private readonly DUPLICATE_SUBMISSION_TTL = 5000; // 5 seconds in milliseconds

  // Internal non-null accessors.
  //
  // Every call site is preceded by `if (!this.xActor) await this.initialize()`,
  // but TypeScript cannot carry that narrowing across the `await` — a property
  // access is re-widened once an intervening call could have reassigned it. So
  // the nullable field is read through these, which assert the invariant the
  // guard already relies on.
  //
  // Not merely to satisfy the compiler: these fields were `any`, so a failed
  // initialize() surfaced as "cannot read properties of null (reading
  // 'getTransaction')" from deep in a call chain. Now it names the canister
  // that is actually unavailable.
  private requireActor<T>(actor: T | null, canister: string): T {
    if (!actor) {
      throw new Error(`${canister} actor is not initialised — initialize() did not complete`);
    }
    return actor;
  }

  private get txActor(): ActorSubclass<TransactionManagerService> {
    return this.requireActor(this.transactionManagerActor, 'transaction_manager');
  }
  private get umActor(): ActorSubclass<UserManagementService> {
    return this.requireActor(this.userManagementActor, 'user_management');
  }
  private get lmActor(): ActorSubclass<LedgerManagerService> {
    return this.requireActor(this.ledgerManagerActor, 'ledger_manager');
  }
  private get lriActor(): ActorSubclass<LandRegistryIntegrationService> {
    return this.requireActor(this.landRegistryIntegrationActor, 'land_registry_integration');
  }
  private get dvActor(): ActorSubclass<DocumentVerificationService> {
    return this.requireActor(this._documentVerificationActor, 'document_verification');
  }
  private get dsActor(): ActorSubclass<DocumentStorageService> {
    return this.requireActor(this._documentStorageActor, 'document_storage');
  }
  private get esActor(): ActorSubclass<EmailServiceService> {
    return this.requireActor(this.emailServiceActor, 'email_service');
  }
  private get prActor(): ActorSubclass<PropertyRegistryService> {
    return this.requireActor(this.propertyRegistryActor, 'property_registry');
  }

  // Public "initialise then hand me the actor" accessors.
  //
  // The plain getters below stay nullable because callers legitimately use them
  // as an is-it-up check (`if (!icpService.documentStorageActor) …`). These are
  // for the other pattern — guard, initialise, then call — which TypeScript
  // cannot narrow across the await. Prefer these at call sites that are about
  // to use the actor.
  async requireUserManagement(): Promise<ActorSubclass<UserManagementService>> {
    if (!this.userManagementActor) await this.initialize();
    return this.umActor;
  }
  async requireTransactionManager(): Promise<ActorSubclass<TransactionManagerService>> {
    if (!this.transactionManagerActor) await this.initialize();
    return this.txActor;
  }
  async requireDocumentVerification(): Promise<ActorSubclass<DocumentVerificationService>> {
    if (!this._documentVerificationActor) await this.initialize();
    return this.dvActor;
  }
  async requireDocumentStorage(): Promise<ActorSubclass<DocumentStorageService>> {
    await this.ensureDocumentStorageActor();
    return this.dsActor;
  }

  // Public getters for actors (used by components directly)
  get documentVerificationActor() {
    return this._documentVerificationActor;
  }

  get documentStorageActor() {
    return this._documentStorageActor;
  }

  get transactionManager() {
    return this.transactionManagerActor;
  }

  get userManagement() {
    return this.userManagementActor;
  }

  get landRegistryIntegration() {
    return this.landRegistryIntegrationActor;
  }

  get ledgerManager() {
    return this.ledgerManagerActor;
  }

  /**
   * Initialize the ICP agent and create actors
   * IMPORTANT: This creates an anonymous agent by default
   * For authenticated calls, use initAuth() or login() first
   */
  async initialize() {
    try {
      // CRITICAL: Only create a new agent if one doesn't exist
      // This prevents overwriting authenticated agents
      if (!this.agent) {
        logger.info('🔧 initialize: Creating new anonymous agent');
        this.agent = new HttpAgent({ host: HOST });
      } else {
        logger.info('🔧 initialize: Reusing existing agent');
      }

      // Create actors for each canister
      this.propertyRegistryActor = Actor.createActor(propertyRegistryIdl, {
        agent: this.agent,
        canisterId: CANISTER_IDS.property_registry,
      });

      this._documentVerificationActor = Actor.createActor(documentVerificationIdl, {
        agent: this.agent,
        canisterId: CANISTER_IDS.document_verification,
      });

      this.transactionManagerActor = Actor.createActor(transactionManagerIdl, {
        agent: this.agent,
        canisterId: CANISTER_IDS.transaction_manager,
      });

      this.userManagementActor = Actor.createActor(userManagementIdl, {
        agent: this.agent,
        canisterId: CANISTER_IDS.user_management,
      });

      this.emailServiceActor = Actor.createActor(emailServiceIdl, {
        agent: this.agent,
        canisterId: CANISTER_IDS.email_service,
      });

      this.ledgerManagerActor = Actor.createActor(ledgerManagerIdl, {
        agent: this.agent,
        canisterId: CANISTER_IDS.ledger_manager,
      });

      this.landRegistryIntegrationActor = Actor.createActor(landRegistryIntegrationIdl, {
        agent: this.agent,
        canisterId: CANISTER_IDS.land_registry_integration,
      });

      // Document storage actor will be initialized on-demand
      logger.info('✅ ICP Service initialized successfully');
    } catch (error) {
      logger.error('❌ Failed to initialize ICP Service:', error);
      throw error;
    }
  }

  /**
   * Set an external identity (from Supabase key pair) and reinitialize actors
   * Used when authenticating via Supabase email/password instead of Internet Identity
   */
  async setIdentity(identity: import('@propxchain/core-client').Ed25519KeyIdentity): Promise<void> {
    this.isExternalIdentitySet = true;
    this.externalIdentity = identity;
    logger.info('🔧 setIdentity: Setting external identity');
    this.agent = new HttpAgent({ identity, host: HOST });
    // Recreate all actors with the new authenticated agent
    this.propertyRegistryActor = Actor.createActor(propertyRegistryIdl, {
      agent: this.agent,
      canisterId: CANISTER_IDS.property_registry,
    });
    this._documentVerificationActor = Actor.createActor(documentVerificationIdl, {
      agent: this.agent,
      canisterId: CANISTER_IDS.document_verification,
    });
    this.transactionManagerActor = Actor.createActor(transactionManagerIdl, {
      agent: this.agent,
      canisterId: CANISTER_IDS.transaction_manager,
    });
    this.userManagementActor = Actor.createActor(userManagementIdl, {
      agent: this.agent,
      canisterId: CANISTER_IDS.user_management,
    });
    this.emailServiceActor = Actor.createActor(emailServiceIdl, {
      agent: this.agent,
      canisterId: CANISTER_IDS.email_service,
    });
    this.ledgerManagerActor = Actor.createActor(ledgerManagerIdl, {
      agent: this.agent,
      canisterId: CANISTER_IDS.ledger_manager,
    });
    // Reset document storage actor so it gets recreated with the authenticated agent
    this._documentStorageActor = null;
    logger.info('✅ setIdentity: Actors recreated with external identity');
  }

  /**
   * Initialize Internet Identity authentication
   * Uses mutex pattern to prevent race conditions when called from multiple components
   * Reuses existing AuthClient if already created to prevent delegation chain issues
   */
  async initAuth(): Promise<boolean> {
    // If there's already an initAuth in progress, wait for it
    if (this.initAuthLock) {
      logger.info('🔍 initAuth: Waiting for existing initialization...');
      return this.initAuthLock;
    }

    // Start new initialization with mutex
    this.initAuthLock = this._doInitAuth();

    try {
      const result = await this.initAuthLock;
      return result;
    } finally {
      // Clear the lock after completion
      this.initAuthLock = null;
    }
  }

  /**
   * Internal implementation of initAuth (called with mutex protection)
   */
  private async _doInitAuth(): Promise<boolean> {
    logger.info('🔍 initAuth: Starting authentication check...');

    // DEV ONLY: Skip II auth check when running locally with explicit opt-in
    if (
      import.meta.env.DEV &&
      import.meta.env.VITE_ALLOW_DEV_AUTH === 'true' &&
      window.location.hostname === 'localhost' &&
      getStorePrincipalId() &&
      getStoreIsAuthenticated()
    ) {
      logger.info('initAuth: DEV MODE — skipping II, using Zustand principal');
      if (!this.authClient) {
        this.authClient = new AuthClient({ identityProvider: II_PROVIDER });
      }
      return true;
    }

    // If external identity (Supabase) is already set, skip II check
    if (this.isExternalIdentitySet) {
      logger.info('initAuth: External identity set (Supabase), skipping II check');
      return true;
    }

    // SINGLETON PATTERN: Reuse existing AuthClient if available
    // Creating multiple AuthClients causes delegation chain issues
    if (!this.authClient) {
      logger.info('🔍 initAuth: Creating new AuthClient');
      this.authClient = new AuthClient({ identityProvider: II_PROVIDER });
    } else {
      logger.info('🔍 initAuth: Reusing existing AuthClient');
    }

    // v7: getIdentity() loads any stored delegation from IndexedDB and is the
    // source of truth. isAuthenticated() reflects that load. Awaiting first.
    const storedIdentity = await this.authClient.getIdentity();
    const isAuthenticated = this.authClient.isAuthenticated();
    logger.info('🔍 initAuth: isAuthenticated =', isAuthenticated);

    if (isAuthenticated) {
      const identity = storedIdentity;
      const principal = identity.getPrincipal();
      logger.info('✅ initAuth: Found authenticated session');
      logger.info('✅ initAuth: Is Anonymous =', principal.isAnonymous());

      // Only recreate agent if it doesn't exist or is anonymous
      const currentPrincipal = this.agent ? await this.agent.getPrincipal() : null;
      const needsNewAgent = !this.agent ||
                           !currentPrincipal ||
                           currentPrincipal.isAnonymous() ||
                           currentPrincipal.toString() !== principal.toString();

      if (needsNewAgent) {
        logger.info('✅ initAuth: Creating new authenticated HttpAgent');
        this.agent = new HttpAgent({ identity, host: HOST });
        // Recreate actors with authenticated agent
        await this.initialize();
        logger.info('✅ initAuth: Actors recreated with authenticated agent');
      } else {
        logger.info('✅ initAuth: Reusing existing authenticated agent');
      }
    } else {
      logger.info('⚠️ initAuth: No authenticated session found');
      logger.info('⚠️ initAuth: User needs to complete Internet Identity login');

      // Even if not authenticated, check what identity we have
      const principal = storedIdentity.getPrincipal();
      logger.info('⚠️ initAuth: Is Anonymous =', principal.isAnonymous());
    }

    return isAuthenticated;
  }

  /**
   * Login with Internet Identity
   */
  async login() {
    logger.info('🔐 login: Starting Internet Identity login...');

    // SECURITY FIX: Clear any existing session before logging in
    if (this.authClient) {
      // v7: ensure storage is loaded so isAuthenticated reflects it
      await this.authClient.getIdentity();
      const wasAuthenticated = this.authClient.isAuthenticated();
      if (wasAuthenticated) {
        logger.info('⚠️ login: Clearing existing session before new login');
        await this.authClient.signOut();
      }
    }

    // Clear session auth data to prevent principal mismatch
    SessionManager.getInstance().clearSession();

    if (!this.authClient) {
      logger.info('🔐 login: Creating AuthClient...');
      await this.initAuth();
    }

    logger.info('🔐 login: Opening Internet Identity popup...');

    // v7: signIn() returns Promise<Identity>; identityProvider was set at AuthClient construction.
    const identity = await this.authClient!.signIn({
      maxTimeToLive: BigInt(24 * 60 * 60 * 1000 * 1000 * 1000), // 24 hours in nanoseconds
    });
    const principal = identity.getPrincipal();
    logger.info('✅ login: Authentication successful');
    logger.info('✅ login: Is Anonymous =', principal.isAnonymous());

    // SECURITY CHECK: Verify principal is not anonymous
    if (principal.isAnonymous()) {
      logger.error('❌ login: Received anonymous principal after authentication!');
      throw new Error('Authentication failed');
    }

    // Check if session is now authenticated
    const isAuth = this.authClient!.isAuthenticated();
    logger.info('✅ login: AuthClient.isAuthenticated() =', isAuth);

    this.agent = new HttpAgent({ identity, host: HOST });
    logger.info('✅ login: HttpAgent created with authenticated identity');

    await this.initialize();
    logger.info('✅ login: Actors initialized with authenticated agent');

    // SECURITY: Fetch CSRF token from backend after successful authentication
    try {
      await this.fetchAndStoreCsrfToken();
      logger.info('login: CSRF token fetched and stored');
    } catch (csrfError) {
      // CSRF token failure is non-fatal but logged as warning
      // Token will be re-fetched on next state-changing operation
      logger.warn('login: CSRF token fetch failed, will retry on next operation');
    }
  }

  /**
   * Logout
   */
  async logout() {
    this.isExternalIdentitySet = false;
    this.externalIdentity = null;
    logger.info('🚪 logout: Starting logout process...');

    // Clear session auth data
    SessionManager.getInstance().clearSession();
    logger.info('🚪 logout: Cleared session auth data');

    // Logout from Internet Identity (clears IndexedDB delegation)
    if (this.authClient) {
      await this.authClient.signOut();
      logger.info('🚪 logout: Internet Identity session cleared');
    }

    // Reinitialize with anonymous agent
    this.agent = null;
    this.authClient = null;
    await this.initialize();
    logger.info('🚪 logout: Reinitialized with anonymous agent');
  }

  /**
   * Check if Internet Identity session is still valid
   */
  async checkAuthStatus(): Promise<boolean> {
    if (this.isExternalIdentitySet) {
      return true;
    }
    try {
      // DEV ONLY: Trust Zustand state when running locally with explicit opt-in
      if (import.meta.env.DEV && import.meta.env.VITE_ALLOW_DEV_AUTH === 'true' && window.location.hostname === 'localhost' && getStorePrincipalId() && getStoreIsAuthenticated()) {
        return true;
      }
      if (!this.authClient) {
        await this.initAuth();
      }
      return await this.authClient!.isAuthenticated();
    } catch (error) {
      logger.error('Error checking auth status:', error);
      return false;
    }
  }

  /**
   * Get current user principal
   * Handles both Internet Identity and Supabase/email external identity
   */
  async getUserPrincipal(): Promise<string> {
    if (this.isExternalIdentitySet && this.externalIdentity) {
      return this.externalIdentity.getPrincipal().toText();
    }
    if (!this.authClient) {
      await this.initAuth();
    }
    const identity = await this.authClient!.getIdentity();
    return identity.getPrincipal().toString();
  }

  /**
   * Get authenticated identity for use by other services
   * Returns null if not authenticated
   * Handles both Internet Identity and Supabase/email external identity
   */
  async getAuthenticatedIdentity(): Promise<import('@propxchain/core-client').Identity | null> {
    // For Supabase/email users, the identity was stored when setIdentity() was called
    if (this.isExternalIdentitySet && this.externalIdentity) {
      return this.externalIdentity;
    }

    if (!this.authClient) {
      await this.initAuth();
    }

    // v7: load storage first, then read isAuthenticated
    const identity = await this.authClient!.getIdentity();
    const isAuthenticated = this.authClient!.isAuthenticated();
    if (!isAuthenticated) {
      return null;
    }

    if (identity.getPrincipal().isAnonymous()) {
      return null;
    }

    return identity;
  }

  /**
   * Get the authenticated HttpAgent for use by other services
   * Returns null if not authenticated
   * Handles both Internet Identity and Supabase/email external identity
   */
  async getAuthenticatedAgent(): Promise<HttpAgent | null> {
    // For Supabase/email users, return the existing agent (already has identity)
    if (this.isExternalIdentitySet && this.agent) {
      return this.agent;
    }

    const identity = await this.getAuthenticatedIdentity();
    if (!identity) {
      return null;
    }

    // Create a new agent with the authenticated identity
    const agent = new HttpAgent({ identity, host: HOST });
    return agent;
  }

  // ==================== Canister Management Methods ====================

  /**
   * Get a temporary actor for the IC management canister (aaaaa-aa).
   * Reuses the existing authenticated agent so the caller must be a controller.
   */
  private getManagementCanisterActor(): CanisterActor {
    const managementIdl = ({ IDL }: { IDL: any }) => {
      const CanisterSettings = IDL.Record({
        controllers: IDL.Opt(IDL.Vec(IDL.Principal)),
        compute_allocation: IDL.Opt(IDL.Nat),
        memory_allocation: IDL.Opt(IDL.Nat),
        freezing_threshold: IDL.Opt(IDL.Nat),
        reserved_cycles_limit: IDL.Opt(IDL.Nat),
        log_visibility: IDL.Opt(IDL.Variant({
          controllers: IDL.Null,
          public: IDL.Null,
        })),
        wasm_memory_limit: IDL.Opt(IDL.Nat),
        wasm_memory_threshold: IDL.Opt(IDL.Nat),
      });

      const DefiniteCanisterSettings = IDL.Record({
        controllers: IDL.Vec(IDL.Principal),
        compute_allocation: IDL.Nat,
        memory_allocation: IDL.Nat,
        freezing_threshold: IDL.Nat,
        reserved_cycles_limit: IDL.Nat,
        log_visibility: IDL.Variant({
          controllers: IDL.Null,
          public: IDL.Null,
        }),
        wasm_memory_limit: IDL.Nat,
        wasm_memory_threshold: IDL.Nat,
      });

      const CanisterStatusResultV2 = IDL.Record({
        status: IDL.Variant({ running: IDL.Null, stopping: IDL.Null, stopped: IDL.Null }),
        memory_size: IDL.Nat,
        cycles: IDL.Nat,
        settings: DefiniteCanisterSettings,
        module_hash: IDL.Opt(IDL.Vec(IDL.Nat8)),
        idle_cycles_burned_per_day: IDL.Nat,
      });

      const CanisterIdRecord = IDL.Record({ canister_id: IDL.Principal });

      // deposit_cycles is intentionally omitted — browser-based callers cannot
      // attach cycles to a call. Top-ups must be done via dfx from a terminal.
      return IDL.Service({
        'canister_status': IDL.Func([CanisterIdRecord], [CanisterStatusResultV2], []),
        'update_settings': IDL.Func([
          IDL.Record({
            canister_id: IDL.Principal,
            settings: CanisterSettings,
          }),
        ], [], []),
      });
    };

    return Actor.createActor(managementIdl, {
      agent: this.agent!,
      canisterId: 'aaaaa-aa',
    });
  }

  /**
   * Get full canister status from the management canister
   * Returns status including cycles, memory, freezing threshold, controllers, module hash.
   * The caller must be a controller of the canister.
   */
  async getCanisterFullStatus(canisterId: string): Promise<{
    cycles: bigint;
    memorySize: bigint;
    freezingThreshold: number;
    controllers: string[];
    status: string;
    moduleHash: string | null;
  } | null> {
    await this.initAuth();
    try {
      const mgmt = this.getManagementCanisterActor();
      const result = await mgmt.canister_status({ canister_id: Principal.fromText(canisterId) });

      return {
        cycles: BigInt(result.cycles.toString()),
        memorySize: BigInt(result.memory_size.toString()),
        freezingThreshold: Number(result.settings.freezing_threshold),
        controllers: result.settings.controllers.map((p: Principal) => p.toString()),
        status: Object.keys(result.status)[0] || 'unknown',
        moduleHash: result.module_hash[0]
          ? Array.isArray(result.module_hash[0])
            ? btoa(String.fromCharCode(...result.module_hash[0]))
            : null
          : null,
      };
    } catch (error) {
      logger.error(`Failed to get canister status for ${canisterId}:`, error);
      return null;
    }
  }

  /**
   * Update canister settings (freezing threshold, controllers, etc.)
   * Only specified fields are updated — null fields are left unchanged.
   */
  async updateCanisterSettings(
    canisterId: string,
    settings: {
      freezingThreshold?: number;
      controllers?: string[];
    }
  ): Promise<void> {
    await this.initAuth();
    const cacheKey = this.generateSubmissionCacheKey('updateCanisterSettings', {
      canisterId,
      freezingThreshold: settings.freezingThreshold,
    });
    if (this.isDuplicateSubmission(cacheKey)) {
      throw new Error('Duplicate settings update detected. Please wait a moment.');
    }

    const mgmt = this.getManagementCanisterActor();

    const settingsPayload: Record<string, any> = { canister_id: Principal.fromText(canisterId) };
    const canisterSettings: Record<string, any> = {};

    if (settings.freezingThreshold !== undefined) {
      canisterSettings.freezing_threshold = [BigInt(settings.freezingThreshold)];
    } else {
      canisterSettings.freezing_threshold = [];
    }

    if (settings.controllers !== undefined) {
      canisterSettings.controllers = [settings.controllers.map((p: string) => Principal.fromText(p))];
    } else {
      canisterSettings.controllers = [];
    }

    canisterSettings.compute_allocation = [];
    canisterSettings.memory_allocation = [];
    canisterSettings.reserved_cycles_limit = [];
    canisterSettings.log_visibility = [];
    canisterSettings.wasm_memory_limit = [];
    canisterSettings.wasm_memory_threshold = [];

    settingsPayload.settings = canisterSettings;

    logger.info(`⚙️ Updating settings for ${canisterId}`);
    await mgmt.update_settings(settingsPayload);
    logger.info(`✅ Settings updated for ${canisterId}`);
  }

  // ==================== CSRF Token Methods ====================

  /**
   * Fetch CSRF token from backend and store in session
   * Called automatically after login
   *
   * @throws Error if user_management actor is not initialized or token fetch fails
   */
  async fetchAndStoreCsrfToken(): Promise<void> {
    if (!this.userManagementActor) {
      await this.initialize();
    }

    // Retry logic for CSRF token fetch (canister calls can be flaky immediately after login)
    const maxRetries = 2;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Generate new CSRF token from backend
        const token = await this.umActor.generateCSRFToken();

        if (!token) {
          throw new Error('Backend returned empty CSRF token');
        }

        // Store token in SessionManager (sessionStorage)
        SessionManager.getInstance().updateCsrfToken(token);
        logger.info('🔒 CSRF token fetched and stored in session');
        return; // Success
      } catch (error) {
        lastError = error;
        if (attempt < maxRetries) {
          // Wait briefly before retry
          await new Promise(resolve => setTimeout(resolve, 500));
          logger.debug(`🔄 Retrying CSRF token fetch (attempt ${attempt + 1}/${maxRetries})`);
        }
      }
    }

    // Extract meaningful error message
    const errorMsg = lastError instanceof Error
      ? lastError.message
      : typeof lastError === 'string'
        ? lastError
        : 'Unknown canister error';
    logger.warn(`⚠️ CSRF token fetch failed after ${maxRetries} attempts: ${errorMsg}`);
    throw new Error('CSRF token fetch failed');
  }

  /**
   * Get CSRF token from session
   * Returns null if no token is available
   *
   * @returns CSRF token string or null
   */
  getCsrfToken(): string | null {
    return SessionManager.getInstance().getCsrfToken();
  }

  /**
   * Refresh CSRF token (fetch new token from backend)
   * Should be called after state-changing operations for token rotation
   *
   * @returns Promise that resolves when token is refreshed
   */
  async refreshCsrfToken(): Promise<void> {
    try {
      await this.fetchAndStoreCsrfToken();
      logger.info('🔄 CSRF token refreshed successfully');
    } catch (error) {
      logger.error('⚠️ Failed to refresh CSRF token:', error);
      throw error;
    }
  }

  /**
   * Validate that a CSRF token exists in session
   * Throws error if token is missing (for use before state-changing operations)
   *
   * @throws Error if CSRF token is not available
   */
  requireCsrfToken(): string {
    const token = this.getCsrfToken();
    if (!token) {
      throw new Error('CSRF token is required but not available in session. Please login again.');
    }
    return token;
  }

  // ==================== Document Storage CSRF Token ====================

  /**
   * Generate CSRF token from document_storage canister
   * This is separate from user_management CSRF tokens - each canister has its own token store
   *
   * @returns Promise<string> The CSRF token for document_storage operations
   */
  async getDocumentStorageCsrfToken(): Promise<string> {
    await this.ensureDocumentStorageActor();

    try {
      // Generate new CSRF token from document_storage canister
      const token = await this.dsActor.generateCSRFToken();

      if (!token) {
        throw new Error('Document storage returned empty CSRF token');
      }

      logger.info('🔒 Document storage CSRF token generated');
      return token;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('⚠️ Failed to generate document storage CSRF token:', errorMsg);
      throw new Error(`Document storage CSRF token generation failed: ${errorMsg}`);
    }
  }

  /**
   * Get agent diagnostics (for debugging)
   */
  async getAgentDiagnostics() {
    if (!this.agent) {
      return {
        hasAgent: false,
        principal: null,
        isAnonymous: null,
      };
    }

    const principal = await this.agent.getPrincipal();
    return {
      hasAgent: true,
      principal: principal.toString(),
      isAnonymous: principal.isAnonymous(),
    };
  }

  /**
   * Get cycle balance from all canisters (for admin dashboard)
   * Returns an object with canister names as keys and cycle balances as values
   */
  async getAllCanisterCycles(): Promise<{
    [key: string]: { cycles: bigint; canisterId: string; error?: string };
  }> {
    await this.initialize();

    const results: { [key: string]: { cycles: bigint; canisterId: string; error?: string } } = {};

    // Minimal IDL factory that only defines getCycles — used as a universal fallback
    // when the canister's full actor is unavailable or its IDL is out of sync.
    // All Motoko canisters implement: public query func getCycles() : async Nat
    const cyclesOnlyIdl = ({ IDL }: { IDL: any }) => {
      return IDL.Service({
        'getCycles': IDL.Func([], [IDL.Nat], ['query']),
      });
    };

    // All canisters — Motoko canisters expose getCycles(), asset canister doesn't
    const canisterQueries = [
      { name: 'frontend', actor: null as CanisterActor, id: CANISTER_IDS.frontend },
      { name: 'user_management', actor: this.userManagementActor, id: CANISTER_IDS.user_management },
      { name: 'property_registry', actor: this.propertyRegistryActor, id: CANISTER_IDS.property_registry },
      { name: 'document_storage', actor: this._documentStorageActor, id: CANISTER_IDS.document_storage },
      { name: 'transaction_manager', actor: this.transactionManagerActor, id: CANISTER_IDS.transaction_manager },
      { name: 'document_verification', actor: this._documentVerificationActor, id: CANISTER_IDS.document_verification },
      { name: 'email_service', actor: this.emailServiceActor, id: CANISTER_IDS.email_service },
      { name: 'ledger_manager', actor: this.ledgerManagerActor, id: CANISTER_IDS.ledger_manager },
      { name: 'land_registry_integration', actor: this.landRegistryIntegrationActor, id: CANISTER_IDS.land_registry_integration },
      { name: 'message_manager', actor: null as CanisterActor, id: CANISTER_IDS.message_manager },
      { name: 'skill_receipts', actor: null as CanisterActor, id: CANISTER_IDS.skill_receipts },
      { name: 'entitlement', actor: null as CanisterActor, id: CANISTER_IDS.entitlement },
    ];

    // Query all canisters in parallel
    await Promise.all(
      canisterQueries.map(async ({ name, actor, id }) => {
        if (!id) {
          results[name] = { cycles: BigInt(0), canisterId: id, error: 'No canister ID configured' };
          return;
        }
        try {
          // Try the existing actor's getCycles first
          if (actor && typeof actor.getCycles === 'function') {
            const cycles = await actor.getCycles();
            results[name] = { cycles: BigInt(cycles), canisterId: id };
          } else {
            // Fallback: create a temporary actor with cycles-only IDL
            const tempActor = Actor.createActor(cyclesOnlyIdl, {
              agent: this.agent!,
              canisterId: id,
            });
            const cycles = await tempActor.getCycles();
            results[name] = { cycles: BigInt(cycles as bigint), canisterId: id };
          }
        } catch (error) {
          logger.error(`Failed to get cycles for ${name}:`, error);
          results[name] = { cycles: BigInt(0), canisterId: id, error: errorMessage(error, 'Unknown error') };
        }
      })
    );

    return results;
  }

  // ==================== Property Registry Methods ====================

  /**
   * Register a new property
   */
  async registerProperty(data: {
    address: string;
    price: number;
    size: number;
    propertyType: string;
    description: string;
  }) {
    if (!this.propertyRegistryActor) await this.initialize();

    const propertyId = await this.prActor.registerProperty(
      data.address,
      BigInt(data.price),
      BigInt(data.size),
      data.propertyType,
      data.description
    );

    return { propertyId: Number(propertyId) };
  }

  /**
   * Get property by ID
   */
  async getProperty(id: number) {
    return wrapReadCall(async () => {
      if (!this.propertyRegistryActor) await this.initialize();

      const result = await this.prActor.getProperty(BigInt(id));
      return result[0] || null; // Handle Option type
    });
  }

  /**
   * Get all properties
   */
  async getAllProperties() {
    return wrapReadCall(async () => {
      if (!this.propertyRegistryActor) await this.initialize();

      const properties = await this.prActor.getAllProperties();
      return properties.map((p) => ({
        id: Number(p.id),
        address: String(p.address),
        owner: (p.owner as { toString(): string }).toString(),
        price: Number(p.price),
        size: Number(p.size),
        propertyType: String(p.propertyType),
        description: String(p.description),
        attestedBy: (p.attestedBy as unknown[])?.[0] ? String((p.attestedBy as unknown[])[0]) : undefined,
        attestedAt: (p.attestedAt as unknown[])?.[0] ? Number((p.attestedAt as unknown[])[0]) : undefined,
        createdAt: Number(p.createdAt),
        status: propertyStatusKey(p.status),
        transactionId: (p.transactionId as unknown[])?.[0] ? String((p.transactionId as unknown[])[0]) : undefined,
        documentsComplete: Boolean(p.documentsComplete),
        searchesComplete: Boolean(p.searchesComplete),
        financingComplete: Boolean(p.financingComplete),
      }));
    });
  }

  /**
   * Attest that a property's recorded details are correct (ADR 0018).
   * The canister allows the owner, their conveyancer, or an agent the owner
   * has delegated to on the transaction; anyone else gets false.
   */
  async attestProperty(id: number) {
    return wrapWriteCall(async () => {
      if (!this.propertyRegistryActor) await this.initialize();

      const success = await this.prActor.attestProperty(BigInt(id));
      return { success };
    });
  }

  /**
   * Transfer property ownership
   */
  async transferProperty(propertyId: number, newOwnerPrincipal: string) {
    return wrapWriteCall(async () => {
      if (!this.propertyRegistryActor) await this.initialize();

      const success = await this.prActor.transferOwnership(
        BigInt(propertyId),
        Principal.fromText(newOwnerPrincipal)
      );
      return { success };
    });
  }

  // ==================== User Management Methods ====================

  /**
   * Register a new user
   * IMPORTANT: Must use authenticated agent so msg.caller is the user's principal
   */
  async registerUser(data: { name: string; email: string; mobile: string; userType: string }) {
    // CRITICAL: Ensure we have an authenticated agent, not anonymous
    if (!this.userManagementActor) {
      await this.initAuth(); // Use initAuth, not initialize
    }

    // NOTE: CSRF token is NOT used for registerUser because:
    // 1. New users can't have a CSRF token yet (chicken-and-egg problem)
    // 2. Internet Identity already authenticates the caller via msg.caller
    // 3. CSRF protection is for state-changing operations on behalf of existing users

    logger.info('📝 registerUser: Calling canister with:', data);

    const success = await this.umActor.registerUser(
      data.name,
      data.email,
      data.mobile,
      data.userType
    );

    logger.info('📝 registerUser: Canister returned:', success);
    return { success };
  }

  /**
   * Mirror Supabase / II signup metadata onto user_management so the caller's
   * principal has a UserProfile (name + email + mobile + userType). Idempotent
   * via getUserProfile pre-check — registerUser overwrites blindly, so this
   * guard prevents clobbering an established profile.
   *
   * Caller MUST have invoked setIdentity() (Supabase) or initAuth() (II)
   * first, so msg.caller resolves to the user's principal.
   */
  async ensureUserProfileOnChain(meta: {
    principalId: string;
    name: string;
    email: string;
    mobile?: string;
    userType: string;
  }): Promise<'created' | 'exists' | 'skipped' | 'failed'> {
    if (!this.userManagementActor) return 'skipped';
    if (!meta.principalId || !meta.name || !meta.email) return 'skipped';

    try {
      const existing = await this.getUserProfile(meta.principalId);
      if (existing?.name) return 'exists';

      const { success } = await this.registerUser({
        name: meta.name,
        email: meta.email,
        mobile: meta.mobile || '',
        userType: meta.userType,
      });
      if (success) {
        logger.info('✅ ensureUserProfileOnChain: registered', meta.principalId);
        return 'created';
      }
      logger.warn('⚠️ ensureUserProfileOnChain: registerUser returned false');
      return 'failed';
    } catch (err) {
      logger.warn('⚠️ ensureUserProfileOnChain failed:', err);
      return 'failed';
    }
  }

  /**
   * Get current user's profile (query call - can be cached)
   * Rate limited: Cached for 30 seconds minimum to prevent excessive calls
   */
  async getMyProfile() {
    logger.info('👤 getMyProfile: Starting...');
    logger.info('👤 getMyProfile: Using canister ID =', CANISTER_IDS.user_management);

    // Check cache first (30 seconds TTL)
    const now = Date.now();
    if (this.myProfileCache && (now - this.myProfileCache.timestamp) < this.PROFILE_CACHE_TTL) {
      logger.info('getMyProfile: Returning cached result (age: ' + Math.round((now - this.myProfileCache.timestamp) / 1000) + 's)');
      return this.myProfileCache.data;
    }

    if (!this.userManagementActor) {
      logger.info('👤 getMyProfile: Initializing actors...');
      await this.initialize();
    }

    // CRITICAL: Verify agent principal matches session principal
    const storedPrincipal = SessionManager.getInstance().getSessionData()?.principalId;
    if (this.agent && storedPrincipal) {
      const agentPrincipal = await this.agent.getPrincipal();
      logger.info('👤 getMyProfile: Verifying principal');
      logger.info('👤 getMyProfile: Is Anonymous =', agentPrincipal.isAnonymous());

      // If agent is anonymous but we have a stored principal, try to restore session
      if (agentPrincipal.isAnonymous() && storedPrincipal) {
        logger.info('⚠️ getMyProfile: Agent is anonymous but principal is stored - checking session...');
        try {
          // Try to restore session via Internet Identity
          const isAuthenticated = await this.initAuth();

          // If session could not be restored (expired/timeout), clear auth and return null
          if (!isAuthenticated) {
            logger.error('❌ SESSION EXPIRED: Internet Identity session has timed out');
            logger.info('🔄 Clearing local auth state and requiring re-login...');
            SessionManager.getInstance().clearSession();
            if (this.authClient) {
              await this.authClient.signOut();
            }
            return null;
          }

          // Session was restored - reinitialize actors with authenticated agent
          await this.initialize();

          // Re-check after restoration
          const restoredPrincipal = await this.agent!.getPrincipal();
          logger.info('✅ getMyProfile: Session restored successfully');

          // If still doesn't match after restoration, force logout
          if (restoredPrincipal.toString() !== storedPrincipal) {
            throw new Error('Session restoration failed');
          }
        } catch (error) {
          logger.error('❌ SECURITY: Failed to restore session');
          SessionManager.getInstance().clearSession();
          if (this.authClient) {
            await this.authClient.signOut();
          }
          return null;
        }
      } else if (agentPrincipal.toString() !== storedPrincipal) {
        // Principals don't match and agent is not anonymous - this is a hijacking attempt
        logger.error('❌ SECURITY: Session validation failed');
        logger.error('❌ Forcing logout and requiring re-authentication...');

        // Clear all auth data
        SessionManager.getInstance().clearSession();

        // Logout from Internet Identity
        if (this.authClient) {
          await this.authClient.signOut();
        }

        // Return null to indicate auth failure
        return null;
      }
    } else if (!this.agent) {
      logger.info('⚠️ getMyProfile: No agent available!');
    }

    logger.info('👤 getMyProfile: Calling userManagementActor.getMyProfile()...');
    const result = await this.umActor.getMyProfile();
    logger.info('👤 getMyProfile: Result =', result);

    if (result.length > 0 && result[0]) {
      const user = result[0];
      // Convert userType variant to string (e.g., {diy_buyer: null} -> "diy_buyer")
      const userTypeString = typeof user.userType === 'string'
        ? user.userType
        : Object.keys(user.userType)[0] || 'buyer';

      logger.info('✅ getMyProfile: Found user profile');

      const profileData = {
        principal: user.principal.toString(),
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        userType: userTypeString,
        isVerified: user.isVerified,
        createdAt: Number(user.createdAt),
      };

      // Cache the result for 30 seconds
      this.myProfileCache = {
        data: profileData,
        timestamp: Date.now()
      };

      return profileData;
    }

    logger.info('⚠️ getMyProfile: No profile found for current principal');

    // Cache null result to prevent repeated failed calls
    const nullResult = null;
    this.myProfileCache = {
      data: nullResult,
      timestamp: Date.now()
    };

    return nullResult;
  }

  /**
   * Get current user's profile (update call - bypasses cache, fresh data)
   * Use this immediately after registration to avoid boundary node cache issues
   */
  async getMyProfileFresh() {
    logger.info('👤 getMyProfileFresh: Starting (update call)...');

    // Clear the cache since this is an explicit fresh fetch
    this.myProfileCache = null;

    if (!this.userManagementActor) {
      logger.info('👤 getMyProfileFresh: Initializing actors...');
      await this.initialize();
    }

    logger.info('👤 getMyProfileFresh: Calling userManagementActor.getMyProfileUpdate()...');
    const result = await this.umActor.getMyProfileUpdate();
    logger.info('👤 getMyProfileFresh: Result =', result);

    if (result.length > 0 && result[0]) {
      const user = result[0];
      // Convert userType variant to string
      const userTypeString = typeof user.userType === 'string'
        ? user.userType
        : Object.keys(user.userType)[0] || 'buyer';

      logger.info('✅ getMyProfileFresh: Found user profile');

      return {
        principal: user.principal.toString(),
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        userType: userTypeString,
        isVerified: user.isVerified,
        createdAt: Number(user.createdAt),
      };
    }

    logger.info('⚠️ getMyProfileFresh: No profile found');
    return null;
  }

  /**
   * Get all principals linked to the current caller
   */
  async getMyLinkedPrincipals(): Promise<string[]> {
    if (!this.userManagementActor) await this.initialize();
    return wrapReadCall(async () => {
      try {
        const principals = await this.umActor.getMyLinkedPrincipals();
        return principals.map((p: { toText?: () => string }) => p.toText?.() ?? String(p));
      } catch (error) {
        logger.error('Error fetching linked principals:', error);
        return [];
      }
    });
  }

  /**
   * Get all users (admin function)
   * Rate limited via wrapReadCall
   */
  async getAllUsers() {
    if (!this.userManagementActor) await this.initialize();

    return wrapReadCall(async () => {
      try {
        const users = await this.umActor.getAllUsers();

        if (!Array.isArray(users)) {
          logger.warn('getAllUsers returned non-array:', users);
          return [];
        }

        return users.map((u) => {
          const userTypeString = typeof u.userType === 'string'
            ? u.userType
            : Object.keys(u.userType)[0] || 'buyer';
          return {
            id: u.principal.toString(),
            principal: u.principal.toString(),
            name: u.name,
            email: u.email,
            mobile: u.mobile,
            // `username` is not a UserProfile field — it was always undefined.
            userType: userTypeString,
            isVerified: u.isVerified,
            createdAt: Number(u.createdAt),
          };
        });
      } catch (error) {
        logger.error('Error in getAllUsers:', error);
        return [];
      }
    });
  }

  /**
   * Get user profile by principal ID
   */
  async getUserProfile(principalId: string) {
    if (!this.userManagementActor) await this.initialize();

    try {
      const { Principal } = await import('@propxchain/core-client');
      const principal = Principal.fromText(principalId);
      const result = await this.umActor.getUserProfile(principal);

      if (result && result.length > 0 && result[0]) {
        const user = result[0];
        const userTypeString = typeof user.userType === 'string'
          ? user.userType
          : Object.keys(user.userType)[0] || 'buyer';

        return {
          principal: user.principal.toString(),
          name: user.name,
          email: user.email,
          mobile: user.mobile,
          userType: userTypeString,
          isVerified: user.isVerified,
          createdAt: Number(user.createdAt),
        };
      }
      return null;
    } catch (error) {
      logger.info('⚠️ getUserProfile: Failed for principal', principalId, error);
      return null;
    }
  }

  // ==================== Transaction Manager Methods ====================

  /**
   * Create a blockchain transaction with full wizard data
   */
  async createTransaction(data: {
    propertyId: string;
    propertyAddress: string;
    postcode: string;
    titleNumber: string;
    previousOwner: string;
    amount: number;
    transactionType: string;
    userRole: string;
    propertyType: string;
    propertyCategory: string;
    mode: string;
    deposit: number;
    mortgageAmount: number;
    completionDate: string;
    seller?: string; // Optional seller principal (for testing)
  }) {
    // Check for duplicate submission (5 second window)
    const cacheKey = this.generateSubmissionCacheKey('createTransaction', data);
    if (this.isDuplicateSubmission(cacheKey)) {
      throw new Error('Duplicate transaction submission detected. Please wait a moment before trying again.');
    }

    // Wrap with rate limiting and retry logic
    return wrapWriteCall(async () => {
      if (!this.transactionManagerActor) await this.initialize();

      // Get the current agent's principal to use as seller (or use provided seller)
      const sellerPrincipal = data.seller
        ? Principal.fromText(data.seller)
        : await this.agent!.getPrincipal();

      // Validate numeric values before conversion
      if (isNaN(data.amount) || isNaN(data.deposit) || isNaN(data.mortgageAmount)) {
        throw new Error(`Invalid numeric values: amount=${data.amount}, deposit=${data.deposit}, mortgage=${data.mortgageAmount}`);
      }

      const transactionId = await this.txActor.createTransaction(
        data.propertyId,
        data.propertyAddress,
        data.postcode,
        data.titleNumber,
        sellerPrincipal,
        data.previousOwner,
        BigInt(Math.floor(data.amount)),
        data.transactionType,
        data.userRole,
        data.propertyType,
        data.propertyCategory,
        data.mode,
        BigInt(Math.floor(data.deposit)),
        BigInt(Math.floor(data.mortgageAmount)),
        data.completionDate
      );

      return { success: true, transactionId };
    }, { cacheKey });
  }

  /**
   * Download document - Not supported in hash-only architecture
   * Documents are stored locally by users, only hashes are on-chain for GDPR compliance
   * @throws Error explaining the hash-only architecture
   */
  async downloadDocument(_documentId: string): Promise<Blob> {
    throw new Error(
      'Document download not available. PropXchain uses hash-only storage for GDPR compliance. ' +
      'Documents are stored locally on your device - only verification hashes are stored on-chain.'
    );
  }

  /**
   * Update transaction status
   */
  async updateTransactionStatus(transactionId: number, status: string) {
    // Check for duplicate submission (5 second window)
    const cacheKey = this.generateSubmissionCacheKey('updateTransactionStatus', { transactionId, status });
    if (this.isDuplicateSubmission(cacheKey)) {
      throw new Error('Duplicate status update detected. Please wait a moment before trying again.');
    }

    // Wrap with rate limiting and retry logic
    return wrapWriteCall(async () => {
      if (!this.transactionManagerActor) await this.initialize();

      const success = await this.txActor.updateTransactionStatus(
        BigInt(transactionId),
        status
      );

      return { success };
    }, { cacheKey });
  }

  /**
   * Get transaction by ID (supports both number and string IDs)
   */
  async getTransaction(id: number | string) {
    return wrapReadCall(async () => {
      if (!this.transactionManagerActor) await this.initialize();

      // Convert to string format if it's a number (e.g., 5 -> "TX-5")
      const txId = typeof id === 'string' ? id : `TX-${id}`;

      const result = await this.txActor.getTransaction(txId);
      return result[0] || null;
    });
  }

  /**
   * F.1 — Read the next-step recommendation for a transaction.
   * Single source of truth: same composite query feeds the dashboard
   * `<NextStepCard />` and the MCP `propxchain_next_step` tool. Returns
   * a `Result` variant — caller unwraps `ok` / `err`.
   */
  async getNextStep(transactionId: string) {
    return wrapReadCall(async () => {
      if (!this.transactionManagerActor) await this.initialize();
      return this.txActor.getNextStep(transactionId);
    });
  }

  /**
   * Update the HMLR title number on a transaction. Seller-only on the
   * canister side. Returns canister Result — caller unwraps ok/err.
   *
   * Sellers often discover the correct title number after listing, so the
   * canister keeps the field updateable post-creation. Without this path,
   * `getNextStep` stays stuck on `title_number_not_provided` forever.
   */
  async updateTitleNumber(transactionId: string, newTitleNumber: string): Promise<{ ok: string } | { err: string }> {
    return wrapWriteCall(async () => {
      await this.initAuth();
      return this.txActor.updateTitleNumber(transactionId, newTitleNumber);
    });
  }

  /**
   * Record that the HMLR title register has been fetched for a transaction.
   * Seller / conveyancer / platform on the canister side; idempotent
   * (first write wins). Anchors the register's content hash on-chain — the
   * register is general/non-PII (doc-access matrix: On+hash), so never any
   * plaintext.
   *
   * This is the on-chain milestone that clears `hmlr_not_fetched` in
   * getNextStep — without it the blocker is permanent, the same gap
   * updateTitleNumber closes for `title_number_not_provided`. Returns the
   * canister Result; callers treat failure as non-fatal (the register is
   * already fetched and the document_storage write sets the same milestone
   * via onDocumentRegistered).
   */
  async recordHmlrFetched(
    transactionId: string,
    titleNumber: string,
    responseHash: string,
  ): Promise<{ ok: null } | { err: string }> {
    return wrapWriteCall(async () => {
      await this.initAuth();
      // Guard the canary gap: if the published core-client IDL predates the
      // method, the actor proxy won't expose it. The canister's
      // onDocumentRegistered path still records the milestone when the
      // register doc was written, so this degrades to a soft no-op.
      if (typeof this.transactionManagerActor?.recordHmlrFetched !== 'function') {
        return { err: 'recordHmlrFetched not in current core-client IDL — relying on onDocumentRegistered' };
      }
      return this.txActor.recordHmlrFetched(transactionId, titleNumber, responseHash);
    });
  }

  /**
   * Store listing data (property listing JSON) on-chain for a transaction.
   */
  async setListingData(transactionId: string, listing: Record<string, unknown>): Promise<void> {
    await this.initAuth();
    const json = JSON.stringify(listing);
    logger.warn(`[RM] setListingData: txId=${transactionId}, payload=${json.length} bytes`);
    try {
      const result = await this.txActor.setListingData(transactionId, json);
      if ('err' in result) {
        logger.warn('[RM] setListingData canister error:', result.err);
        // Throw so callers can detect failure — a canister-level `err` is a real
        // failure, not success. Without this it resolved silently and a failed
        // on-chain write was indistinguishable from a successful one.
        throw new Error(`setListingData rejected: ${result.err}`);
      }
      logger.warn('[RM] setListingData success:', result.ok);
    } catch (err: unknown) {
      const e = err as { message?: string; code?: string; reject_code?: number; reject_message?: string };
      logger.warn('[RM] setListingData reject:', e.message, 'code:', e.reject_code, 'reject_msg:', e.reject_message);
      throw err;
    }
  }

  /**
   * Retrieve listing data from on-chain storage.
   */
  async getListingData(transactionId: string): Promise<Record<string, unknown> | null> {
    return wrapReadCall(async () => {
      await this.initAuth();
      const result = await this.txActor.getListingData(transactionId);
      if (result && result.length > 0 && result[0]) {
        return JSON.parse(result[0]) as Record<string, unknown>;
      }
      return null;
    });
  }

  /**
   * Store flow state (completed stages + provider selections) on-chain.
   */
  async setFlowState(transactionId: string, state: { completedStages: Record<string, number>; providerSelections: Record<string, unknown> }): Promise<void> {
    await this.initAuth();
    if (!this.transactionManagerActor) await this.initialize();
    const json = JSON.stringify(state);
    try {
      const result = await this.txActor.setFlowState(transactionId, json);
      if ('err' in result) {
        logger.error('[Flow] setFlowState canister error:', result.err);
      }
    } catch (err: unknown) {
      logger.error('[Flow] setFlowState failed:', err);
    }
  }

  // NOTE: `getCurrentPhase` was removed in Ship 2d. Phase derivation now
  // runs client-side in services/phase.ts. The canister still exposes the
  // method for backwards compatibility but nothing in the frontend calls it.

  /**
   * Retrieve flow state from on-chain storage.
   */
  async getFlowState(transactionId: string): Promise<{ completedStages: Record<string, number>; providerSelections: Record<string, unknown> } | null> {
    return wrapReadCall(async () => {
      await this.initAuth();
      if (!this.transactionManagerActor) await this.initialize();
      const result = await this.txActor.getFlowState(transactionId);
      if (result && result.length > 0 && result[0]) {
        return JSON.parse(result[0]) as { completedStages: Record<string, number>; providerSelections: Record<string, unknown> };
      }
      return null;
    });
  }

  /**
   * Get all transactions
   * Rate limited: Debounced with 500ms delay and rate limited to 10 calls per minute
   */
  async getAllTransactions() {
    // Ensure the actor is bound to the authenticated identity. Without this,
    // an anonymous actor (created on first page load) leaks past login and
    // the admin call is treated as anonymous → empty list.
    await this.initAuth();
    if (!this.transactionManagerActor) await this.initialize();

    // Initialize debounced version on first call. Captured in a local so it
    // narrows to non-null for the invocation below.
    let debounced = this.debouncedGetAllTransactions;
    if (!debounced) {
      debounced = debounceAsync(
        async () => {
          // Actual implementation wrapped with rate limiting
          return wrapReadCall(async () => {
            try {
              const transactions = await this.txActor.getAllTransactions();

              // Ensure transactions is an array before mapping
              if (!Array.isArray(transactions)) {
                logger.warn('getAllTransactions returned non-array:', transactions);
                return [];
              }

              return this._mapTransactions(transactions);
            } catch (error) {
              logger.error('Error in getAllTransactions:', error);
              return [];
            }
          });
        },
        500, // 500ms debounce delay
        { trailing: true, leading: false }
      );
      this.debouncedGetAllTransactions = debounced;
    }

    // Call the debounced function
    return debounced();
  }

  /**
   * Raw AI transaction-insights passthrough from the transaction-manager
   * canister. Returns undefined when the canister or method is unavailable, so
   * callers fall back to local analysis. Wraps the private actor so callers
   * don't reach into ICPService internals.
   */
  async getTransactionInsights(transactionId: string): Promise<unknown> {
    if (!this.transactionManagerActor) await this.initialize();
    // Deliberately not in the Candid interface: this method is optional on the
    // deployed canister, hence the `?.` chain and the documented undefined
    // fallback above. The cast states that intent — it is a capability probe,
    // not a call we expect the generated types to know about. If it ever lands
    // in the .did, delete the cast and let the real signature take over.
    const actor = this.transactionManagerActor as
      | (ActorSubclass<TransactionManagerService> & {
          getTransactionInsights?: (id: string) => Promise<unknown>;
        })
      | null;
    return actor?.getTransactionInsights?.(transactionId);
  }

  /**
   * Map transaction data from canister format to frontend format
   * @private
   */
  /**
   * One transaction in the same shape getAllTransactions() returns, for any
   * party to it (getAllTransactions is an admin listing — empty for everyone
   * else). Null when the record does not exist or the caller cannot read it.
   */
  async getTransactionSummary(id: number | string): Promise<TransactionSummary | null> {
    const raw = await this.getTransaction(id);
    if (!raw) return null;
    return (this._mapTransactions([raw])[0] as TransactionSummary | undefined) ?? null;
  }

  private _mapTransactions(transactions: any[]) {
    // Per-record try/catch so one malformed transaction (e.g. a draft with a
    // null seller/createdBy) doesn't blank the entire admin list.
    const mapped: any[] = [];
    for (const tx of transactions) {
      try {
        // Handle variant status - extract the variant key
        let statusString: any = 'active';
        if (tx.status) {
          if (typeof tx.status === 'object') {
            // It's a variant like { active: null } or { exchanged: null }
            statusString = Object.keys(tx.status)[0] || 'active';
          } else {
            statusString = String(tx.status);
          }
        }

        mapped.push({
          id: typeof tx.id === 'bigint' ? Number(tx.id) : tx.id,
          propertyId: tx.propertyId,
          propertyAddress: tx.propertyAddress,
          postcode: tx.postcode,
          titleNumber: tx.titleNumber,
          seller: tx.seller?.toString?.() ?? '',
          buyer: tx.buyer ? tx.buyer.toString() : null,
          amount: Number(tx.amount),
          status: statusString as any,
          oldStatus: tx.oldStatus || 'pending',
          solicitor: tx.solicitor ? tx.solicitor.toString() : null,
          createdAt: Number(tx.createdAt),
          previousOwner: tx.previousOwner,
          createdBy: tx.createdBy?.toString?.() ?? '',
          accessList: tx.accessList?.map((p: unknown) => (typeof p === 'string' ? p : String(p ?? ''))) || [],
          inviteCode: tx.inviteCode,
          chainedTransactions: tx.chainedTransactions || [],
          chainPosition: tx.chainPosition || null,
          blockchainCompletedAt: tx.blockchainCompletedAt ? Number(tx.blockchainCompletedAt) : null,
          landRegistryRegisteredAt: tx.landRegistryRegisteredAt ? Number(tx.landRegistryRegisteredAt) : null,
          // Wizard data - all stored on blockchain
          transactionType: tx.transactionType,
          userRole: tx.userRole,
          propertyType: tx.propertyType,
          propertyCategory: tx.propertyCategory,
          mode: tx.mode,
          deposit: Number(tx.deposit),
          mortgageAmount: Number(tx.mortgageAmount),
          completionDate: tx.completionDate,
          // Construct financialTerms object for compatibility with UI
          financialTerms: {
            purchasePrice: Number(tx.amount),
            deposit: Number(tx.deposit),
            mortgageAmount: Number(tx.mortgageAmount),
            completionDate: tx.completionDate,
            specialConditions: tx.specialConditions || '',
            fixturesFittings: tx.fixturesFittings || {
              standardItems: [],
              additionalItems: ''
            },
            apportionments: tx.apportionments || ''
          },
          // Add missing fields for transaction detail page
          milestones: tx.milestones || [],
          parties: tx.parties || [],
          documents: tx.documents || [],
          encumbrances: tx.encumbrances,
          buildingHeight: tx.buildingHeight,
          heritageStatus: tx.heritageStatus,
          constructionAge: tx.constructionAge,
        });
      } catch (err) {
        logger.warn('Skipping malformed transaction in admin list', { id: tx?.id, err });
      }
    }
    return mapped;
  }

  /**
   * Record contract exchange with solicitor signatures on blockchain
   */
  async recordContractExchange(
    transactionId: string,
    buyerSolicitorSignature: string,
    sellerSolicitorSignature: string
  ): Promise<{ success: boolean; message: string }> {
    return wrapWriteCall(async () => {
      if (!this.transactionManagerActor) await this.initialize();

      try {
        const result = await this.txActor.recordContractExchange(
          transactionId,
          buyerSolicitorSignature,
          sellerSolicitorSignature
        );

        if ('ok' in result) {
          return { success: true, message: result.ok };
        } else if ('err' in result) {
          return { success: false, message: result.err };
        }
        return { success: false, message: 'Unknown error occurred' };
      } catch (error) {
        logger.error('Error recording contract exchange');
        return { success: false, message: 'Failed to record contract exchange' };
      }
    });
  }

  /**
   * Record a single party's signature on-chain.
   * Caller must specify their signing role explicitly to prevent
   * dual-signing when buyer == seller (e.g. before buyer joins).
   * When both parties have signed, status auto-advances to #exchanged.
   */
  async recordPartySignature(
    transactionId: string,
    signatureHash: string,
    signingRole: 'buyer' | 'seller'
  ): Promise<{ success: boolean; message: string }> {
    return wrapWriteCall(async () => {
      if (!this.transactionManagerActor) await this.initialize();

      try {
        const result = await this.txActor.recordPartySignature(
          transactionId,
          signatureHash,
          signingRole
        );

        if ('ok' in result) {
          return { success: true, message: result.ok };
        } else if ('err' in result) {
          return { success: false, message: result.err };
        }
        return { success: false, message: 'Unknown error occurred' };
      } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error('Error recording party signature:', errorMsg);
        return { success: false, message: errorMsg || 'Failed to record signature on blockchain' };
      }
    });
  }

  /**
   * Initiate blockchain completion after contract exchange
   * Updates transaction status from 'exchanged' to 'completion_initiated'
   */
  async initiateCompletion(
    transactionId: string,
    buyerFundsHash: string,
    completionStatementHash: string
  ): Promise<{ success: boolean; message: string }> {
    return wrapWriteCall(async () => {
      if (!this.transactionManagerActor) await this.initialize();

      try {
        logger.info('🚀 Initiating blockchain completion for transaction:', transactionId);

        const result = await this.txActor.initiate_blockchain_completion(
          transactionId,
          buyerFundsHash,
          completionStatementHash
        );

        if ('ok' in result) {
          logger.info('✅ Blockchain completion initiated:', result.ok);
          return { success: true, message: result.ok };
        } else if ('err' in result) {
          logger.error('❌ Completion initiation failed:', result.err);
          return { success: false, message: result.err };
        }
        return { success: false, message: 'Unknown error occurred' };
      } catch (error) {
        logger.error('❌ Error initiating completion');
        return { success: false, message: 'Failed to initiate completion' };
      }
    });
  }

  /**
   * Assign buyer to a transaction (called when buyer completes their wizard)
   * Links the buyer Principal to the seller's transaction
   */
  async assignBuyer(
    transactionId: string,
    buyerPrincipal: string
  ): Promise<{ success: boolean; message: string }> {
    return wrapWriteCall(async () => {
      if (!this.transactionManagerActor) await this.initialize();

      try {
        logger.info('🔗 Assigning buyer to transaction');

        const result = await this.txActor.assignBuyer(
          transactionId,
          Principal.fromText(buyerPrincipal)
        );

        if ('ok' in result) {
          logger.info('✅ Buyer assigned successfully:', result.ok);
          return { success: true, message: result.ok };
        } else if ('err' in result) {
          logger.error('❌ Buyer assignment failed:', result.err);
          return { success: false, message: result.err };
        }
        return { success: false, message: 'Unknown error occurred' };
      } catch (error) {
        logger.error('❌ Error assigning buyer');
        return { success: false, message: 'Failed to assign buyer' };
      }
    });
  }

  /**
   * Get transaction by text ID (supports TX-XXX format)
   */
  async getTransactionByTextId(id: string) {
    return wrapReadCall(async () => {
      if (!this.transactionManagerActor) await this.initialize();

      try {
        const result = await this.txActor.getTransaction(id);
        if (result.length > 0 && result[0]) {
          const tx = result[0];
          // Normalize variant status to string
          let statusStr = 'active';
          if (typeof tx.status === 'object' && tx.status !== null) {
            statusStr = Object.keys(tx.status)[0] || 'active';
          } else if (typeof tx.status === 'string') {
            statusStr = tx.status;
          }

          return {
            id: tx.id,
            propertyId: tx.propertyId,
            propertyAddress: tx.propertyAddress,
            titleNumber: tx.titleNumber,
            propertyType: tx.propertyType || 'Property',
            seller: tx.seller.toString(),
            buyer: tx.buyer.toString(),
            amount: Number(tx.amount),
            deposit: Number(tx.deposit || 0),
            mortgageAmount: Number(tx.mortgageAmount || 0),
            completionDate: tx.completionDate || '',
            status: statusStr,
            buyerSolicitorSignature: tx.buyerSolicitorSignature[0] || null,
            sellerSolicitorSignature: tx.sellerSolicitorSignature[0] || null,
            contractExchangeTimestamp: tx.contractExchangeTimestamp[0] ? Number(tx.contractExchangeTimestamp[0]) : null,
            createdAt: Number(tx.createdAt),
            exchangedAt: tx.exchangedAt[0] ? Number(tx.exchangedAt[0]) : null,
          };
        }
        return null;
      } catch (error) {
        logger.error('Error getting transaction:', error);
        return null;
      }
    });
  }

  // ==================== Document Storage Methods ====================

  /**
   * Initialize document storage actor on-demand
   */
  async ensureDocumentStorageActor() {
    if (this._documentStorageActor) return;

    try {
      this._documentStorageActor = Actor.createActor(documentStorageIdl, {
        agent: this.agent!,
        canisterId: CANISTER_IDS.document_storage,
      });
      logger.info('✅ Document storage canister connected');
    } catch (e) {
      throw new Error(
        'Document storage canister not available. Please deploy the document_storage canister and run "dfx generate". See QUICK_FIX_GUIDE.md for instructions.'
      );
    }
  }

  /**
   * Register document proof on-chain (hash-only, no file upload)
   * Documents are stored locally by solicitor/conveyancer
   * Only hash and metadata are registered on blockchain
   */
  async registerDocumentProof(
    file: File,
    propertyId: number,
    documentType: string,
    storageLocation: string,
    transactionId?: string  // Changed from number to string
  ): Promise<{ storageDocumentId: number; verificationDocumentId: number; documentHash: string }> {
    // Check for duplicate submission (5 second window)
    // Use file name, size, and propertyId for cache key (hash computation is expensive)
    const cacheKey = this.generateSubmissionCacheKey('registerDocumentProof', {
      fileName: file.name,
      fileSize: file.size,
      propertyId,
      documentType,
      transactionId
    });

    if (this.isDuplicateSubmission(cacheKey)) {
      throw new Error('Duplicate document registration detected. Please wait a moment before trying again.');
    }

    // Wrap with rate limiting and retry logic
    return wrapWriteCall(async () => {
      // Ensure actors are initialized
      await this.ensureDocumentStorageActor();
      if (!this._documentVerificationActor) {
        await this.initialize();
      }

      // Generate SHA-256 hash (file stays local)
      const hashBuffer = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const documentHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      // Register proof on blockchain (hash + metadata only)
      const storageResult = await this.dsActor.registerDocumentProof(
        file.name,
        documentHash,
        BigInt(file.size),
        file.type || 'application/octet-stream',
        storageLocation,
        transactionId ? [transactionId] : [],  // Changed: now Text instead of Nat
        documentType,  // NEW: pass document type for notifications
        await this.getDocumentStorageCsrfToken()
      );

      if ('err' in storageResult) {
        throw new Error(`Failed to register document proof: ${storageResult.err}`);
      }

      const storageDocumentId = storageResult.ok;

      // Register in document verification canister
      // Note: document_verification still uses Nat for transactionId
      // Candid `opt nat` encodes as a 0- or 1-element tuple, not a plain array.
      const txIdForVerification: [] | [bigint] =
        transactionId ? [BigInt(transactionId.replace('tx_', ''))] : [];
      const verificationDocumentId = await this.dvActor.registerDocument(
        BigInt(propertyId),
        txIdForVerification,
        documentType,
        documentHash,
        [storageDocumentId],
        [file.name],
        [BigInt(file.size)],
        [file.type || 'application/octet-stream']
      );

      this.emitDocumentUploadedEvent(transactionId, file.name, documentType, documentHash);

      return {
        storageDocumentId: Number(storageDocumentId),
        verificationDocumentId: Number(verificationDocumentId),
        documentHash: documentHash
      };
    }, { cacheKey });
  }

  /**
   * Fire-and-forget `document_uploaded` audit event.
   * No-op when transactionId is missing (property-level uploads pre-transaction).
   * Mirrors the pattern used for buyer_joined / stage_completed / provider_selected.
   */
  emitDocumentUploadedEvent(
    transactionId: string | undefined,
    fileName: string,
    documentType: string,
    fileHash: string,
  ): void {
    if (!transactionId) return;
    void this.ledgerManager
      ?.logEvent(
        transactionId,
        'document_uploaded',
        `Document ${fileName} (${documentType}) registered on chain`,
        [JSON.stringify({ fileName, documentType, fileHash })],
      )
      .catch((err: unknown) => logger.error('[audit] logEvent failed', { transactionId, eventType: 'document_uploaded', err }));
  }

  /**
   * Get document proof from blockchain
   * Note: Actual file is stored locally by solicitor/conveyancer
   */
  async getDocumentProof(storageDocumentId: number): Promise<{
    id: number;
    fileName: string;
    fileHash: string;
    fileSize: number;
    contentType: string;
    uploadedBy: string;
    uploadedAt: number;
    storageLocation: string;
    verified: boolean;
  } | null> {
    return wrapReadCall(async () => {
      await this.ensureDocumentStorageActor();

      const result = await this.dsActor.getDocumentProof(
        BigInt(storageDocumentId)
      );

      if (result && result.length > 0 && result[0]) {
        const proof = result[0];
        return {
          id: Number(proof.id),
          fileName: proof.fileName,
          fileHash: proof.fileHash,
          fileSize: Number(proof.fileSize),
          contentType: proof.contentType,
          uploadedBy: proof.uploadedBy.toString(),
          uploadedAt: Number(proof.uploadedAt),
          storageLocation: proof.storageLocation,
          verified: proof.verified,
        };
      }
      return null;
    });
  }

  /**
   * Verify document hash matches on-chain record
   * User provides local file, system compares hash
   */
  async verifyLocalDocumentHash(
    storageDocumentId: number,
    localFile: File
  ): Promise<{ matches: boolean; onChainHash: string; localHash: string }> {
    await this.ensureDocumentStorageActor();

    // Generate hash from local file
    const hashBuffer = await crypto.subtle.digest('SHA-256', await localFile.arrayBuffer());
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const localHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Get on-chain proof
    const proof = await this.getDocumentProof(storageDocumentId);
    if (!proof) {
      throw new Error('Document proof not found on blockchain');
    }

    // Compare hashes
    const matches = localHash.toLowerCase() === proof.fileHash.toLowerCase();

    // If matches, update verification status on-chain
    if (matches) {
      await this.dsActor.verifyDocumentHash(
        BigInt(storageDocumentId),
        localHash,
        await this.getDocumentStorageCsrfToken()
      );
    }

    return {
      matches,
      onChainHash: proof.fileHash,
      localHash: localHash
    };
  }

  /**
   * Get document metadata from storage canister (hash-based)
   */
  async getDocumentMetadata(storageDocumentId: number) {
    return wrapReadCall(async () => {
      await this.ensureDocumentStorageActor();

      const result = await this.dsActor.getDocumentMetadata(
        BigInt(storageDocumentId)
      );

      if ('ok' in result) {
        const metadata = result.ok;
        return {
          id: Number(metadata.id),
          fileName: metadata.fileName,
          fileSize: Number(metadata.fileSize),
          contentType: metadata.contentType,
          fileHash: metadata.fileHash,
          uploadedBy: metadata.uploadedBy.toString(),
          uploadedAt: Number(metadata.uploadedAt),
          totalChunks: Number(metadata.totalChunks),
          isComplete: true, // Hash-based storage is always "complete"
        };
      }
      return null;
    });
  }

  /**
   * Get all documents for a property. Participant-gated update call (#28):
   * the canister returns only the documents this caller may see.
   */
  async getPropertyDocuments(propertyId: number) {
    return wrapReadCall(async () => {
      if (!this._documentVerificationActor) await this.initialize();

      const documents = await this.dvActor.fetchPropertyDocuments(
        BigInt(propertyId)
      );

      return documents.map((doc) => ({
        id: Number(doc.id),
        propertyId: Number(doc.propertyId),
        documentType: doc.documentType,
        documentHash: doc.documentHash,
        storageDocumentId: (doc.storageDocumentId && doc.storageDocumentId[0]) ? Number(doc.storageDocumentId[0]) : null,
        fileName: (doc.fileName && doc.fileName[0]) || null,
        fileSize: (doc.fileSize && doc.fileSize[0]) ? Number(doc.fileSize[0]) : null,
        contentType: (doc.contentType && doc.contentType[0]) || null,
        uploadedBy: doc.uploadedBy.toString(),
        isVerified: doc.isVerified,
        uploadedAt: Number(doc.uploadedAt),
        // `ipfsCID`, `verifiedBy` and `verifiedAt` were mapped here but are not
        // fields on DocumentMetadata — the `&&` guards short-circuited on
        // undefined, so all three were unconditionally null. Dropped rather
        // than kept as permanently-null keys implying data that is not stored.
        // The record does carry `lastVerificationId` if a verifier link is
        // wanted later.
      }));
    });
  }

  /**
   * Verify a document
   */
  async verifyDocument(documentId: number) {
    return wrapWriteCall(async () => {
      if (!this._documentVerificationActor) await this.initialize();

      const success = await this.dvActor.verifyDocument(
        BigInt(documentId)
      );

      return { success };
    });
  }

  /**
   * Verify a document with hash check (solicitor/admin only)
   * Returns full verification result with hash details
   */
  async verifyDocumentWithHash(documentId: number, notes?: string) {
    return wrapWriteCall(async () => {
      if (!this._documentVerificationActor) await this.initialize();

      const result = await this.dvActor.verifyDocumentWithHash(
        BigInt(documentId),
        notes ? [notes] : [] // Option<Text>
      );

      return result;
    });
  }

  /**
   * Get verification history for a document
   */
  async getDocumentVerifications(documentId: number) {
    return wrapReadCall(async () => {
      if (!this._documentVerificationActor) await this.initialize();

      const verifications = await this.dvActor.fetchDocumentVerifications(
        BigInt(documentId)
      );

      return verifications;
    });
  }

  /**
   * Get unverified documents for a property (solicitors can see what needs verification)
   */
  async getUnverifiedDocuments(propertyId: number) {
    return wrapReadCall(async () => {
      if (!this._documentVerificationActor) await this.initialize();

      const documents = await this.dvActor.fetchUnverifiedDocuments(
        BigInt(propertyId)
      );

      return documents;
    });
  }

  /**
   * Get all documents for a transaction from the document storage canister
   * This queries the blockchain directly for transaction-linked documents
   */
  async getDocumentsByTransaction(transactionId: string | number): Promise<any[]> {
    return wrapReadCall(async () => {
      await this.ensureDocumentStorageActor();

      try {
        // The canister expects transactionId as a string (Text), not BigInt
        const txIdString = String(transactionId);

        logger.info('Fetching documents for transaction:', txIdString);

        const documents = await this.dsActor.getTransactionDocuments(
          txIdString
        );

        logger.info('Raw documents from canister:', documents);

        if (!Array.isArray(documents)) {
          logger.warn('getTransactionDocuments returned non-array:', documents);
          return [];
        }

      // Helper function to infer category from document type
      // Handles both kebab-case (legacy) and camelCase (DOCUMENT_TYPES storageKey) naming
      const inferCategory = (docType: string): 'seller' | 'buyer' | 'shared' => {
        // Strip _person[N] suffix for multi-party docs before matching
        const baseType = docType.replace(/_person\d+$/, '');

        // Role-prefixed types (e.g. seller-id, buyer-proof-of-address)
        if (baseType.startsWith('seller-') || baseType.startsWith('seller_')) return 'seller';
        if (baseType.startsWith('buyer-') || baseType.startsWith('buyer_')) return 'buyer';

        // Unambiguous seller documents (camelCase storageKeys + kebab-case legacy)
        const sellerDocs = [
          'titleDeeds', 'title-deeds',
          'energyPerformanceCertificate', 'epc-certificate',
          'ta6PropertyInformationForm', 'ta6-form', 'ta6',
          'ta10FittingsContents', 'ta10-form',
          'property-info', 'fittings-contents'
        ];
        // Unambiguous buyer documents
        const buyerDocs = [
          'proofOfFunds', 'proof-of-funds',
          'mortgageAgreement', 'mortgage-agreement', 'mortgage-offer'
        ];
        const sharedDocs = ['property-searches', 'survey-report', 'local-search', 'environmental-search'];

        if (sellerDocs.includes(baseType)) return 'seller';
        if (buyerDocs.includes(baseType)) return 'buyer';
        if (sharedDocs.includes(baseType)) return 'shared';

        // Ambiguous types (proofOfIdentity, proofOfAddress) used by both roles
        // Category determined by uploadedBy in checklist matching
        return 'shared';
      };

      // Helper function to get display name from document type
      // Handles both kebab-case (legacy) and camelCase (DOCUMENT_TYPES storageKey) naming
      const getDocumentName = (docType: string): string => {
        const nameMap: Record<string, string> = {
          'title-deeds': 'Title Deeds',
          'titleDeeds': 'Title Deeds',
          'epc-certificate': 'Energy Performance Certificate',
          'energyPerformanceCertificate': 'Energy Performance Certificate',
          'proof-of-identity': 'Proof of Identity',
          'proofOfIdentity': 'Proof of Identity',
          'proof-of-address': 'Proof of Address',
          'proofOfAddress': 'Proof of Address',
          'proof-of-funds': 'Proof of Funds',
          'proofOfFunds': 'Proof of Funds',
          'mortgage-agreement': 'Mortgage Agreement',
          'mortgageAgreement': 'Mortgage Agreement',
          'property-searches': 'Property Searches',
          'survey-report': 'Survey Report',
          'ta6': 'TA6 Form',
          'ta6PropertyInformationForm': 'TA6 Property Information Form',
          'ta10FittingsContents': 'TA10 Fittings & Contents Form',
          'local-search': 'Local Authority Search',
          'environmental-search': 'Environmental Search',
        };

        // Direct lookup
        if (nameMap[docType]) return nameMap[docType];

        // Handle multi-party person variants (e.g. "proofOfAddress_person2" → "Proof of Address - Person 2")
        const personMatch = docType.match(/^(.+)_person(\d+)$/);
        if (personMatch) {
          const baseName = nameMap[personMatch[1]];
          if (baseName) return `${baseName} - Person ${personMatch[2]}`;
        }

        return docType.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      };

      const mappedDocs = documents.map((doc) => {
        const docType = doc.docType || 'unknown';
        const category = inferCategory(docType);
        const storageId = Number(doc.id);

        // Reconstruct verificationDocumentId from localStorage mapping
        // (saved during upload as doc_id_mapping_${storageDocId} -> verificationDocId)
        let verificationDocumentId: number | undefined;
        try {
          const mapped = localStorage.getItem(`doc_id_mapping_${storageId}`);
          if (mapped) {
            verificationDocumentId = Number(mapped);
          }
        } catch {
          // localStorage unavailable
        }

        return {
          id: `doc_${storageId}`,
          storageDocumentId: storageId,
          verificationDocumentId,
          fileName: doc.fileName,
          hash: doc.fileHash, // Map canister's fileHash to Document type's hash field
          fileSize: Number(doc.fileSize),
          mimeType: doc.contentType,
          contentType: doc.contentType,
          uploadedBy: doc.uploadedBy?.toString() || '',
          uploadedAt: new Date(Number(doc.uploadedAt) / 1000000).toISOString(), // Convert nanoseconds to ISO
          storageLocation: doc.storageLocation,
          verified: doc.verified,
          transactionId: doc.transactionId?.[0] || null,
          type: docType,
          category: category,
          name: getDocumentName(docType),
          status: doc.verified ? 'verified' : 'uploaded',
          required: true,
        };
      });

      logger.info('Mapped documents:', mappedDocs);
      return mappedDocs;
      } catch (error) {
        logger.error('Error getting documents by transaction:', error);
        return [];
      }
    });
  }

  /**
   * Delete a document from storage canister
   * Rate limited: wrapWriteCall
   */
  async deleteStorageDocument(documentId: number): Promise<boolean> {
    return wrapWriteCall(async () => {
      await this.ensureDocumentStorageActor();

      try {
        // Get CSRF token from document_storage canister
        const csrfToken = await this.getDocumentStorageCsrfToken();
        const result = await this.documentStorageActor!.deleteDocument(BigInt(documentId), csrfToken);
        if ('ok' in result) {
          logger.info(`✅ Document ${documentId} deleted successfully`);
          return true;
        } else {
          logger.error(`❌ Failed to delete document ${documentId}:`, result.err);
          return false;
        }
      } catch (error) {
        logger.error('Error deleting storage document:', error);
        return false;
      }
    });
  }

  /**
   * Delete a document from verification canister
   * Rate limited: wrapWriteCall
   */
  async deleteVerificationDocument(documentId: number): Promise<boolean> {
    return wrapWriteCall(async () => {
      if (!this.documentVerificationActor) await this.initialize();

      try {
        const result = await this.dvActor.deleteDocument(BigInt(documentId));
        return 'ok' in result;
      } catch (error) {
        logger.error('Error deleting verification document:', error);
        return false;
      }
    });
  }

  /**
   * Get storage statistics
   * Rate limited: wrapReadCall
   */
  async getStorageStats(): Promise<any> {
    return wrapReadCall(async () => {
      await this.ensureDocumentStorageActor();

      try {
        return await this.documentStorageActor!.getStorageStats();
      } catch (error) {
        logger.error('Error getting storage stats:', error);
        return null;
      }
    });
  }

  /**
   * Get audit logs for a document
   * Rate limited: wrapReadCall
   */
  async getAuditLogs(storageDocumentId: number): Promise<any[]> {
    return wrapReadCall(async () => {
      await this.ensureDocumentStorageActor();

      try {
        const logs = await this.documentStorageActor!.getAuditLogs(BigInt(storageDocumentId));
        return logs || [];
      } catch (error) {
        logger.error('Error getting audit logs:', error);
        return [];
      }
    });
  }

  /**
   * Get invite code for a transaction
   * Rate limited: wrapReadCall
   */
  async getInviteCode(transactionId: string): Promise<string | null> {
    return wrapReadCall(async () => {
      if (!this.transactionManagerActor) await this.initialize();

      try {
        const result = await this.txActor.getTransaction(transactionId);
        if (result && result[0]) {
          return result[0].inviteCode || null;
        }
        return null;
      } catch (error) {
        logger.error('Error getting invite code:', error);
        return null;
      }
    });
  }

  /**
   * Get transaction documents from storage canister
   * Rate limited: wrapReadCall
   */
  async getTransactionDocuments(transactionId: string): Promise<any[]> {
    return wrapReadCall(async () => {
      await this.ensureDocumentStorageActor();

      try {
        const docs = await this.documentStorageActor!.getTransactionDocuments(transactionId);
        return docs || [];
      } catch (error) {
        logger.error('Error getting transaction documents:', error);
        return [];
      }
    });
  }

  // ==================== Chain Management Methods ====================

  /**
   * Join a transaction by invite code
   * This allows users to join property chains
   */
  async joinTransactionByInviteCode(inviteCode: string): Promise<any> {
    return wrapWriteCall(async () => {
      if (!this.transactionManagerActor) await this.initialize();

      // Validate invite code format (TX-XXXX-XXXX)
      const regex = /^TX-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
      if (!regex.test(inviteCode.toUpperCase())) {
        throw new Error('Invalid invite code format. Expected: TX-XXXX-XXXX');
      }

      try {
        // Call the canister method to join the transaction
        const result = await this.txActor.joinTransactionByInviteCode(inviteCode.toUpperCase());

        if ('ok' in result) {
          const tx = result.ok;
          // Convert to frontend format
          let statusString: string = 'active';
          if (tx.status && typeof tx.status === 'object') {
            statusString = Object.keys(tx.status)[0] || 'active';
          }

          const formatted = {
            id: tx.id,
            propertyId: tx.propertyId,
            propertyAddress: tx.propertyAddress,
            postcode: tx.postcode,
            titleNumber: tx.titleNumber,
            seller: tx.seller.toString(),
            buyer: tx.buyer.toString(),
            amount: Number(tx.amount),
            status: statusString,
            inviteCode: tx.inviteCode,
            createdAt: Number(tx.createdAt),
            mode: tx.mode,
            transactionType: tx.transactionType,
            userRole: tx.userRole,
            propertyType: tx.propertyType,
            propertyCategory: tx.propertyCategory,
          };

          // Fire-and-forget audit event — must not block the UI
          void this.ledgerManager
            ?.logEvent(
              tx.id,
              'buyer_joined',
              `Buyer redeemed invite code ${inviteCode.toUpperCase()}`,
              [],
            )
            .catch((err: unknown) => logger.error('[audit] logEvent failed', { transactionId: tx.id, eventType: 'buyer_joined', err }));

          return formatted;
        } else if ('err' in result) {
          throw new Error(result.err);
        }

        throw new Error('Unknown error occurred');
      } catch (error) {
        logger.error('Error joining transaction by invite code:', error);
        throw error;
      }
    });
  }

  /**
   * Buyer-intent variant of joinTransactionByInviteCode. The default method
   * deliberately does NOT auto-assign caller as buyer — invite codes are
   * shareable, so a solicitor or other party joining via the same code must
   * not displace the intended buyer. This wrapper calls the canister's
   * sibling method that DOES assign the caller as buyer atomically (iff
   * the slot is vacant). Use from buyer-self-join paths only.
   */
  async joinTransactionByInviteCodeAsBuyer(inviteCode: string): Promise<any> {
    return wrapWriteCall(async () => {
      if (!this.transactionManagerActor) await this.initialize();

      const regex = /^TX-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
      if (!regex.test(inviteCode.toUpperCase())) {
        throw new Error('Invalid invite code format. Expected: TX-XXXX-XXXX');
      }

      try {
        const result = await this.txActor.joinTransactionByInviteCodeAsBuyer(inviteCode.toUpperCase());

        if ('ok' in result) {
          const tx = result.ok;
          let statusString: string = 'active';
          if (tx.status && typeof tx.status === 'object') {
            statusString = Object.keys(tx.status)[0] || 'active';
          }

          const formatted = {
            id: tx.id,
            propertyId: tx.propertyId,
            propertyAddress: tx.propertyAddress,
            postcode: tx.postcode,
            titleNumber: tx.titleNumber,
            seller: tx.seller.toString(),
            buyer: tx.buyer.toString(),
            amount: Number(tx.amount),
            status: statusString,
            inviteCode: tx.inviteCode,
            createdAt: Number(tx.createdAt),
            mode: tx.mode,
            transactionType: tx.transactionType,
            userRole: tx.userRole,
            propertyType: tx.propertyType,
            propertyCategory: tx.propertyCategory,
          };

          void this.ledgerManager
            ?.logEvent(
              tx.id,
              'buyer_self_assigned',
              `Caller self-assigned as buyer via invite code ${inviteCode.toUpperCase()}`,
              [],
            )
            .catch((err: unknown) => logger.error('[audit] logEvent failed', { transactionId: tx.id, eventType: 'buyer_self_assigned', err }));

          return formatted;
        } else if ('err' in result) {
          throw new Error(result.err);
        }

        throw new Error('Unknown error occurred');
      } catch (error) {
        logger.error('Error self-assigning as buyer by invite code:', error);
        throw error;
      }
    });
  }

  /**
   * Get transactions for the calling principal only.
   * Calls canister getMyTransactions() which filters server-side — avoids
   * fetching every transaction and filtering client-side.
   */
  async getMyTransactions(): Promise<any[]> {
    if (!this.transactionManagerActor) await this.initialize();
    return wrapReadCall(async () => {
      try {
        const transactions = await this.txActor.getMyTransactions();
        if (!Array.isArray(transactions)) {
          logger.warn('getMyTransactions returned non-array:', transactions);
          return [];
        }
        return this._mapTransactions(transactions);
      } catch (error) {
        logger.error('Error in getMyTransactions:', error);
        return [];
      }
    });
  }

  /**
   * Get chain view for a transaction
   * Returns hierarchical view of connected properties
   */
  async getChainView(transactionId: string): Promise<any> {
    // Get all transactions
    // Untrusted localStorage payload — narrowed to just the fields read below.
    const allTransactions: Array<{
      id?: string;
      propertyAddress?: string;
      status?: string;
      milestones?: unknown[];
      parties?: unknown[];
    }> = JSON.parse(localStorage.getItem('transactions') || '[]');

    // Find the transaction
    const transaction = allTransactions.find((tx) => tx.id === transactionId);

    if (!transaction) {
      throw new Error('Transaction not found');
    }

    // Build chain data
    // In production, this would query the canister for connected transactions
    return {
      id: transaction.id,
      propertyAddress: transaction.propertyAddress,
      status: transaction.status,
      milestones: transaction.milestones || [],
      parties: transaction.parties || [],
      // Chain connections would be stored in blockchain
      buyerTransaction: null, // ID of buyer's transaction
      sellerTransaction: null, // ID of seller's transaction
    };
  }

  /**
   * Generate invite code for a transaction
   */
  async generateInviteCode(transactionId: string): Promise<string> {
    // In production, this would call canister to generate secure invite code
    // For now, return the transaction ID as the invite code
    return transactionId;
  }

  /**
   * Get transaction by invite code
   * Queries the canister directly using the invite code lookup
   */
  async getTransactionByInviteCode(inviteCode: string): Promise<any> {
    return wrapReadCall(async () => {
      if (!this.transactionManagerActor) await this.initialize();

      // Validate invite code format (TX-XXXX-XXXX) - case insensitive
      const regex = /^TX-[A-Z0-9]{4}-[A-Z0-9]{4}$/i;
      if (!regex.test(inviteCode)) {
        throw new Error('Invalid invite code format. Expected: TX-XXXX-XXXX');
      }

      try {
        // Call the canister method directly for efficient lookup
        const result = await this.txActor.getTransactionByInviteCode(inviteCode.toUpperCase());

        // Result is an optional Transaction ([] | [Transaction])
        if (!result || result.length === 0) {
          return null;
        }

        const tx = result[0];

        // Convert to frontend format
        let statusString: string = 'active';
        if (tx.status && typeof tx.status === 'object') {
          statusString = Object.keys(tx.status)[0] || 'active';
        }

        return {
          id: tx.id,
          propertyId: tx.propertyId,
          propertyAddress: tx.propertyAddress,
          postcode: tx.postcode,
          titleNumber: tx.titleNumber,
          seller: tx.seller.toString(),
          buyer: tx.buyer.toString(),
          amount: Number(tx.amount),
          status: statusString,
          inviteCode: tx.inviteCode,
          createdAt: Number(tx.createdAt),
          createdBy: tx.createdBy.toString(),
          mode: tx.mode,
          transactionType: tx.transactionType,
          userRole: tx.userRole,
          propertyType: tx.propertyType,
          propertyCategory: tx.propertyCategory,
          accessList: tx.accessList?.map((p: unknown) => (typeof p === 'string' ? p : String(p ?? ''))) || [],
        };
      } catch (error) {
        logger.error('Error getting transaction by invite code:', error);
        throw error;
      }
    });
  }

  /**
   * Revoke a buyer's access to a transaction (seller only)
   * Note: Requires updated Candid declarations (run dfx generate)
   */
  async revokeBuyer(transactionId: string, buyerPrincipal: string): Promise<{ success: boolean; message: string }> {
    return wrapWriteCall(async () => {
      if (!this.transactionManagerActor) await this.initialize();

      try {
        const result = await this.txActor.revokeBuyer(
          transactionId,
          Principal.fromText(buyerPrincipal)
        );

        if ('ok' in result) {
          return { success: true, message: result.ok };
        } else if ('err' in result) {
          return { success: false, message: result.err };
        }
        return { success: false, message: 'Unknown error occurred' };
      } catch (error) {
        logger.error('Error revoking buyer');
        return { success: false, message: 'Failed to revoke buyer access' };
      }
    });
  }

  /**
   * Delete a transaction from the canister
   */
  async deleteTransactionFromCanister(transactionId: string): Promise<{ ok: boolean; data?: string; error?: string }> {
    return wrapWriteCall(async () => {
      try {
        if (!this.transactionManagerActor) {
          await this.initialize();
        }

        const result = await this.txActor.deleteTransaction(transactionId);

        if ('ok' in result) {
          return { ok: true, data: result.ok };
        } else {
          return { ok: false, error: result.err };
        }
      } catch (error) {
        return {
          ok: false,
          error: errorMessage(error, 'Failed to delete transaction from canister')
        };
      }
    });
  }

  /**
   * Admin-only force delete of a transaction. Bypasses participant check
   * and the post-exchange protection that blocks the regular `deleteTransaction`.
   * Audit-logged on the canister side.
   */
  async adminForceDeleteTransaction(transactionId: string): Promise<{ ok: boolean; data?: string; error?: string }> {
    return wrapWriteCall(async () => {
      try {
        if (!this.transactionManagerActor) {
          await this.initialize();
        }

        const result = await this.txActor.adminForceDeleteTransaction(transactionId);

        if ('ok' in result) {
          return { ok: true, data: result.ok };
        } else {
          return { ok: false, error: result.err };
        }
      } catch (error) {
        return {
          ok: false,
          error: errorMessage(error, 'Failed to force-delete transaction')
        };
      }
    });
  }

  /**
   * Check if a transaction exists in the canister
   */
  async transactionExists(transactionId: string): Promise<boolean> {
    return wrapReadCall(async () => {
      try {
        if (!this.transactionManagerActor) {
          await this.initialize();
        }

        return await this.txActor.doesTransactionExist(transactionId);
      } catch (error) {
        logger.error('Error checking transaction existence:', error);
        return false;
      }
    });
  }

  // ==================== Health Check ====================

  /**
   * Check if ICP service is healthy
   */
  async healthCheck() {
    try {
      await this.getAllProperties();
      return { status: 'ok', message: 'ICP canisters are operational' };
    } catch (error) {
      return { status: 'error', message: 'Failed to connect to ICP canisters' };
    }
  }

  // ==================== Email Service Methods ====================

  private getOrCreateMarketingSessionIdentity(): Ed25519KeyIdentity {
    if (this.marketingSessionIdentity) return this.marketingSessionIdentity;

    const stored = localStorage.getItem(this.MARKETING_SESSION_KEY);
    if (stored) {
      try {
        this.marketingSessionIdentity = Ed25519KeyIdentity.fromJSON(stored);
        return this.marketingSessionIdentity;
      } catch (error) {
        logger.warn('⚠️ Corrupt marketing session identity in storage; regenerating', error);
        localStorage.removeItem(this.MARKETING_SESSION_KEY);
      }
    }

    const identity = Ed25519KeyIdentity.generate();
    localStorage.setItem(this.MARKETING_SESSION_KEY, JSON.stringify(identity.toJSON()));
    this.marketingSessionIdentity = identity;
    return identity;
  }

  // Marketing forms (support/sales/partner) always submit through a session
  // identity rather than the default anonymous agent. The canister rejects
  // anonymous callers on these methods; one identity per visitor keeps each
  // visitor on their own per-principal rate-limit bucket.
  private async getMarketingFormActor(): Promise<CanisterActor> {
    if (this.marketingFormActor) return this.marketingFormActor;

    const identity = this.getOrCreateMarketingSessionIdentity();
    const agent = new HttpAgent({ identity, host: HOST });
    this.marketingFormActor = Actor.createActor(emailServiceIdl, {
      agent,
      canisterId: CANISTER_IDS.email_service,
    });
    return this.marketingFormActor;
  }

  /**
   * Submit support request to email_service canister
   */
  async submitSupportRequest(name: string, email: string, subject: string, message: string): Promise<number> {
    return wrapWriteCall(async () => {
      const actor = await this.getMarketingFormActor();

      try {
        const notificationId = await actor.submitSupportRequest(
          name,
          email,
          subject,
          message
        );

        logger.info('✅ Support request submitted to canister:', Number(notificationId));
        return Number(notificationId);
      } catch (error) {
        logger.error('❌ Error submitting support request to canister:', error);
        throw error;
      }
    });
  }

  /**
   * Submit sales inquiry to email_service canister
   */
  async submitSalesInquiry(
    name: string,
    email: string,
    company: string,
    phone: string,
    userType: string,
    volume: string,
    message: string
  ): Promise<number> {
    return wrapWriteCall(async () => {
      const actor = await this.getMarketingFormActor();

      try {
        const notificationId = await actor.submitSalesInquiry(
          name,
          email,
          company,
          phone,
          userType,
          volume,
          message
        );

        logger.info('✅ Sales inquiry submitted to canister:', Number(notificationId));
        return Number(notificationId);
      } catch (error) {
        logger.error('❌ Error submitting sales inquiry to canister:', error);
        throw error;
      }
    });
  }

  /**
   * Submit partner inquiry to email_service canister
   */
  async submitPartnerInquiry(
    name: string,
    email: string,
    company: string,
    website: string,
    partnerType: string,
    message: string
  ): Promise<number> {
    return wrapWriteCall(async () => {
      const actor = await this.getMarketingFormActor();

      try {
        const notificationId = await actor.submitPartnerInquiry(
          name,
          email,
          company,
          website,
          partnerType,
          message
        );

        logger.info('✅ Partner inquiry submitted to canister:', Number(notificationId));
        return Number(notificationId);
      } catch (error) {
        logger.error('❌ Error submitting partner inquiry to canister:', error);
        throw error;
      }
    });
  }

  /**
   * Get all email notifications from canister (admin function)
   */
  async getEmailNotifications(): Promise<any[]> {
    return wrapReadCall(async () => {
      if (!this.emailServiceActor) await this.initialize();

      try {
        const notifications = await this.esActor.getAllNotifications();

        return notifications.map((n) => ({
          id: Number(n.id),
          contactType: Object.keys(n.contactType)[0], // Extract variant key (support/sales/partners)
          name: n.name,
          email: n.email,
          subject: n.subject,
          message: n.message,
          company: n.company[0] || null,
          phone: n.phone[0] || null,
          userType: n.userType[0] || null,
          volume: n.volume[0] || null,
          website: n.website[0] || null,
          partnerType: n.partnerType[0] || null,
          timestamp: Number(n.timestamp),
          processed: n.processed,
        }));
      } catch (error) {
        logger.error('❌ Error getting email notifications:', error);
        return [];
      }
    });
  }

  /**
   * Get unprocessed email notifications count
   */
  async getUnprocessedEmailCount(): Promise<number> {
    return wrapReadCall(async () => {
      if (!this.emailServiceActor) await this.initialize();

      try {
        const count = await this.esActor.getUnprocessedCount();
        return Number(count);
      } catch (error) {
        logger.error('❌ Error getting unprocessed email count:', error);
        return 0;
      }
    });
  }

  /**
   * Mark email notification as processed
   */
  async markEmailAsProcessed(id: number): Promise<boolean> {
    return wrapWriteCall(async () => {
      if (!this.emailServiceActor) await this.initialize();

      try {
        const success = await this.esActor.markAsProcessed(BigInt(id));
        logger.info('✅ Notification marked as processed:', id);
        return success;
      } catch (error) {
        logger.error('❌ Error marking notification as processed:', error);
        return false;
      }
    });
  }

  /**
   * Get formatted email text for a notification
   */
  async getFormattedEmail(id: number): Promise<string | null> {
    return wrapReadCall(async () => {
      if (!this.emailServiceActor) await this.initialize();

      try {
        const result = await this.esActor.formatNotificationAsEmail(BigInt(id));

        if (result.length > 0 && result[0]) {
          return result[0];
        }

        return null;
      } catch (error) {
        logger.error('❌ Error getting formatted email:', error);
        return null;
      }
    });
  }

  // ==================== Ledger Manager Methods ====================

  /**
   * Get global blockchain efficiency metrics (vs traditional conveyancing)
   */
  async getGlobalBlockchainStats(): Promise<{
    transactionsCompleted: number;
    avgBlockchainCompletionDays: number;
    avgTraditionalCompletionDays: number;
    timeReductionPercent: number;
    avgBlockchainCost: number;
    avgTraditionalCost: number;
    costReductionPercent: number;
    totalTimeSavedDays: number;
    totalCostSaved: number;
  } | null> {
    return wrapReadCall(async () => {
      if (!this.ledgerManagerActor) await this.initialize();

      try {
        const metrics = await this.lmActor.getGlobalBlockchainStats();

        return {
          transactionsCompleted: Number(metrics.transactionsCompleted),
          avgBlockchainCompletionDays: Number(metrics.avgBlockchainCompletionDays),
          avgTraditionalCompletionDays: Number(metrics.avgTraditionalCompletionDays),
          timeReductionPercent: Number(metrics.timeReductionPercent),
          avgBlockchainCost: Number(metrics.avgBlockchainCost),
          avgTraditionalCost: Number(metrics.avgTraditionalCost),
          costReductionPercent: Number(metrics.costReductionPercent),
          totalTimeSavedDays: Number(metrics.totalTimeSavedDays),
          totalCostSaved: Number(metrics.totalCostSaved),
        };
      } catch (error) {
        logger.error('Error getting global blockchain stats:', error);
        return null;
      }
    });
  }

  /**
   * Get user's ledger entries (their transaction history)
   */
  async getMyLedger(): Promise<any[]> {
    return wrapReadCall(async () => {
      if (!this.ledgerManagerActor) await this.initialize();

      try {
        const entries = await this.lmActor.getMyLedger();

        return entries.map((entry) => ({
          entryID: entry.entryID,
          transactionID: entry.transactionID,
          accountID: entry.accountID,
          propertyAddress: entry.propertyAddress,
          propertyValue: Number(entry.propertyValue),
          roleInTransaction: Object.keys(entry.roleInTransaction)[0],
          status: Object.keys(entry.status)[0],
          initiatedDate: Number(entry.initiatedDate),
          completedDate: entry.completedDate[0] ? Number(entry.completedDate[0]) : null,
          costsSaved: Number(entry.costsSaved),
          counterparties: entry.counterparties.map((cp) => ({
            accountID: cp.accountID,
            name: cp.name,
          })),
          documentStatus: {
            propertyDeed: Object.keys(entry.documentStatus.propertyDeed)[0],
            mortgageApproval: Object.keys(entry.documentStatus.mortgageApproval)[0],
            surveyReport: Object.keys(entry.documentStatus.surveyReport)[0],
            landRegistryConfirm: Object.keys(entry.documentStatus.landRegistryConfirm)[0],
          },
        }));
      } catch (error) {
        logger.error('Error getting my ledger:', error);
        return [];
      }
    });
  }

  /**
   * Get company ledger summary (for company accounts)
   */
  async getCompanyLedger(companyAccountId: string): Promise<{
    companyAccountID: string;
    totalTransactions: number;
    activeTransactions: number;
    completedThisMonth: number;
    avgCompletionTime: number;
    costSavings: number;
    teamMemberCount: number;
  } | null> {
    return wrapReadCall(async () => {
      if (!this.ledgerManagerActor) await this.initialize();

      try {
        const ledger = await this.lmActor.getCompanyLedger(companyAccountId);

        return {
          companyAccountID: ledger.companyAccountID,
          totalTransactions: Number(ledger.totalTransactions),
          activeTransactions: Number(ledger.activeTransactions),
          completedThisMonth: Number(ledger.completedThisMonth),
          avgCompletionTime: Number(ledger.avgCompletionTime),
          costSavings: Number(ledger.costSavings),
          teamMemberCount: Number(ledger.teamMemberCount),
        };
      } catch (error) {
        logger.error('Error getting company ledger:', error);
        return null;
      }
    });
  }

  /**
   * Get blockchain efficiency metrics for a specific account
   */
  async getBlockchainEfficiencyMetrics(accountId: string): Promise<{
    transactionsCompleted: number;
    avgBlockchainCompletionDays: number;
    avgTraditionalCompletionDays: number;
    timeReductionPercent: number;
    avgBlockchainCost: number;
    avgTraditionalCost: number;
    costReductionPercent: number;
    totalTimeSavedDays: number;
    totalCostSaved: number;
  } | null> {
    return wrapReadCall(async () => {
      if (!this.ledgerManagerActor) await this.initialize();

      try {
        const metrics = await this.lmActor.getBlockchainEfficiencyMetrics(accountId);

        return {
          transactionsCompleted: Number(metrics.transactionsCompleted),
          avgBlockchainCompletionDays: Number(metrics.avgBlockchainCompletionDays),
          avgTraditionalCompletionDays: Number(metrics.avgTraditionalCompletionDays),
          timeReductionPercent: Number(metrics.timeReductionPercent),
          avgBlockchainCost: Number(metrics.avgBlockchainCost),
          avgTraditionalCost: Number(metrics.avgTraditionalCost),
          costReductionPercent: Number(metrics.costReductionPercent),
          totalTimeSavedDays: Number(metrics.totalTimeSavedDays),
          totalCostSaved: Number(metrics.totalCostSaved),
        };
      } catch (error) {
        logger.error('Error getting blockchain efficiency metrics:', error);
        return null;
      }
    });
  }

  /**
   * Get ledger analytics for a specific period
   */
  async getLedgerAnalytics(accountId: string, period: string): Promise<{
    period: string;
    totalTransactions: number;
    completedTransactions: number;
    transactionVolume: number;
    avgCompletionTime: number;
    totalCostSavings: number;
  } | null> {
    return wrapReadCall(async () => {
      if (!this.ledgerManagerActor) await this.initialize();

      try {
        const analytics = await this.lmActor.getLedgerAnalytics(accountId, period);

        return {
          period: analytics.period,
          totalTransactions: Number(analytics.totalTransactions),
          completedTransactions: Number(analytics.completedTransactions),
          transactionVolume: Number(analytics.transactionVolume),
          avgCompletionTime: Number(analytics.avgCompletionTime),
          totalCostSavings: Number(analytics.totalCostSavings),
        };
      } catch (error) {
        logger.error('Error getting ledger analytics:', error);
        return null;
      }
    });
  }

  // ==================== RBAC & Transaction Progress Methods ====================

  /**
   * Get transaction progress with RBAC-based member tracking
   */
  async getTransactionProgress(transactionId: string | number): Promise<any | null> {
    return wrapReadCall(async () => {
      if (!this.userManagementActor) await this.initialize();

      try {
        const result = await this.umActor.getTransactionProgress(String(transactionId));

        if (result.length > 0 && result[0]) {
          const progress = result[0];

          return {
            transactionId: progress.transactionId,
            members: progress.members.map((m) => ({
              transactionId: m.transactionId,
              principal: m.principal,
              role: this.convertUserTypeVariantToText(m.role),
              canViewProgress: m.canViewProgress,
              canInviteOthers: m.canInviteOthers,
              joinedAt: m.joinedAt,
              requiredDocuments: m.requiredDocuments,
              uploadedDocuments: m.uploadedDocuments,
              documentsComplete: m.documentsComplete,
              lastActivityAt: m.lastActivityAt,
            })),
            readyToExchange: progress.readyToExchange,
            blockingParties: progress.blockingParties,
            completionPercentage: progress.completionPercentage,
            totalMembers: progress.totalMembers,
            membersComplete: progress.membersComplete,
          };
        }

        return null;
      } catch (error) {
        logger.error('❌ Error getting transaction progress:', error);
        return null;
      }
    });
  }

  /**
   * Get transaction members for a specific transaction
   */
  // transactionId is Text on the canister (ids look like `tx_1785191790114007638`).
  // This took a `number` and passed `BigInt(id)`, which the encoder rejects — and
  // the only caller reached it via `parseInt('tx_…')`, so it was NaN-guarded into
  // never running at all. Both ends now pass the id through as the string it is.
  async getTransactionMembers(transactionId: string | number): Promise<any[]> {
    return wrapReadCall(async () => {
      if (!this.userManagementActor) await this.initialize();

      try {
        const result = await this.umActor.getTransactionMembers(String(transactionId));

        if (result.length > 0 && result[0]) {
          return result[0].map((m) => ({
            transactionId: m.transactionId,
            principal: m.principal,
            role: this.convertUserTypeVariantToText(m.role),
            canViewProgress: m.canViewProgress,
            canInviteOthers: m.canInviteOthers,
            joinedAt: m.joinedAt,
            requiredDocuments: m.requiredDocuments,
            uploadedDocuments: m.uploadedDocuments,
            documentsComplete: m.documentsComplete,
            lastActivityAt: m.lastActivityAt,
          }));
        }

        return [];
      } catch (error) {
        logger.error('❌ Error getting transaction members:', error);
        return [];
      }
    });
  }

  /**
   * Update member documents when a new document is uploaded
   */
  async updateMemberDocuments(transactionId: number | string, documentName: string): Promise<boolean> {
    return wrapWriteCall(async () => {
      if (!this.userManagementActor) await this.initialize();

      try {
        const success = await this.umActor.updateMemberDocuments(
          String(transactionId),
          documentName,
          this.requireCsrfToken()
        );

        logger.info('✅ Member documents updated:', documentName);
        return success;
      } catch (error) {
        logger.error('❌ Error updating member documents:', error);
        return false;
      }
    });
  }

  /**
   * Update required documents for a transaction member
   * Useful for removing documents that are not needed (e.g., mortgage docs for cash buyers)
   */
  async updateTransactionMemberRequiredDocs(
    transactionId: number | string,
    documentsToRemove: string[]
  ): Promise<boolean> {
    return wrapWriteCall(async () => {
      if (!this.userManagementActor) await this.initialize();

      try {
        const success = await this.umActor.updateTransactionMemberRequiredDocs(
          String(transactionId),
          documentsToRemove,
          this.requireCsrfToken()
        );

        logger.info('✅ Transaction member required documents updated');
        return success;
      } catch (error) {
        logger.error('❌ Error updating transaction member required documents:', error);
        return false;
      }
    });
  }

  /**
   * Helper: Convert UserType variant to text
   */
  private convertUserTypeVariantToText(variant: UserType | string): string {
    if (typeof variant === 'object') {
      const key = Object.keys(variant)[0];
      switch (key) {
        case 'buyer': return 'buyer';
        case 'seller': return 'seller';
        case 'solicitor_client_linked': return 'solicitor';
        case 'solicitor_platform_only': return 'solicitor_platform_only';
        case 'admin': return 'admin';
        default: return 'buyer';
      }
    }
    return String(variant);
  }

  // ========== NOTIFICATION SYSTEM ==========

  /**
   * Get all notifications for the current user
   */
  async getMyNotifications(): Promise<Array<{
    id: number;
    transactionId: string;
    recipient: string;
    message: string;
    docType: string;
    documentHash: string;
    uploadedBy: string;
    createdAt: bigint;
    read: boolean;
  }>> {
    return wrapReadCall(async () => {
      if (!this.transactionManagerActor) await this.initialize();

      try {
        const notifications = await this.txActor.getMyNotifications();
        return notifications.map((n) => ({
          id: Number(n.id),
          transactionId: n.transactionId,
          recipient: n.recipient.toString(),
          message: n.message,
          docType: n.docType,
          documentHash: n.documentHash,
          uploadedBy: n.uploadedBy.toString(),
          createdAt: n.createdAt,
          read: n.read,
        }));
      } catch (error) {
        logger.error('Error fetching notifications:', error);
        return [];
      }
    });
  }

  /**
   * Get count of unread notifications
   */
  async getUnreadNotificationCount(): Promise<number> {
    return wrapReadCall(async () => {
      if (!this.transactionManagerActor) await this.initialize();

      try {
        const count = await this.txActor.getUnreadNotificationCount();
        return Number(count);
      } catch (error) {
        logger.error('Error fetching unread count:', error);
        return 0;
      }
    });
  }

  /**
   * Mark a notification as read
   */
  async markNotificationRead(notificationId: number): Promise<boolean> {
    return wrapWriteCall(async () => {
      if (!this.transactionManagerActor) await this.initialize();

      try {
        const result = await this.txActor.markNotificationRead(BigInt(notificationId));
        return 'ok' in result;
      } catch (error) {
        logger.error('Error marking notification read:', error);
        return false;
      }
    });
  }

  /**
   * Mark all notifications as read
   */
  async markAllNotificationsRead(): Promise<number> {
    return wrapWriteCall(async () => {
      if (!this.transactionManagerActor) await this.initialize();

      try {
        const count = await this.txActor.markAllNotificationsRead();
        return Number(count);
      } catch (error) {
        logger.error('Error marking all notifications read:', error);
        return 0;
      }
    });
  }

  /**
   * Get notifications for a specific transaction
   */
  async getTransactionNotifications(transactionId: string): Promise<Array<{
    id: number;
    transactionId: string;
    recipient: string;
    message: string;
    docType: string;
    documentHash: string;
    uploadedBy: string;
    createdAt: bigint;
    read: boolean;
  }>> {
    return wrapReadCall(async () => {
      if (!this.transactionManagerActor) await this.initialize();

      try {
        const result = await this.txActor.getTransactionNotifications(transactionId);
        if ('ok' in result) {
          return result.ok.map((n) => ({
            id: Number(n.id),
            transactionId: n.transactionId,
            recipient: n.recipient.toString(),
            message: n.message,
            docType: n.docType,
            documentHash: n.documentHash,
            uploadedBy: n.uploadedBy.toString(),
            createdAt: n.createdAt,
            read: n.read,
          }));
        }
        return [];
      } catch (error) {
        logger.error('Error fetching transaction notifications:', error);
        return [];
      }
    });
  }

  // ==================== Email Verification Methods ====================

  /**
   * Verify email with token
   */
  async verifyEmail(token: string): Promise<{ success: boolean; message: string }> {
    return wrapWriteCall(async () => {
      if (!this.userManagementActor) await this.initialize();

      try {
        const result = await this.umActor.verifyEmail(token, this.requireCsrfToken());
        if (result) {
          return { success: true, message: 'Email verified successfully' };
        } else {
          return { success: false, message: 'Invalid or expired verification token' };
        }
      } catch (error) {
        logger.error('Error verifying email');
        return { success: false, message: 'Failed to verify email' };
      }
    });
  }

  /**
   * Resend verification email
   */
  async resendVerificationEmail(): Promise<{ success: boolean; message: string }> {
    return wrapWriteCall(async () => {
      if (!this.userManagementActor) await this.initialize();

      try {
        const result = await this.umActor.resendVerificationEmail(this.requireCsrfToken());
        if (result) {
          return { success: true, message: 'Verification email sent' };
        } else {
          return { success: false, message: 'Failed to send verification email. Email may already be verified.' };
        }
      } catch (error) {
        logger.error('Error resending verification email');
        return { success: false, message: 'Failed to resend verification email' };
      }
    });
  }

  // ==================== Admin Bootstrap Methods ====================

  /**
   * Bootstrap admin user (with race condition protection)
   * SECURITY: Uses mutex pattern to prevent concurrent calls that could
   * create multiple admin accounts or corrupt state
   *
   * @param name - Admin user's name
   * @param email - Admin user's email
   * @returns Success status and message
   */
  async bootstrapAdmin(name: string, email: string): Promise<{ success: boolean; message: string }> {
    return wrapWriteCall(async () => {
      // CRITICAL: Check if bootstrap is already in progress
      if (this.bootstrapAdminLock) {
        try {
          await this.bootstrapAdminLock;
          return { success: false, message: 'Bootstrap already in progress or completed by another call' };
        } catch (error) {
          return { success: false, message: 'Bootstrap operation failed' };
        }
      }

      // Create lock promise to prevent concurrent execution
      const bootstrapPromise = (async () => {
        try {
          if (!this.userManagementActor) {
            await this.initialize();
          }

          const result = await this.umActor.bootstrapAdmin(name, email);

          if (result === true) {
            return { success: true, message: 'Admin user bootstrapped successfully' };
          } else {
            return { success: false, message: 'Failed to bootstrap admin user' };
          }
        } finally {
          // CRITICAL: Always clear the lock in finally block to prevent deadlock
          this.bootstrapAdminLock = null;
        }
      })();

      // Set the lock to prevent concurrent calls
      this.bootstrapAdminLock = bootstrapPromise;

      return await bootstrapPromise;
    });
  }

  /**
   * Helper: Generate a cache key for duplicate submission detection
   * @private
   */
  private generateSubmissionCacheKey(operation: string, data: object): string {
    // Create a deterministic string representation of the data
    const dataString = JSON.stringify(data, Object.keys(data).sort());
    // Simple hash for the key
    return `${operation}-${this.simpleHash(dataString)}`;
  }

  /**
   * Helper: Simple hash function for cache keys
   * @private
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Helper: Check if a submission is a duplicate within the TTL window
   * @private
   */
  private isDuplicateSubmission(cacheKey: string): boolean {
    const now = Date.now();

    // Clean up expired entries first
    for (const [key, timestamp] of this.submissionCache.entries()) {
      if (now - timestamp > this.DUPLICATE_SUBMISSION_TTL) {
        this.submissionCache.delete(key);
      }
    }

    // Check if this submission was made recently
    const lastSubmission = this.submissionCache.get(cacheKey);
    if (lastSubmission && (now - lastSubmission) < this.DUPLICATE_SUBMISSION_TTL) {
      return true;
    }

    // Record this submission
    this.submissionCache.set(cacheKey, now);
    return false;
  }

  // ============================================
  // MULTI-PARTY TRANSACTION MANAGEMENT
  // ============================================

  /**
   * Add a party to a transaction (buyer or seller)
   * @param transactionId The transaction ID
   * @param name The party's name
   * @param email The party's email
   * @param role The party role: 'primary_buyer', 'secondary_buyer', 'primary_seller', 'secondary_seller'
   * @param isPrimary Whether this is a primary party
   */
  async addParty(
    transactionId: string,
    name: string,
    email: string,
    role: string,
    isPrimary: boolean
  ): Promise<import('../types/multiParty.types').TransactionParty> {
    if (!this.transactionManagerActor) await this.initialize();

    const result = await wrapWriteCall<CandidResult<unknown>>(() =>
      this.txActor.addParty(transactionId, name, email, role, isPrimary)
    );

    if ('err' in result) {
      throw new Error(result.err);
    }

    // Normalize the party data from canister response
    const { normalizeParty } = await import('../types/multiParty.types');
    return normalizeParty(result.ok);
  }

  /**
   * Remove a party from a transaction
   * @param transactionId The transaction ID
   * @param partyPrincipal The principal of the party to remove
   */
  async removeParty(transactionId: string, partyPrincipal: string): Promise<void> {
    if (!this.transactionManagerActor) await this.initialize();

    const principal = Principal.fromText(partyPrincipal);
    const result = await wrapWriteCall<CandidResult<unknown>>(() =>
      this.txActor.removeParty(transactionId, principal)
    );

    if ('err' in result) {
      throw new Error(result.err);
    }
  }

  /**
   * Caller-initiated removal from a transaction they joined but didn't
   * create. Counterpart to removeParty (seller/admin-driven). The canister
   * rejects sellers/creators (they should use deleteTransaction), gates on
   * pre-exchange status, and — if the caller is the assigned buyer — resets
   * the buyer slot back to the seller placeholder so the invite code is
   * reusable by a new joiner.
   *
   * Returns the canister's success message so the UI can surface it
   * verbatim (the buyer-reset case has different wording from the
   * generic-leave case).
   */
  async leaveTransaction(transactionId: string): Promise<string> {
    if (!this.transactionManagerActor) await this.initialize();

    const result = await wrapWriteCall<CandidResult<string>>(() =>
      this.txActor.leaveTransaction(transactionId)
    );

    if ('err' in result) {
      throw new Error(result.err);
    }
    return result.ok;
  }

  /**
   * Update AML document status for a specific party
   * @param transactionId The transaction ID
   * @param partyPrincipal The principal of the party
   * @param docType Document type: 'proof_of_identity' or 'proof_of_address'
   */
  async updatePartyAMLDoc(
    transactionId: string,
    partyPrincipal: string,
    docType: 'proof_of_identity' | 'proof_of_address'
  ): Promise<import('../types/multiParty.types').TransactionParty> {
    if (!this.transactionManagerActor) await this.initialize();

    const principal = Principal.fromText(partyPrincipal);
    const result = await wrapWriteCall<CandidResult<unknown>>(() =>
      this.txActor.updatePartyAMLDoc(transactionId, principal, docType)
    );

    if ('err' in result) {
      throw new Error(result.err);
    }

    const { normalizeParty } = await import('../types/multiParty.types');
    return normalizeParty(result.ok);
  }

  /**
   * Get party progress for a transaction
   * @param transactionId The transaction ID
   */
  async getPartyProgress(
    transactionId: string
  ): Promise<import('../types/multiParty.types').TransactionPartyProgress> {
    if (!this.transactionManagerActor) await this.initialize();

    const result = await wrapReadCall<CandidResult<PartyProgressRaw>>(() =>
      this.txActor.getPartyProgress(transactionId)
    );

    if ('err' in result) {
      throw new Error(result.err);
    }

    const { normalizeParty } = await import('../types/multiParty.types');
    const data = result.ok;

    // Normalize all parties in the response
    return {
      buyers: {
        parties: (data.buyers.parties || []).map(normalizeParty),
        totalParties: Number(data.buyers.totalParties),
        completedParties: Number(data.buyers.completedParties),
        overallProgress: Number(data.buyers.overallProgress),
        allAMLComplete: Boolean(data.buyers.allAMLComplete),
      },
      sellers: {
        parties: (data.sellers.parties || []).map(normalizeParty),
        totalParties: Number(data.sellers.totalParties),
        completedParties: Number(data.sellers.completedParties),
        overallProgress: Number(data.sellers.overallProgress),
        allAMLComplete: Boolean(data.sellers.allAMLComplete),
      },
      readyToExchange: Boolean(data.readyToExchange),
    };
  }

  /**
   * Get all parties for a transaction
   * @param transactionId The transaction ID
   */
  async getTransactionParties(transactionId: string): Promise<{
    buyers: import('../types/multiParty.types').TransactionParty[];
    sellers: import('../types/multiParty.types').TransactionParty[];
  }> {
    if (!this.transactionManagerActor) await this.initialize();

    const result = await wrapReadCall<CandidResult<{ buyers?: unknown[]; sellers?: unknown[] }>>(() =>
      this.txActor.getTransactionParties(transactionId)
    );

    if ('err' in result) {
      throw new Error(result.err);
    }

    const { normalizeParty } = await import('../types/multiParty.types');
    return {
      buyers: (result.ok.buyers || []).map(normalizeParty),
      sellers: (result.ok.sellers || []).map(normalizeParty),
    };
  }

  // ============================================
  // END MULTI-PARTY TRANSACTION MANAGEMENT
  // ============================================

  // ==================== Land Registry Integration Methods ====================

  async getLandRegistryStatus(): Promise<{
    lastValidated: bigint;
    apiEndpoint: string;
    environment: { sandbox: null } | { production: null };
  } | null> {
    return wrapReadCall(async () => {
      if (!this.landRegistryIntegrationActor) await this.initialize();
      try {
        // Candid `opt` — indexing a `[] | [T]` yields `T | undefined`, so
        // normalise the empty case to null to match the declared return.
        const result = await this.lriActor.get_land_registry_status();
        return result[0] ?? null;
      } catch (error) {
        logger.error('Error getting LR status:', error);
        return null;
      }
    });
  }

  async getPendingLRSubmissions(companyId: string): Promise<unknown[]> {
    return wrapReadCall(async () => {
      if (!this.landRegistryIntegrationActor) await this.initialize();
      try {
        return await this.lriActor.get_all_pending_land_registry_submissions(companyId);
      } catch (error) {
        logger.error('Error getting pending LR submissions:', error);
        return [];
      }
    });
  }

  async getLandRegistryStats(companyId: string, period: { day: null } | { month: null } | { week: null } | { year: null }): Promise<{
    pending: number;
    totalSubmissions: number;
    avgTimeToRegistration: number;
    successful: number;
    failed: number;
  } | null> {
    return wrapReadCall(async () => {
      if (!this.landRegistryIntegrationActor) await this.initialize();
      try {
        return await this.lriActor.get_land_registry_stats(companyId, period);
      } catch (error) {
        logger.error('Error getting LR stats:', error);
        return null;
      }
    });
  }

  async validateLandRegistryConnection(): Promise<{ ok: boolean } | { err: string }> {
    return wrapReadCall(async () => {
      if (!this.landRegistryIntegrationActor) await this.initialize();
      try {
        return await this.lriActor.validate_land_registry_connection();
      } catch (error) {
        logger.error('Error validating LR connection:', error);
        return { err: String(error) };
      }
    });
  }

  async checkLandRegistryTransactionStatus(transactionId: string): Promise<unknown | null> {
    return wrapReadCall(async () => {
      if (!this.landRegistryIntegrationActor) await this.initialize();
      try {
        const result = await this.lriActor.check_land_registry_status(transactionId);
        return result[0] ?? null;
      } catch (error) {
        logger.error('Error checking LR transaction status:', error);
        return null;
      }
    });
  }

  async getAllLandRegistryTransactions(): Promise<Array<[string, unknown]>> {
    return wrapReadCall(async () => {
      if (!this.landRegistryIntegrationActor) await this.initialize();
      try {
        return await this.lriActor.get_all_transactions();
      } catch (error) {
        logger.error('Error getting all LR transactions:', error);
        return [];
      }
    });
  }

  // These two were written against a guessed shape while the methods were not
  // yet deployed. They ARE deployed now, and the real records look nothing like
  // the guess — CredentialStatus has no `status`/`lastChecked`, and
  // getRateLimitStatus returns [endpoint, RateLimitInfo] pairs. Both silently
  // produced empty output. Mapped from the actual Candid below.

  async getCredentialStatus(): Promise<{ status: string; lastChecked: bigint } | null> {
    return wrapReadCall(async () => {
      if (!this.landRegistryIntegrationActor) await this.initialize();
      try {
        const s = await this.lriActor.getCredentialStatus();
        return {
          status: s.isExpired ? 'expired' : s.isConfigured ? 'active' : 'invalid',
          // `lastRotated` is the only timestamp the canister keeps; 0n when never rotated.
          lastChecked: s.lastRotated[0] ?? 0n,
        };
      } catch (error) {
        logger.error('Error getting LR credential status:', error);
        return null;
      }
    });
  }

  // Reports calls MADE, not calls remaining: the per-endpoint caps live in a
  // private `getEndpointLimit` inside the canister and are not exposed, so a
  // "remaining" figure here would be a duplicated constant waiting to drift.
  async getRateLimitStatus(): Promise<
    Array<{ endpoint: string; callsToday: number; callsThisHour: number; resetTime: bigint }>
  > {
    return wrapReadCall(async () => {
      if (!this.landRegistryIntegrationActor) await this.initialize();
      try {
        const pairs = await this.lriActor.getRateLimitStatus();
        return pairs.map(([endpoint, info]) => ({
          endpoint: endpoint || info.endpoint,
          callsToday: Number(info.callsToday),
          callsThisHour: Number(info.callsThisHour),
          resetTime: info.dayResetAt,
        }));
      } catch (error) {
        logger.error('Error getting LR rate limit status:', error);
        return [];
      }
    });
  }

  async getNotificationPollingStatus(): Promise<unknown | null> {
    return wrapReadCall(async () => {
      if (!this.landRegistryIntegrationActor) await this.initialize();
      try {
        return await this.lriActor.getNotificationPollingStatus();
      } catch (error) {
        logger.error('getNotificationPollingStatus not available on canister:', error);
        return null;
      }
    });
  }

  // ==================== Transaction Manager — Requisitions & Searches ====================

  async getOutstandingRequisitions(): Promise<Array<[string, { requisitionId: string; description: string; isResolved: boolean; category: string; raisedAt: bigint }]>> {
    return wrapReadCall(async () => {
      if (!this.transactionManagerActor) await this.initialize();
      try {
        return await this.txActor.getOutstandingRequisitions();
      } catch (error) {
        logger.error('Error getting outstanding requisitions:', error);
        return [];
      }
    });
  }

  async getExpiringSearches(withinDays: number): Promise<unknown[]> {
    return wrapReadCall(async () => {
      if (!this.transactionManagerActor) await this.initialize();
      try {
        return await this.txActor.getExpiringSearches(BigInt(withinDays));
      } catch (error) {
        logger.error('Error getting expiring searches:', error);
        return [];
      }
    });
  }

  // ==================== Budget / Ledger Methods ====================

  async getDailyLRSpend(): Promise<number | null> {
    return wrapReadCall(async () => {
      if (!this.ledgerManagerActor) await this.initialize();
      try {
        // Returns a bare `nat`, not a Result. The old `'ok' in result` threw
        // ("Cannot use 'in' operator to search for 'ok' in 0") straight into the
        // catch below, so this method always resolved to null.
        return Number(await this.lmActor.getDailyLRSpend());
      } catch (error) {
        logger.error('Error getting daily LR spend:', error);
        return null;
      }
    });
  }

  async getMonthlyLRSpend(): Promise<number | null> {
    return wrapReadCall(async () => {
      if (!this.ledgerManagerActor) await this.initialize();
      try {
        // Bare `nat`, not a Result — same latent bug as getDailyLRSpend.
        return Number(await this.lmActor.getMonthlyLRSpend());
      } catch (error) {
        logger.error('Error getting monthly LR spend:', error);
        return null;
      }
    });
  }

  async getBudgetStatus(): Promise<{
    remaining: number;
    total: number;
    canAfford: boolean;
  } | null> {
    return wrapReadCall(async () => {
      if (!this.ledgerManagerActor) await this.initialize();
      try {
        // Returns BudgetStatus directly, not a Result — the old `'ok' in result`
        // was always false, so this method always resolved to null and the admin
        // budget panel never showed a figure. BudgetStatus has no `remaining` /
        // `total` / `canAfford` fields either; they are derived here.
        const status = await this.lmActor.getBudgetStatus();
        return {
          // Paired with getDailyLRSpend on the dashboard, so report the daily budget.
          remaining: Number(status.dailyRemaining),
          total: Number(status.dailyLimit),
          // A call is affordable only if it breaches neither cap.
          canAfford: !status.isOverDailyBudget && !status.isOverMonthlyBudget,
        };
      } catch (error) {
        logger.error('Error getting budget status:', error);
        return null;
      }
    });
  }

  async getLRCostsForTransaction(transactionId: string): Promise<Record<string, number> | null> {
    return wrapReadCall(async () => {
      if (!this.ledgerManagerActor) await this.initialize();
      try {
        // Returns a vec of cost entries, not a Result — `'ok' in result` was
        // always false on an array, so this always resolved to null. Aggregated
        // to pence-per-endpoint, summing repeat calls to the same endpoint.
        const entries = await this.lmActor.getLRCostsForTransaction(transactionId);
        const costs: Record<string, number> = {};
        for (const entry of entries) {
          costs[entry.apiEndpoint] = (costs[entry.apiEndpoint] ?? 0) + Number(entry.costPence);
        }
        return costs;
      } catch (error) {
        logger.error('Error getting LR costs for transaction:', error);
        return null;
      }
    });
  }

  // ==================== Additional Email Methods ====================

  async getUnprocessedNotifications(): Promise<unknown[]> {
    return wrapReadCall(async () => {
      if (!this.emailServiceActor) await this.initialize();
      try {
        return await this.esActor.getUnprocessedNotifications();
      } catch (error) {
        logger.error('Error getting unprocessed notifications:', error);
        return [];
      }
    });
  }

  async getLandRegistryNotifications(transactionId: string): Promise<unknown[]> {
    return wrapReadCall(async () => {
      if (!this.emailServiceActor) await this.initialize();
      try {
        return await this.esActor.getLandRegistryNotifications(transactionId);
      } catch (error) {
        logger.error('Error getting LR notifications:', error);
        return [];
      }
    });
  }

  // ==================== Additional Document Methods ====================

  async getExpiredLRDocuments(): Promise<unknown[]> {
    return wrapReadCall(async () => {
      await this.ensureDocumentStorageActor();
      try {
        return await this.documentStorageActor!.getExpiredLandRegistryDocuments();
      } catch (error) {
        logger.error('Error getting expired LR documents:', error);
        return [];
      }
    });
  }

  async getRecentStorageAuditLogs(limit: number): Promise<unknown[]> {
    return wrapReadCall(async () => {
      await this.ensureDocumentStorageActor();
      try {
        return await this.documentStorageActor!.getRecentAuditLogs(BigInt(limit));
      } catch (error) {
        logger.error('Error getting storage audit logs:', error);
        return [];
      }
    });
  }

  async getVerificationStats(): Promise<{
    verified: number;
    pending: number;
    failed: number;
  } | null> {
    return wrapReadCall(async () => {
      if (!this._documentVerificationActor) await this.initialize();
      try {
        const stats = await this.dvActor.getStats();
        // The canister exposes totalDocuments / verifiedDocuments / totalVerifications
        // / totalAuditLogs. This read `.verified`, `.pending` and `.failed`, none of
        // which exist, so every field was `Number(undefined)` — the admin Documents
        // panel has been rendering "✓ NaN ⏳ NaN ✗ NaN" with NaN-width bars.
        const total = Number(stats.totalDocuments);
        const verified = Number(stats.verifiedDocuments);
        return {
          verified,
          pending: Math.max(0, total - verified),
          // document_verification tracks no failure state, so there is nothing
          // truthful to put here. Reported as 0 rather than invented.
          failed: 0,
        };
      } catch (error) {
        logger.error('Error getting verification stats:', error);
        return null;
      }
    });
  }

  async getVerificationAuditLogs(): Promise<unknown[]> {
    return wrapReadCall(async () => {
      if (!this._documentVerificationActor) await this.initialize();
      try {
        return await this.dvActor.getAuditLogs();
      } catch (error) {
        logger.error('Error getting verification audit logs:', error);
        return [];
      }
    });
  }

  // --- Solicitor methods ---
  // NOTE: Parameters typed as `any` until Candid declarations are regenerated.

  async assignSolicitorRecord(
    transactionId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    solicitorRecord: any
  ): Promise<{ ok: null } | { err: string }> {
    await this.initialize();
    return this.txActor.assignSolicitorRecord(transactionId, solicitorRecord);
  }

  async updateSolicitorTaskStatus(
    transactionId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    taskType: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    newStatus: any,
    evidenceDocId: [] | [string]
  ): Promise<{ ok: null } | { err: string }> {
    await this.initialize();
    return this.txActor.updateSolicitorTaskStatus(
      transactionId,
      taskType,
      newStatus,
      evidenceDocId
    );
  }

  async removeSolicitor(
    transactionId: string,
    side: { buyer: null } | { seller: null }
  ): Promise<{ ok: null } | { err: string }> {
    await this.initialize();
    return this.txActor.removeSolicitor(transactionId, side);
  }

  async getSolicitorStatus(transactionId: string): Promise<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { ok: { buyerSolicitor: [] | [any]; sellerSolicitor: [] | [any] } } | { err: string }
  > {
    await this.initialize();
    return this.txActor.getSolicitorStatus(transactionId);
  }

  async updateSolicitorVerification(
    transactionId: string,
    side: { buyer: null } | { seller: null },
    verified: boolean
  ): Promise<{ ok: null } | { err: string }> {
    await this.initialize();
    return this.txActor.updateSolicitorVerification(transactionId, side, verified);
  }

  // ==================== TA Form Methods ====================

  /**
   * Save TA6 Property Information (6th edition) to the canister.
   * UI model -> candid record via toCandidTA6 (services/ta6/).
   */
  async updateTA6(
    txId: string,
    data: import('../types/ta6.types').TA6PropertyInformation
  ): Promise<void> {
    return wrapWriteCall(async () => {
      if (!this.transactionManagerActor) await this.initialize();
      const result = await this.txActor.updateTA6(txId, toCandidTA6(data));
      if ('err' in result) throw new Error(result.err);
    });
  }

  /**
   * Fetch TA6 data (6th edition) from the canister. Returns null if not yet
   * submitted. Candid record -> UI model via fromCandidTA6 (services/ta6/).
   */
  async getTA6(
    txId: string
  ): Promise<import('../types/ta6.types').TA6PropertyInformation | null> {
    return wrapReadCall(async () => {
      if (!this.transactionManagerActor) await this.initialize();
      const result = await this.txActor.getTA6(txId);
      if ('err' in result) throw new Error(result.err);
      if (result.ok.length === 0 || result.ok[0] == null) return null;
      return fromCandidTA6(result.ok[0] as CandidTA6PropertyInformation);
    });
  }

  /**
   * Run the canister-side cross-reference sweep over the transaction's form
   * data. Returns the number of anomalies recorded.
   */
  async runCrossReference(txId: string): Promise<number> {
    return wrapWriteCall(async () => {
      if (!this.transactionManagerActor) await this.initialize();
      const result = await this.txActor.runCrossReference(txId);
      if ('err' in result) throw new Error(result.err);
      return Number(result.ok);
    });
  }

  /**
   * Fetch cross-reference anomalies for a transaction (severity variants ->
   * lowercase strings, bigint time -> ISO string).
   */
  async getAnomalies(txId: string): Promise<TA6Anomaly[]> {
    return wrapReadCall(async () => {
      if (!this.transactionManagerActor) await this.initialize();
      const result = await this.txActor.getAnomalies(txId);
      if ('err' in result) throw new Error(result.err);
      return (result.ok as CandidAnomaly[]).map(fromCandidAnomaly);
    });
  }

  /**
   * Record that the caller has seen the official-TA6-wording notice.
   */
  async acknowledgeTA6Wording(txId: string): Promise<void> {
    return wrapWriteCall(async () => {
      if (!this.transactionManagerActor) await this.initialize();
      const result = await this.txActor.acknowledgeTA6Wording(txId);
      if ('err' in result) throw new Error(result.err);
    });
  }

  /**
   * Whether the caller has acknowledged the TA6 wording notice for this
   * transaction. The canister returns a bare bool (no Result wrapper).
   */
  async hasAcknowledgedTA6Wording(txId: string): Promise<boolean> {
    return wrapReadCall(async () => {
      if (!this.transactionManagerActor) await this.initialize();
      return Boolean(await this.txActor.hasAcknowledgedTA6Wording(txId));
    });
  }

  /**
   * Save TA10 Fittings & Contents to the canister.
   */
  async updateTA10(
    txId: string,
    data: import('../types/ta10.types').TA10FittingsAndContents
  ): Promise<void> {
    return wrapWriteCall(async () => {
      if (!this.transactionManagerActor) await this.initialize();
      const candid = {
        rooms: data.rooms.map((room) => ({
          roomName: room.roomName,
          fittings: room.fittings.map((f) => ({
            item: f.item,
            included: f.included,
            notes: toOpt(f.notes),
          })),
        })),
        outdoorItems: data.outdoorItems.map((f) => ({
          item: f.item,
          included: f.included,
          notes: toOpt(f.notes),
        })),
        additionalItems: data.additionalItems,
        completedBy: Principal.anonymous(),
        completedAt: toOpt(
          data.completedAt
            ? BigInt(new Date(data.completedAt).getTime()) * BigInt(1_000_000)
            : null
        ),
        lastModifiedBy: Principal.anonymous(),
        lastModifiedAt: BigInt(Date.now()) * BigInt(1_000_000),
      };
      const result = await this.txActor.updateTA10(txId, candid);
      if ('err' in result) throw new Error(result.err);
    });
  }

  /**
   * Fetch TA10 data from the canister. Returns null if not yet submitted.
   */
  async getTA10(
    txId: string
  ): Promise<import('../types/ta10.types').TA10FittingsAndContents | null> {
    return wrapReadCall(async () => {
      if (!this.transactionManagerActor) await this.initialize();
      const result = await this.txActor.getTA10(txId);
      if ('err' in result) throw new Error(result.err);
      if (result.ok.length === 0 || result.ok[0] == null) return null;
      const c = result.ok[0];
      return {
        rooms: c.rooms.map((room: { roomName: string; fittings: Array<{ item: string; included: boolean; notes: [] | [string] }> }) => ({
          roomName: room.roomName,
          fittings: room.fittings.map((f) => ({
            item: f.item,
            included: f.included,
            notes: f.notes[0] ?? null,
          })),
        })),
        outdoorItems: c.outdoorItems.map((f: { item: string; included: boolean; notes: [] | [string] }) => ({
          item: f.item,
          included: f.included,
          notes: f.notes[0] ?? null,
        })),
        additionalItems: c.additionalItems,
        completedBy: c.completedBy,
        completedAt: c.completedAt.length > 0
          ? new Date(Number(c.completedAt[0]) / 1_000_000).toISOString()
          : null,
        lastModifiedBy: c.lastModifiedBy,
        lastModifiedAt: new Date(Number(c.lastModifiedAt) / 1_000_000).toISOString(),
      };
    });
  }

  /**
   * Save TA7 Leasehold Information to the canister.
   */
  async updateTA7(
    txId: string,
    data: import('../types/ta7.types').TA7LeaseholdInformation
  ): Promise<void> {
    return wrapWriteCall(async () => {
      if (!this.transactionManagerActor) await this.initialize();
      const candid = {
        leaseTermYears: BigInt(data.leaseTermYears),
        leaseStartDate: data.leaseStartDate,
        leaseExpiryDate: data.leaseExpiryDate,
        groundRentAmount: BigInt(data.groundRentAmount),
        groundRentPaymentFrequency: data.groundRentPaymentFrequency,
        serviceChargeAmount: BigInt(data.serviceChargeAmount),
        serviceChargePaymentFrequency: data.serviceChargePaymentFrequency,
        freeholder: data.freeholder,
        managingAgent: toOpt(data.managingAgent),
        restrictions: data.restrictions,
        alterationsAllowed: data.alterationsAllowed,
        sublettingAllowed: data.sublettingAllowed,
        petsAllowed: data.petsAllowed,
        completedBy: Principal.anonymous(),
        completedAt: toOpt(
          data.completedAt
            ? BigInt(new Date(data.completedAt).getTime()) * BigInt(1_000_000)
            : null
        ),
        lastModifiedBy: Principal.anonymous(),
        lastModifiedAt: BigInt(Date.now()) * BigInt(1_000_000),
      };
      const result = await this.txActor.updateTA7(txId, candid);
      if ('err' in result) throw new Error(result.err);
    });
  }

  /**
   * Fetch TA7 data from the canister. Returns null if not yet submitted.
   */
  async getTA7(
    txId: string
  ): Promise<import('../types/ta7.types').TA7LeaseholdInformation | null> {
    return wrapReadCall(async () => {
      if (!this.transactionManagerActor) await this.initialize();
      const result = await this.txActor.getTA7(txId);
      if ('err' in result) throw new Error(result.err);
      if (result.ok.length === 0 || result.ok[0] == null) return null;
      const c = result.ok[0];
      return {
        leaseTermYears: Number(c.leaseTermYears),
        leaseStartDate: c.leaseStartDate,
        leaseExpiryDate: c.leaseExpiryDate,
        groundRentAmount: Number(c.groundRentAmount),
        groundRentPaymentFrequency: c.groundRentPaymentFrequency as import('../types/ta7.types').TA7LeaseholdInformation['groundRentPaymentFrequency'],
        serviceChargeAmount: Number(c.serviceChargeAmount),
        serviceChargePaymentFrequency: c.serviceChargePaymentFrequency as import('../types/ta7.types').TA7LeaseholdInformation['serviceChargePaymentFrequency'],
        freeholder: c.freeholder,
        managingAgent: c.managingAgent[0] ?? null,
        restrictions: c.restrictions,
        alterationsAllowed: c.alterationsAllowed,
        sublettingAllowed: c.sublettingAllowed,
        petsAllowed: c.petsAllowed,
        completedBy: c.completedBy,
        completedAt: c.completedAt.length > 0
          ? new Date(Number(c.completedAt[0]) / 1_000_000).toISOString()
          : null,
        lastModifiedBy: c.lastModifiedBy,
        lastModifiedAt: new Date(Number(c.lastModifiedAt) / 1_000_000).toISOString(),
      };
    });
  }

  /**
   * Record that a form PDF was uploaded — stores file hash on-chain for audit.
   * formType must be 'ta6', 'ta10', or 'ta7'.
   */
  async recordFormUpload(
    txId: string,
    formType: 'ta6' | 'ta10' | 'ta7',
    fileHash: string,
    fileName: string
  ): Promise<void> {
    return wrapWriteCall(async () => {
      if (!this.transactionManagerActor) await this.initialize();
      const result = await this.txActor.recordFormUpload(txId, formType, fileHash, fileName);
      if ('err' in result) throw new Error(result.err);
    });
  }
}

// Export singleton instance
export const icpService = new ICPService();
export default icpService;

// Re-export the UI-side anomaly shape for consumers of getAnomalies().
export type { TA6Anomaly };
