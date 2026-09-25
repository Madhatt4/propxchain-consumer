// The invite code and property address of one transaction, read from
// transaction_manager.getInviteForPlatform as the platform service identity
// (CONVEYANCER_JOIN_SEED_B64, the same identity the monorepo's chain-parties.ts
// uses). send-party-invite puts these two values into a branded email, so they
// come from the deal, never from the browser (security scan M13).
//
// npm: specifiers, not esm.sh: esm.sh @dfinity builds boot-fail in the
// Supabase edge runtime. The method is a query on the canister but is called
// here as an update (no ['query'] annotation), so the answer is
// consensus-certified rather than signed by one replica.
import { Actor, HttpAgent } from 'npm:@dfinity/agent@2.1.3';
import { Ed25519KeyIdentity } from 'npm:@dfinity/identity@2.1.3';

const TXM_CANISTER_ID = Deno.env.get('TRANSACTION_MANAGER_CANISTER_ID') || 'llj73-cqaaa-aaaaa-qcwwa-cai';

// deno-lint-ignore no-explicit-any
const txmIdl = ({ IDL }: any) =>
  IDL.Service({
    getInviteForPlatform: IDL.Func(
      [IDL.Text],
      [IDL.Opt(IDL.Record({ inviteCode: IDL.Text, propertyAddress: IDL.Text }))],
      [],
    ),
  });

export interface ChainInvite {
  inviteCode: string;
  propertyAddress: string;
}

export interface InviteReader {
  getInviteForPlatform(transactionId: string): Promise<[] | [ChainInvite]>;
}

export type ChainInviteRead =
  | { ok: true; invite: ChainInvite }
  | { ok: false; status: 404 | 502 | 503; error: string };

async function platformReader(): Promise<InviteReader> {
  const seedB64 = Deno.env.get('CONVEYANCER_JOIN_SEED_B64');
  if (!seedB64) throw new Error('CONVEYANCER_JOIN_SEED_B64 not configured');
  const seed = Uint8Array.from(atob(seedB64), (c) => c.charCodeAt(0));
  if (seed.length !== 32) throw new Error('CONVEYANCER_JOIN_SEED_B64 must decode to 32 bytes');
  const identity = Ed25519KeyIdentity.generate(seed);
  const agent = await HttpAgent.create({ host: Deno.env.get('IC_HOST') || 'https://icp-api.io', identity });
  // deno-lint-ignore no-explicit-any
  return Actor.createActor(txmIdl, { agent, canisterId: TXM_CANISTER_ID }) as any as InviteReader;
}

/** `reader` is injected by tests; production builds the platform actor. */
export async function readChainInvite(
  transactionId: string,
  reader?: () => Promise<InviteReader>,
): Promise<ChainInviteRead> {
  let actor: InviteReader;
  try {
    actor = await (reader ?? platformReader)();
  } catch (err) {
    console.error('chain-invite misconfigured:', err instanceof Error ? err.message : String(err));
    return { ok: false, status: 503, error: 'not_configured' };
  }
  try {
    const result = await actor.getInviteForPlatform(transactionId);
    // null covers both "no such deal" and "not the platform identity".
    if (result.length === 0) return { ok: false, status: 404, error: 'transaction_not_found' };
    return { ok: true, invite: result[0] };
  } catch (err) {
    console.error('getInviteForPlatform errored:', err instanceof Error ? err.message : String(err));
    return { ok: false, status: 502, error: 'chain_read_failed' };
  }
}
