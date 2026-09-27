import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { icpService } from '../icp.service';

// The fields a signed-out user must not leave behind. They are private, so the
// test reaches them the same way the other icpService tests reach actors.
type Privates = {
  isExternalIdentitySet: boolean;
  externalIdentity: unknown;
  _documentStorageActor: unknown;
  myProfileCache: unknown;
  agent: unknown;
  authClient: unknown;
};

const privates = (): Privates => icpService as unknown as Privates;

describe('icpService.logout', () => {
  beforeEach(() => {
    vi.spyOn(icpService, 'initialize').mockResolvedValue(undefined);
    Object.assign(privates(), {
      isExternalIdentitySet: true,
      externalIdentity: { getPrincipal: () => ({ toText: () => 'previous-user' }) },
      _documentStorageActor: { owner: 'previous-user' },
      myProfileCache: { data: { name: 'Previous User' }, timestamp: Date.now() },
      authClient: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should forget the previous email user\'s key so later calls are not signed as them', async () => {
    await icpService.logout();

    expect(privates().isExternalIdentitySet).toBe(false);
    expect(privates().externalIdentity).toBeNull();
  });

  it('should drop the document storage actor and the cached profile', async () => {
    await icpService.logout();

    expect(privates()._documentStorageActor).toBeNull();
    expect(privates().myProfileCache).toBeNull();
  });
});
