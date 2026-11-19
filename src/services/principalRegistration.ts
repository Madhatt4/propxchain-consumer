// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * principalRegistration — prove to the server, once per sign-in, that this
 * account holds the key for its ICP principal.
 *
 * The email_registrations row this app writes is only a claim: any signed-in
 * user can put any principal on their own row. Connecting an AI agent
 * (OAuth/MCP) needs a principal the server can trust for an email, so the
 * `register-principal` edge function checks a signature and marks the row
 * verified. Until that has happened for an account, agent connection is
 * refused for it.
 */
import { Ed25519KeyIdentity } from '@propxchain/core-client';
import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';
import { signPrincipalProof } from './principalProof';

const REGISTER_PRINCIPAL_FN = 'register-principal';

/** Must match proofMessage() in the edge function's message.ts. */
export function registerPrincipalMessage(userId: string): string {
  return `${REGISTER_PRINCIPAL_FN}:${userId}`;
}

/** Best effort: a failure only delays agent connection until the next sign-in. */
export async function registerVerifiedPrincipal(
  identity: Ed25519KeyIdentity,
  userId: string,
): Promise<boolean> {
  try {
    const proof = await signPrincipalProof(identity, registerPrincipalMessage(userId));
    const { error } = await supabase.functions.invoke(REGISTER_PRINCIPAL_FN, { body: proof });
    if (error) {
      logger.warn('[principalRegistration] could not register principal', error);
      return false;
    }
    return true;
  } catch (err) {
    logger.warn('[principalRegistration] could not build principal proof', err);
    return false;
  }
}
