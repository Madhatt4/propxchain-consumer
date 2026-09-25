import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useProviderPanel } from '../../hooks/useProviderPanel';

describe('useProviderPanel', () => {
  describe('compareIds', () => {
    it('should have empty compareIds initially', () => {
      const { result } = renderHook(() => useProviderPanel());
      expect(result.current.compareIds).toEqual([]);
    });

    it('should add a provider ID when toggleCompare is called', () => {
      const { result } = renderHook(() => useProviderPanel());

      act(() => {
        result.current.toggleCompare('provider-1');
      });

      expect(result.current.compareIds).toEqual(['provider-1']);
    });

    it('should create a pair when a second ID is toggled', () => {
      const { result } = renderHook(() => useProviderPanel());

      act(() => {
        result.current.toggleCompare('provider-1');
      });
      act(() => {
        result.current.toggleCompare('provider-2');
      });

      expect(result.current.compareIds).toEqual(['provider-1', 'provider-2']);
    });

    it('should reject a third ID when max 2 are already selected', () => {
      const { result } = renderHook(() => useProviderPanel());

      act(() => {
        result.current.toggleCompare('provider-1');
      });
      act(() => {
        result.current.toggleCompare('provider-2');
      });
      act(() => {
        result.current.toggleCompare('provider-3');
      });

      expect(result.current.compareIds).toEqual(['provider-1', 'provider-2']);
      expect(result.current.compareIds).toHaveLength(2);
    });

    it('should remove an existing ID and keep the other when toggled again', () => {
      const { result } = renderHook(() => useProviderPanel());

      act(() => {
        result.current.toggleCompare('provider-1');
      });
      act(() => {
        result.current.toggleCompare('provider-2');
      });
      act(() => {
        result.current.toggleCompare('provider-1');
      });

      expect(result.current.compareIds).toEqual(['provider-2']);
    });

    it('should empty the array when clearCompare is called', () => {
      const { result } = renderHook(() => useProviderPanel());

      act(() => {
        result.current.toggleCompare('provider-1');
      });
      act(() => {
        result.current.toggleCompare('provider-2');
      });
      act(() => {
        result.current.clearCompare();
      });

      expect(result.current.compareIds).toEqual([]);
    });
  });

  describe('isCompareActive', () => {
    it('should be true when exactly 2 providers are selected', () => {
      const { result } = renderHook(() => useProviderPanel());

      act(() => {
        result.current.toggleCompare('provider-1');
      });
      expect(result.current.isCompareActive).toBe(false);

      act(() => {
        result.current.toggleCompare('provider-2');
      });
      expect(result.current.isCompareActive).toBe(true);
    });
  });
});
