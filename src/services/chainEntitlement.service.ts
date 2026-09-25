// PropXchain — SPDX-License-Identifier: Proprietary
import { Actor, HttpAgent } from '@dfinity/agent';
import { IDL } from '@dfinity/candid';
import { logger } from '@/utils/logger';

const IC_HOST = (import.meta.env.VITE_IC_HOST as string) || 'https://icp-api.io';

const idlFactory: IDL.InterfaceFactory = ({ IDL: c }) =>
  c.Service({ isTransactionEntitled: c.Func([c.Text], [c.Bool], ['query']) });

/**
 * Anonymous open-query check "has this transaction's chain been paid for?".
 * Fails closed to false so a query error shows the (safe) teaser rather than
 * leaking the live chain — the server-side proxy gate is the real cost guard.
 *
 * The canister id is read from `import.meta.env` inside the function body
 * (not hoisted to a module-level constant) so it reflects the environment at
 * call time rather than at first import — this also makes the guard
 * independently testable via `vi.stubEnv` per-test.
 */
export async function isChainUnlocked(transactionId: string): Promise<boolean> {
  try {
    const entitlementCanisterId = import.meta.env.VITE_ENTITLEMENT_CANISTER_ID as string;
    if (!entitlementCanisterId) return false;
    // NOTE: the pinned @dfinity/agent version (matching @propxchain/core-client's
    // own dependency, see src/services/icp.service.ts) exposes a plain
    // constructor, not the async `HttpAgent.create` factory some newer
    // @dfinity/agent majors provide.
    const agent = new HttpAgent({ host: IC_HOST });
    const actor = Actor.createActor(idlFactory, { agent, canisterId: entitlementCanisterId });
    return Boolean(await actor.isTransactionEntitled(`vmc-chain:${transactionId}`));
  } catch (err) {
    logger.warn('isChainUnlocked query failed; showing teaser', err);
    return false;
  }
}
