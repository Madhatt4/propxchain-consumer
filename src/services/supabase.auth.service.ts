import { AuthError, Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { KeyPairService } from './keyPair.service';
import { Ed25519KeyIdentity } from '@propxchain/core-client';
import { CompaniesHouseCompany } from './companies-house.service';

interface SignUpResult {
  user: User | null;
  identity: Ed25519KeyIdentity | null;
  error: AuthError | null;
}

/**
 * Why a sign-in produced no identity.
 * - `no_key`  — the user has no blob; regeneration is the correct next step.
 * - `restore_failed` — a blob EXISTS but could not be decrypted. Surface the
 *   error; NEVER regenerate. Regenerating here overwrites the user's on-chain
 *   identity with a new one — silent, irreversible destruction.
 */
export type RestoreFailureReason = 'no_key' | 'restore_failed';

interface SignInResult {
  user: User | null;
  session: Session | null;
  identity: Ed25519KeyIdentity | null;
  error: AuthError | null;
  /**
   * True if a pending developer org was found in user_metadata and
   * successfully created on this sign-in. Read by AuthCallback to
   * route through `/post-login?fresh=1` instead of the normal post-login
   * destination, which triggers the freshSignup branch in decideRoute.
   */
  orgJustCreated?: boolean;
  failureReason?: RestoreFailureReason;
}

/** Pending developer org payload stashed in user_metadata at signup */
export interface PendingDeveloperOrg {
  name: string;
  companies_house_number: string;
  companies_house_verified: boolean;
  companies_house_data: {
    companyNumber: string;
    name: string;
    status: string;
    incorporatedOn: string;
    address: Record<string, string | undefined>;
    isActive: boolean;
  } | null;
}

export const PENDING_ORG_KEY = 'propxchain_pending_developer_org';
const PENDING_ORG_EXPIRES_KEY = 'propxchain_pending_developer_org_expires_at';

export const PENDING_ESTATE_AGENT_ORG_KEY = 'propxchain_pending_estate_agent_org';
export const PENDING_ESTATE_AGENT_ORG_EXPIRES_KEY = 'propxchain_pending_estate_agent_org_expires_at';

/** Pending estate agent org payload stashed in user_metadata at signup */
export interface PendingEstateAgentOrg {
  name: string;
  branch: string;
  redress_scheme: 'PRS' | 'TPO';
  redress_number: string;
  companies_house_number: string | null;
  companies_house_verified: boolean;
  companies_house_data: CompaniesHouseCompany | null;
}

export interface EmailRegistration {
  id: string;
  user_id: string;
  email: string;
  name: string | null;
  role: string | null;
  icp_principal: string | null;
  created_at: string;
  last_login_at: string;
}

export const supabaseAuthService = {
  /** Register new user with email/password, generate ICP key pair */
  async signUp(email: string, password: string, metadata: {
    name: string;
    role: string;
    [key: string]: unknown;
  }): Promise<SignUpResult> {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { ...metadata },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error || !data.user) {
      return { user: null, identity: null, error };
    }

    // Supabase anti-enumeration: when an already-confirmed email signs up
    // again, it silently returns a fake user with identities: []. Detect
    // and surface as a real error so the user gets feedback instead of a
    // verification email that never arrives.
    if (!data.user.identities || data.user.identities.length === 0) {
      const existingError = new Error(
        'An account with this email already exists. Try signing in, or use "Forgot password" to reset.',
      ) as AuthError;
      existingError.name = 'AuthApiError';
      existingError.status = 422;
      return { user: null, identity: null, error: existingError };
    }

    // With email confirmation ON, there's no active session yet.
    // ICP key pair will be generated on first login after verification.
    return { user: data.user, identity: null, error: null };
  },

  /** Begin an OAuth sign-in. Redirects the browser to the provider. */
  async signInWithOAuth(provider: 'google' | 'azure'): Promise<{ error: AuthError | null }> {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        // Azure needs email explicitly; Google returns it by default.
        scopes: provider === 'azure' ? 'email' : undefined,
      },
    });
    return { error };
  },

  /** Sign in with email/password, restore or generate ICP identity */
  async signIn(email: string, password: string): Promise<SignInResult> {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.user || !data.session) {
      return { user: null, session: null, identity: null, error };
    }

    return this._completePostAuthSetup(data.user, data.session);
  },

  /**
   * Complete login from an established Supabase session (OAuth return).
   * Reads the current session and runs the shared post-auth ICP setup.
   */
  async completeOAuthSession(): Promise<SignInResult> {
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (!session || !session.user) {
      const noSession = new Error('No OAuth session found') as AuthError;
      noSession.name = 'AuthSessionMissingError';
      return { user: null, session: null, identity: null, error: noSession };
    }
    return this._completePostAuthSetup(session.user, session);
  },

  /**
   * Shared post-session ICP setup: generate-or-restore the encrypted ICP key,
   * upsert the email registration, run the pending-developer-org hook, and pin
   * the developer principal. Called by both signIn (password) and
   * completeOAuthSession (OAuth).
   */
  async _completePostAuthSetup(user: User, session: Session): Promise<SignInResult> {
    const encryptedKey = user.user_metadata?.encrypted_icp_key;

    if (!encryptedKey) {
      try {
        const { identity, encryptedKey: newKey } = await KeyPairService.generateAndEncrypt(user.id);
        await supabase.auth.updateUser({
          data: { encrypted_icp_key: newKey, icp_principal: identity.getPrincipal().toText() },
        });
        await this._upsertEmailRegistration(user, identity.getPrincipal().toText());
        const orgJustCreated = await this._maybeCreatePendingDeveloperOrg(user, session);
        await this._maybeCreatePendingEstateAgentOrg(user, session);
        await this._maybeLockDeveloperPrincipal(user.id, identity.getPrincipal().toText());
        return { user, session, identity, error: null, orgJustCreated };
      } catch (keyGenError) {
        console.error('ICP key generation failed during post-auth setup:', keyGenError);
        await this._upsertEmailRegistration(user, null);
        return { user, session, identity: null, error: null, failureReason: 'no_key' };
      }
    }

    try {
      const identity = await KeyPairService.decryptAndRestore(encryptedKey, user.id);
      await this._migrateEnvelope(identity, encryptedKey);
      await this._upsertEmailRegistration(
        user,
        user.user_metadata?.icp_principal || identity.getPrincipal().toText(),
      );
      const orgJustCreated = await this._maybeCreatePendingDeveloperOrg(user, session);
      await this._maybeCreatePendingEstateAgentOrg(user, session);
      await this._maybeLockDeveloperPrincipal(user.id, identity.getPrincipal().toText());
      return { user, session, identity, error: null, orgJustCreated };
    } catch (keyRestoreError) {
      console.error('ICP key restore failed during post-auth setup:', keyRestoreError);
      await this._upsertEmailRegistration(user, user.user_metadata?.icp_principal || null);
      // A blob exists and would not decrypt. The caller MUST NOT regenerate.
      return { user, session, identity: null, error: null, failureReason: 'restore_failed' };
    }
  },

  /**
   * Lazily migrate a v1 blob to v2 after a successful restore.
   *
   * Sign-ins migrate; page reloads do not (`restoreIdentity` never writes
   * back). `updateUser({ data })` merges top-level metadata keys rather than
   * replacing them, so this cannot clobber other fields.
   *
   * NEVER throws: a migration failure must not block a login. Worst case the
   * user stays on v1 and migrates on their next sign-in.
   */
  async _migrateEnvelope(identity: Ed25519KeyIdentity, encryptedKey: string): Promise<void> {
    try {
      if (KeyPairService.parseEnvelope(encryptedKey).version !== 1) return;
      const v2Blob = await KeyPairService.reEncryptToV2(identity);
      await supabase.auth.updateUser({ data: { encrypted_icp_key: v2Blob } });
    } catch (migrateError) {
      console.error('ICP key v1->v2 migration failed (login continues):', migrateError);
    }
  },

  /**
   * Pin the user's ICP principal onto every developer org they're a member
   * of where `developer_principal` is currently null. The RPC is idempotent
   * (no-op if already pinned), so we just call it for every dev org.
   *
   * Silent on failure: must never block login. Called from signIn after the
   * principal is settled (key gen or restore) and after pending-org
   * materialisation, so newly-created orgs are also covered on first login.
   */
  async _maybeLockDeveloperPrincipal(userId: string, principalText: string): Promise<void> {
    try {
      const { data: rows, error } = await supabase
        .from('organisation_memberships')
        .select('organisation_id, organisations(type)')
        .eq('user_id', userId);

      if (error || !rows) return;

      const devOrgIds = rows
        .filter((row) => {
          const org = (row as { organisations?: { type?: string } | null }).organisations;
          return org?.type === 'developer';
        })
        .map((row) => (row as { organisation_id: string }).organisation_id);

      for (const orgId of devOrgIds) {
        const { error: rpcError } = await supabase.rpc('lock_developer_principal', {
          p_organisation_id: orgId,
          p_principal: principalText,
        });
        if (rpcError) {
          console.warn(`lock_developer_principal failed for org ${orgId}:`, rpcError);
        }
      }
    } catch (err) {
      console.warn('_maybeLockDeveloperPrincipal failed:', err);
    }
  },

  /** Sign out and clear Supabase session */
  async signOut(): Promise<void> {
    await supabase.auth.signOut();
  },

  /** Get current Supabase session */
  async getSession(): Promise<Session | null> {
    const { data } = await supabase.auth.getSession();
    return data.session;
  },

  /** Get current user */
  async getUser(): Promise<User | null> {
    const { data } = await supabase.auth.getUser();
    return data.user;
  },

  /** Send password reset email */
  async resetPassword(email: string): Promise<{ error: AuthError | null }> {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error };
  },

  /**
   * Restore the identity on page reload.
   *
   * Returns null ONLY when the user genuinely has no key. A blob that exists but
   * will not decrypt THROWS — previously this caught everything and returned
   * null, making a v2 user on a dead oracle indistinguishable from a new user
   * (a silent null identity, which callers treat as "generate one").
   */
  async restoreIdentity(): Promise<Ed25519KeyIdentity | null> {
    const user = await this.getUser();
    if (!user) return null;

    const encryptedKey = user.user_metadata?.encrypted_icp_key;
    if (!encryptedKey) return null;

    return await KeyPairService.decryptAndRestore(encryptedKey, user.id);
  },

  /**
   * Retry ICP key generation for a user whose key gen failed mid-write.
   *
   * GUARD: refuses when `encrypted_icp_key` already exists. The retry exists for
   * a real race (generation interrupted before the blob was written), but a blob
   * that EXISTS and fails to decrypt is a different event entirely — regenerating
   * there overwrites the user's on-chain identity with a fresh one, silently and
   * irreversibly. Under v2, a wrong pepper, a 400 on an old blob's version, and a
   * consumer rollback all reach this path and would all succeed at regenerating.
   *
   * The guard lives here, not at the call sites: two sites gate it today, and it
   * must also cover the ones not written yet.
   */
  async retryKeyGeneration(userId: string): Promise<Ed25519KeyIdentity | null> {
    const user = await this.getUser();
    if (user?.user_metadata?.encrypted_icp_key) {
      console.error(
        'retryKeyGeneration REFUSED: an encrypted_icp_key already exists for this user. ' +
          'Regenerating would destroy their on-chain identity. The blob exists but could ' +
          'not be decrypted — this is a restore failure, not a half-written key.',
      );
      return null;
    }

    try {
      const { identity, encryptedKey } = await KeyPairService.generateAndEncrypt(userId);
      await supabase.auth.updateUser({
        data: {
          encrypted_icp_key: encryptedKey,
          icp_principal: identity.getPrincipal().toText(),
        },
      });
      return identity;
    } catch (retryError) {
      console.error('retryKeyGeneration failed:', retryError);
      return null;
    }
  },

  /**
   * First-login hook: if `propxchain_pending_developer_org` is in
   * user_metadata and not expired, call the create-developer-org edge
   * function to materialise the org + admin membership. Clears the
   * pending fields on success. Leaves them in place on failure so the
   * next sign-in retries (the user can refresh and we'll try again).
   */
  async _maybeCreatePendingDeveloperOrg(
    user: User,
    _session: Session,
  ): Promise<boolean> {
    const pending = user.user_metadata?.[PENDING_ORG_KEY] as PendingDeveloperOrg | undefined;
    const expiresAt = user.user_metadata?.[PENDING_ORG_EXPIRES_KEY] as string | undefined;
    if (!pending) return false;

    if (expiresAt) {
      const expired = new Date(expiresAt).getTime() < Date.now();
      if (expired) {
        console.warn(
          'pending developer org found but expired (>24h), clearing metadata. user:',
          user.id,
        );
        // Clear the stale flag so decideRoute / AuthGate don't keep
        // routing this user to /builder on every subsequent login.
        await supabase.auth.updateUser({
          data: {
            [PENDING_ORG_KEY]: null,
            [PENDING_ORG_EXPIRES_KEY]: null,
          },
        });
        return false;
      }
    }

    try {
      const { data, error } = await supabase.functions.invoke('create-developer-org', {
        body: {
          name: pending.name,
          companies_house_number: pending.companies_house_number,
          companies_house_data: pending.companies_house_data,
        },
      });
      if (error || !data?.organisation) {
        console.error('create-developer-org edge function failed:', error);
        return false;
      }
      // Clear the pending state on success.
      await supabase.auth.updateUser({
        data: {
          [PENDING_ORG_KEY]: null,
          [PENDING_ORG_EXPIRES_KEY]: null,
        },
      });
      return true;
    } catch (err) {
      console.error('Failed to materialise pending developer org:', err);
      return false;
    }
  },

  /** Clear both pending estate agent org metadata keys. */
  async _clearPendingEstateAgentOrg(): Promise<void> {
    await supabase.auth.updateUser({
      data: {
        [PENDING_ESTATE_AGENT_ORG_KEY]: null,
        [PENDING_ESTATE_AGENT_ORG_EXPIRES_KEY]: null,
      },
    });
  },

  /**
   * First-login hook: if `propxchain_pending_estate_agent_org` is in
   * user_metadata and not expired, call the create-estate-agent-org edge
   * function to materialise the org + admin membership. Clears the
   * pending fields on success. Leaves them in place on failure so the
   * next sign-in retries (the user can refresh and we'll try again).
   */
  async _maybeCreatePendingEstateAgentOrg(
    user: User,
    _session: Session,
  ): Promise<boolean> {
    const pending = user.user_metadata?.[PENDING_ESTATE_AGENT_ORG_KEY] as
      | PendingEstateAgentOrg
      | undefined;
    const expiresAt = user.user_metadata?.[PENDING_ESTATE_AGENT_ORG_EXPIRES_KEY] as
      | string
      | undefined;
    if (!pending) return false;

    if (expiresAt && new Date(expiresAt).getTime() < Date.now()) {
      console.warn(
        'pending estate agent org found but expired (>24h), clearing metadata. user:',
        user.id,
      );
      // Clear the stale flag so decideRoute / AuthGate don't keep
      // routing this user to the estate agent onboarding on every
      // subsequent login.
      await this._clearPendingEstateAgentOrg();
      return false;
    }

    try {
      const { data, error } = await supabase.functions.invoke('create-estate-agent-org', {
        body: pending,
      });
      if (error || !data?.organisation) {
        console.error('create-estate-agent-org edge function failed:', error);
        return false;
      }
      await this._clearPendingEstateAgentOrg();
      return true;
    } catch (err) {
      console.error('Failed to materialise pending estate agent org:', err);
      return false;
    }
  },

  /** Upsert email registration row for admin visibility */
  async _upsertEmailRegistration(user: User, principal: string | null): Promise<void> {
    try {
      await supabase.from('email_registrations').upsert({
        user_id: user.id,
        email: user.email ?? '',
        name: user.user_metadata?.name || '',
        role: user.user_metadata?.role || '',
        icp_principal: principal,
        last_login_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
    } catch (err) {
      // Non-critical — don't break login flow
      console.error('Failed to upsert email registration:', err);
    }
  },

  /** Fetch email registrations for the admin dashboard. RLS scopes reads to the
   *  caller's own row unless is_propxchain_admin(), so a non-admin sees a single
   *  row rather than an error. Never restore the old public-read policy here —
   *  the anon key ships in the bundle, so `USING (true)` published every user's
   *  name + email to the internet (card 27dcb3f5). */
  async getEmailRegistrations(): Promise<EmailRegistration[]> {
    const { data, error } = await supabase
      .from('email_registrations')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Failed to fetch email registrations:', error);
      return [];
    }
    return data || [];
  },

  /** Listen for auth state changes */
  onAuthStateChange(callback: (event: string, session: Session | null) => void): { unsubscribe: () => void } {
    const { data } = supabase.auth.onAuthStateChange(callback);
    return { unsubscribe: data.subscription.unsubscribe };
  },
};
