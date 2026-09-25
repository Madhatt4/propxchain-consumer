import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('@/services/icp.service', () => ({
  icpService: {
    initialize: vi.fn().mockResolvedValue(undefined),
    getUserPrincipal: vi.fn().mockResolvedValue('test-principal'),
    entitlementActor: { hasActiveEntitlement: vi.fn() },
  },
}));
vi.mock('@/services/stripePayment.service', () => ({
  default: { prepareCheckoutSession: vi.fn() },
}));

import { icpService } from '@/services/icp.service';
import stripePaymentService from '@/services/stripePayment.service';
import { useAddonCheckout } from '../useAddonCheckout';

// icpService's real type doesn't declare entitlementActor (the hook duck-types
// it deliberately, since it doesn't exist on the production service yet) — cast
// for the mocked accesses below rather than widening the real interface.
const mockedIcpService = icpService as unknown as {
  entitlementActor: { hasActiveEntitlement: ReturnType<typeof vi.fn> };
};

describe('useAddonCheckout', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should report needsPayment=false for a free addon without checking entitlements', async () => {
    const { result } = renderHook(() => useAddonCheckout('some-addon', 'free', 0));
    await waitFor(() => expect(result.current.checking).toBe(false));
    expect(result.current.needsPayment).toBe(false);
    expect(mockedIcpService.entitlementActor.hasActiveEntitlement).not.toHaveBeenCalled();
  });

  it('should report needsPayment=true for a per_use addon with no active entitlement', async () => {
    vi.mocked(mockedIcpService.entitlementActor.hasActiveEntitlement).mockResolvedValue(false);
    const { result } = renderHook(() => useAddonCheckout('vmc-chain', 'per_use', 50));
    await waitFor(() => expect(result.current.checking).toBe(false));
    expect(result.current.needsPayment).toBe(true);
  });

  it('should report needsPayment=false for a per_use addon with an active entitlement', async () => {
    vi.mocked(mockedIcpService.entitlementActor.hasActiveEntitlement).mockResolvedValue(true);
    const { result } = renderHook(() => useAddonCheckout('vmc-chain', 'per_use', 50));
    await waitFor(() => expect(result.current.checking).toBe(false));
    expect(result.current.needsPayment).toBe(false);
  });

  it('should redirect through the catalog checkout flow when startCheckout is called', async () => {
    vi.mocked(mockedIcpService.entitlementActor.hasActiveEntitlement).mockResolvedValue(false);
    vi.mocked(stripePaymentService.prepareCheckoutSession).mockResolvedValue({
      sessionId: 'cs_test_1', url: 'https://checkout.stripe.com/pay/cs_test_1',
    });
    const originalLocation = window.location;
    // @ts-expect-error partial mock
    delete window.location;
    // @ts-expect-error partial mock — only href is exercised by startCheckout
    window.location = { ...originalLocation, href: '' };

    const { result } = renderHook(() => useAddonCheckout('vmc-chain', 'per_use', 50));
    await waitFor(() => expect(result.current.checking).toBe(false));
    await result.current.startCheckout();

    expect(stripePaymentService.prepareCheckoutSession).toHaveBeenCalledWith({
      principalId: 'test-principal',
      tier: 'vmc-chain',
      amount: 50,
    });
    expect(window.location.href).toBe('https://checkout.stripe.com/pay/cs_test_1');

    // @ts-expect-error partial mock — restoring the real Location
    window.location = originalLocation;
  });
});
