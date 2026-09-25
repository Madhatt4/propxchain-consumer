import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const getQuote = vi.fn();
vi.mock('../../../services/tmgroup.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../services/tmgroup.service')>();
  return {
    ...actual,
    tmgroupService: { ...actual.tmgroupService, isEnabled: () => true, getQuote: (...a: unknown[]) => getQuote(...a) },
  };
});

const { useTmGroupCatalogueQuote } = await import('../useTmGroupCatalogueQuote');

const PARTIAL = { success: true, lines: [], unpricedProductTypes: ['PSReport12'] };
const PRICED = { success: true, lines: [{ productType: 'PSReport12', grossPence: 15000 }], unpricedProductTypes: [] };

describe('useTmGroupCatalogueQuote refresh', () => {
  beforeEach(() => getQuote.mockReset());

  it('should quote once per address and again only when refresh() is called', async () => {
    getQuote.mockResolvedValueOnce(PARTIAL).mockResolvedValueOnce(PRICED);
    const { result, rerender } = renderHook(
      ({ pc }: { pc: string }) => useTmGroupCatalogueQuote(pc, 'Central Bedfordshire', null, '14 London Road'),
      { initialProps: { pc: 'SG19 1EX' } },
    );

    await waitFor(() => expect(result.current.isQuoting).toBe(false));
    expect(getQuote).toHaveBeenCalledTimes(1);
    expect(result.current.unpriceable.has('PSReport12')).toBe(true);
    expect(result.current.refreshCount).toBe(0);

    // A re-render with the same inputs is not a new question.
    rerender({ pc: 'SG19 1EX' });
    expect(getQuote).toHaveBeenCalledTimes(1);

    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.isQuoting).toBe(false));

    expect(getQuote).toHaveBeenCalledTimes(2);
    expect(result.current.refreshCount).toBe(1);
    expect(result.current.unpriceable.size).toBe(0);
    expect(result.current.linePence.get('PSReport12')).toBe(15000);
  });

  it('should reset the refresh count for a new address without quoting it twice', async () => {
    getQuote.mockResolvedValue(PRICED);
    const { result, rerender } = renderHook(
      ({ pc }: { pc: string }) => useTmGroupCatalogueQuote(pc, 'Central Bedfordshire', null, '14 London Road'),
      { initialProps: { pc: 'SG19 1EX' } },
    );
    await waitFor(() => expect(result.current.isQuoting).toBe(false));
    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.refreshCount).toBe(1));
    await waitFor(() => expect(result.current.isQuoting).toBe(false));
    expect(getQuote).toHaveBeenCalledTimes(2);

    rerender({ pc: 'MK44 3QD' });
    await waitFor(() => expect(result.current.isQuoting).toBe(false));

    // One draft for the new address — a stale refresh must not add a second.
    expect(getQuote).toHaveBeenCalledTimes(3);
    expect(result.current.refreshCount).toBe(0);
  });
});
