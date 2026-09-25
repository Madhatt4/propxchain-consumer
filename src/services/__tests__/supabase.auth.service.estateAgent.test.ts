import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { User, Session } from '@supabase/supabase-js';

const { invoke, updateUser } = vi.hoisted(() => ({
  invoke: vi.fn(),
  updateUser: vi.fn().mockResolvedValue({ data: null, error: null }),
}));
vi.mock('@/lib/supabase', () => ({
  supabase: { functions: { invoke }, auth: { updateUser } },
}));

import {
  supabaseAuthService,
  PENDING_ESTATE_AGENT_ORG_KEY,
  PENDING_ESTATE_AGENT_ORG_EXPIRES_KEY,
} from '../supabase.auth.service';

const pending = {
  name: 'Acme Homes', branch: 'Sandy', redress_scheme: 'PRS', redress_number: 'PRS001',
  companies_house_number: null, companies_house_verified: false, companies_house_data: null,
};
const userWith = (meta: Record<string, unknown>): User =>
  ({ id: 'u1', user_metadata: meta } as unknown as User);
const session = {} as Session;

describe('_maybeCreatePendingEstateAgentOrg', () => {
  beforeEach(() => { invoke.mockReset(); updateUser.mockClear(); });

  it('returns false and calls nothing when no pending org', async () => {
    const ok = await supabaseAuthService._maybeCreatePendingEstateAgentOrg(userWith({}), session);
    expect(ok).toBe(false);
    expect(invoke).not.toHaveBeenCalled();
  });

  it('invokes create-estate-agent-org and clears metadata on success', async () => {
    invoke.mockResolvedValue({ data: { organisation: { id: 'o1' } }, error: null });
    const future = new Date(Date.now() + 3_600_000).toISOString();
    const ok = await supabaseAuthService._maybeCreatePendingEstateAgentOrg(
      userWith({ [PENDING_ESTATE_AGENT_ORG_KEY]: pending, [PENDING_ESTATE_AGENT_ORG_EXPIRES_KEY]: future }),
      session,
    );
    expect(ok).toBe(true);
    expect(invoke).toHaveBeenCalledWith('create-estate-agent-org', { body: pending });
    expect(updateUser).toHaveBeenCalledWith({
      data: { [PENDING_ESTATE_AGENT_ORG_KEY]: null, [PENDING_ESTATE_AGENT_ORG_EXPIRES_KEY]: null },
    });
  });

  it('clears stale metadata and returns false when expired', async () => {
    const past = new Date(Date.now() - 1000).toISOString();
    const ok = await supabaseAuthService._maybeCreatePendingEstateAgentOrg(
      userWith({ [PENDING_ESTATE_AGENT_ORG_KEY]: pending, [PENDING_ESTATE_AGENT_ORG_EXPIRES_KEY]: past }),
      session,
    );
    expect(ok).toBe(false);
    expect(invoke).not.toHaveBeenCalled();
    expect(updateUser).toHaveBeenCalled();
  });

  it('leaves metadata in place when the edge function fails', async () => {
    invoke.mockResolvedValue({ data: null, error: new Error('boom') });
    const ok = await supabaseAuthService._maybeCreatePendingEstateAgentOrg(
      userWith({ [PENDING_ESTATE_AGENT_ORG_KEY]: pending }), session,
    );
    expect(ok).toBe(false);
    expect(updateUser).not.toHaveBeenCalled();
  });
});
