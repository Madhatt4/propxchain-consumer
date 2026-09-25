import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetChaseableStakeholders = vi.fn();
vi.mock('../message.service', () => ({
  messageService: {
    getChaseableStakeholders: (...a: unknown[]) => mockGetChaseableStakeholders(...a),
  },
}));

const mockGetStorePrincipalId = vi.fn();
vi.mock('../../stores/authStore', () => ({
  getStorePrincipalId: () => mockGetStorePrincipalId(),
}));

const mockRpc = vi.fn();
vi.mock('../../lib/supabase', () => ({
  supabase: { rpc: (...a: unknown[]) => mockRpc(...a) },
}));

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { sharePartyService, splitBySide } from '../shareParty.service';

const roster = [
  { principal: 'me', name: 'Marc H.', role: 'seller', roleDisplay: 'Seller' },
  { principal: 'buyer-p', name: 'Betty B.', role: 'buyer', roleDisplay: 'Buyer' },
  { principal: 'conv-p', name: 'conv-p…12345', role: 'other', roleDisplay: 'Participant' },
  { principal: 'rando-p', name: 'Randy R.', role: 'other', roleDisplay: 'Participant' },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockGetChaseableStakeholders.mockResolvedValue(roster);
  mockGetStorePrincipalId.mockReturnValue('me');
});

describe('sharePartyService.listShareableParties', () => {
  it('should exclude the current user and label a panel-matched principal as conveyancer', async () => {
    mockRpc.mockResolvedValue({
      data: [{ icp_principal: 'conv-p', party_role: 'conveyancer', firm_name: 'Smith & Co', side: 'seller' }],
      error: null,
    });

    const parties = await sharePartyService.listShareableParties('tx1');

    expect(parties.map((p) => p.principal)).toEqual(['buyer-p', 'conv-p', 'rando-p']);
    expect(parties[1]).toMatchObject({ label: 'Conveyancer — Smith & Co', role: 'conveyancer', side: 'seller' });
    expect(parties[0]).toMatchObject({ label: 'Buyer — Betty B.', role: 'buyer', side: 'buyer' });
    expect(parties[2]).toMatchObject({ label: 'Participant — Randy R.', role: 'other', side: null });
    expect(mockRpc).toHaveBeenCalledWith('get_share_party_sides', {
      p_transaction_id: 'tx1',
      p_principals: ['conv-p', 'rando-p'],
    });
  });

  it('should label an invited party from its role row and report my side', async () => {
    mockRpc.mockResolvedValue({
      data: [{ icp_principal: 'rando-p', party_role: 'estate_agent', firm_name: null, side: 'seller' }],
      error: null,
    });
    const roster2 = await sharePartyService.loadRoster('tx1');
    expect(roster2.mySide).toBe('seller');
    const agent = roster2.parties.find((p) => p.principal === 'rando-p');
    expect(agent).toMatchObject({ label: 'Estate agent — Randy R.', role: 'estate_agent', side: 'seller' });
  });

  it('should fall back to roster labels when the label RPC errors', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });

    const parties = await sharePartyService.listShareableParties('tx1');

    expect(parties).toHaveLength(3);
    expect(parties[1].label).toBe('Participant — conv-p…12345');
  });

  it('should split parties into your side vs the other side (unknown → other)', () => {
    const parties = [
      { principal: 'a', label: 'A', role: 'conveyancer' as const, side: 'seller' as const },
      { principal: 'b', label: 'B', role: 'buyer' as const, side: 'buyer' as const },
      { principal: 'c', label: 'C', role: 'other' as const, side: null },
    ];
    const { yours, others } = splitBySide(parties, 'seller');
    expect(yours.map((p) => p.principal)).toEqual(['a']);
    expect(others.map((p) => p.principal)).toEqual(['b', 'c']);
    expect(splitBySide(parties, null).yours).toEqual([]);
  });

  it('should not call the RPC when no accessList (role=other) parties exist', async () => {
    mockGetChaseableStakeholders.mockResolvedValue(roster.slice(0, 2));

    const parties = await sharePartyService.listShareableParties('tx1');

    expect(parties).toHaveLength(1);
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
