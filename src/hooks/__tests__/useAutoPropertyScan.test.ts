import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAutoPropertyScan, isValidUkPostcode } from '../useAutoPropertyScan';

describe('isValidUkPostcode', () => {
  it('should accept full UK postcodes with or without the space', () => {
    expect(isValidUkPostcode('SG19 1AX')).toBe(true);
    expect(isValidUkPostcode('sg191ax')).toBe(true);
    expect(isValidUkPostcode('EC1A 1BB')).toBe(true);
  });

  it('should reject outcodes, partials and junk', () => {
    expect(isValidUkPostcode('SG19')).toBe(false);
    expect(isValidUkPostcode('SG19 1')).toBe(false);
    expect(isValidUkPostcode('')).toBe(false);
    expect(isValidUkPostcode('not a postcode')).toBe(false);
  });
});

describe('useAutoPropertyScan', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('should fire once for a valid postcode after the debounce', () => {
    const onScan = vi.fn();
    renderHook(() => useAutoPropertyScan('SG19 1AX', onScan));
    expect(onScan).not.toHaveBeenCalled();
    vi.advanceTimersByTime(800);
    expect(onScan).toHaveBeenCalledTimes(1);
    expect(onScan.mock.calls[0][0]).toBe('SG19 1AX');
    expect(onScan.mock.calls[0][1]).toBeInstanceOf(AbortSignal);
  });

  it('should not fire for an invalid or partial postcode', () => {
    const onScan = vi.fn();
    renderHook(() => useAutoPropertyScan('SG19', onScan));
    vi.advanceTimersByTime(2000);
    expect(onScan).not.toHaveBeenCalled();
  });

  it('should not re-fire for the same postcode across re-renders', () => {
    const onScan = vi.fn();
    const { rerender } = renderHook(
      ({ pc }) => useAutoPropertyScan(pc, onScan),
      { initialProps: { pc: 'SG19 1AX' } },
    );
    vi.advanceTimersByTime(800);
    rerender({ pc: 'SG19 1AX' });
    vi.advanceTimersByTime(800);
    expect(onScan).toHaveBeenCalledTimes(1);
  });

  it('should abort the in-flight scan and re-fire when the postcode changes', () => {
    const onScan = vi.fn();
    const { rerender } = renderHook(
      ({ pc }) => useAutoPropertyScan(pc, onScan),
      { initialProps: { pc: 'SG19 1AX' } },
    );
    vi.advanceTimersByTime(800);
    const firstSignal = onScan.mock.calls[0][1] as AbortSignal;
    expect(firstSignal.aborted).toBe(false);

    rerender({ pc: 'SG18 0AA' });
    vi.advanceTimersByTime(800);
    expect(firstSignal.aborted).toBe(true);
    expect(onScan).toHaveBeenCalledTimes(2);
    expect(onScan.mock.calls[1][0]).toBe('SG18 0AA');
  });

  it('should debounce keystrokes — only the settled postcode fires', () => {
    const onScan = vi.fn();
    const { rerender } = renderHook(
      ({ pc }) => useAutoPropertyScan(pc, onScan),
      { initialProps: { pc: 'SG19 1A' } },
    );
    vi.advanceTimersByTime(400);
    rerender({ pc: 'SG19 1AX' });
    vi.advanceTimersByTime(799);
    expect(onScan).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onScan).toHaveBeenCalledTimes(1);
  });

  it('should never fire when disabled', () => {
    const onScan = vi.fn();
    renderHook(() => useAutoPropertyScan('SG19 1AX', onScan, { disabled: true }));
    vi.advanceTimersByTime(2000);
    expect(onScan).not.toHaveBeenCalled();
  });

  it('should abort the in-flight signal on unmount', () => {
    const onScan = vi.fn();
    const { unmount } = renderHook(() => useAutoPropertyScan('SG19 1AX', onScan));
    vi.advanceTimersByTime(800);
    const signal = onScan.mock.calls[0][1] as AbortSignal;
    unmount();
    expect(signal.aborted).toBe(true);
  });

  it('should abort the in-flight scan when the postcode becomes invalid', () => {
    const onScan = vi.fn();
    const { rerender } = renderHook(
      ({ pc }) => useAutoPropertyScan(pc, onScan),
      { initialProps: { pc: 'SG19 1AX' } },
    );
    vi.advanceTimersByTime(800);
    const signal = onScan.mock.calls[0][1] as AbortSignal;
    expect(signal.aborted).toBe(false);
    rerender({ pc: 'SG19' }); // backspaced to outcode — invalid
    expect(signal.aborted).toBe(true);
    expect(onScan).toHaveBeenCalledTimes(1);
  });
});
