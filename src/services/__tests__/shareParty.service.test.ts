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

  it('should resolve an on-chain solicitor side from the side lookup', async () => {
    mockGetChaseableStakeholders.mockResolvedValue([
      roster[0],
      { principal: 'sol-p', name: 'sol-p…999', role: 'solicitor', roleDisplay: 'Solicitor' },
    ]);
    mockRpc.mockResolvedValue({
      data: [{ icp_principal: 'sol-p', party_role: 'conveyancer', firm_name: 'Jones LLP', side: 'buyer' }],
      error: null,
    });

    const parties = await sharePartyService.listShareableParties('tx1');

    expect(mockRpc).toHaveBeenCalledWith('get_share_party_sides', { p_transaction_id: 'tx1', p_principals: ['sol-p'] });
    expect(parties[0]).toMatchObject({ label: 'Conveyancer — Jones LLP', role: 'conveyancer', side: 'buyer' });
  });

  it('should keep an on-chain solicitor as a side-less conveyancer when the lookup has no row', async () => {
    mockGetChaseableStakeholders.mockResolvedValue([
      roster[0],
      { principal: 'sol-p', name: 'Sol S.', role: 'solicitor', roleDisplay: 'Solicitor' },
    ]);
    mockRpc.mockResolvedValue({ data: [], error: null });

    const parties = await sharePartyService.listShareableParties('tx1');

    expect(parties[0]).toMatchObject({ label: 'Conveyancer — Sol S.', role: 'conveyancer', side: null });
  });

  it('should treat a principal the lookup puts on both sides as side-unknown', async () => {
    mockRpc.mockResolvedValue({
      data: [
        { icp_principal: 'conv-p', party_role: 'conveyancer', firm_name: 'Smith & Co', side: 'seller' },
        { icp_principal: 'conv-p', party_role: 'conveyancer', firm_name: 'Smith & Co', side: 'buyer' },
      ],
      error: null,
    });

    const parties = await sharePartyService.listShareableParties('tx1');

    expect(parties.find((p) => p.principal === 'conv-p')).toMatchObject({ role: 'conveyancer', side: null });
  });

  it('should keep the side when duplicate rows agree', async () => {
    mockRpc.mockResolvedValue({
      data: [
        { icp_principal: 'conv-p', party_role: 'conveyancer', firm_name: 'Smith & Co', side: 'seller' },
        { icp_principal: 'conv-p', party_role: 'conveyancer', firm_name: 'Smith & Co', side: 'seller' },
      ],
      error: null,
    });

    const parties = await sharePartyService.listShareableParties('tx1');

    expect(parties.find((p) => p.principal === 'conv-p')).toMatchObject({ side: 'seller' });
  });

  it('should leave unlabelled parties side-unknown when the lookup returns nothing', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });

    const parties = await sharePartyService.listShareableParties('tx1');

    expect(parties.find((p) => p.principal === 'conv-p')).toMatchObject({ role: 'other', side: null });
    expect(parties.find((p) => p.principal === 'rando-p')).toMatchObject({ role: 'other', side: null });
  });

  it('should not call the RPC when no accessList (role=other) parties exist', async () => {
    mockGetChaseableStakeholders.mockResolvedValue(roster.slice(0, 2));

    const parties = await sharePartyService.listShareableParties('tx1');

    expect(parties).toHaveLength(1);
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
