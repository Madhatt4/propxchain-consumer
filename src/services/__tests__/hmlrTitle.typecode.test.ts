import { describe, it, expect, vi } from 'vitest';
import { classifyTypeCode, HmlrTypeCode } from '../hmlrTitle.service';

// hmlrTitle.service imports the supabase client at module load, which throws
// without env vars. Stub it so the pure classifier can be imported in isolation.
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: { getUser: vi.fn(), getSession: vi.fn() },
    storage: { from: vi.fn() },
  },
}));

describe('classifyTypeCode', () => {
  it('should treat TypeCode 30 as deliverable register data', () => {
    expect(classifyTypeCode(HmlrTypeCode.SUCCESS)).toEqual({ deliverable: true });
  });

  it('should flag TypeCode 20 as cannot-deliver (paper-only) with a 200 status', () => {
    const outcome = classifyTypeCode(HmlrTypeCode.CANNOT_DELIVER);
    expect(outcome.deliverable).toBe(false);
    if (!outcome.deliverable) {
      expect(outcome.cause).toBe('hmlr_cannot_deliver');
      expect(outcome.status).toBe(200);
      expect(outcome.message).toMatch(/Official Copy|electronically/i);
    }
  });

  it('should flag TypeCode 10 as queued (out-of-hours) with a 200 status', () => {
    const outcome = classifyTypeCode(HmlrTypeCode.QUEUED);
    expect(outcome.deliverable).toBe(false);
    if (!outcome.deliverable) {
      expect(outcome.cause).toBe('hmlr_queued');
      expect(outcome.status).toBe(200);
      expect(outcome.message).toMatch(/try again|unavailable/i);
    }
  });

  it('should treat an absent TypeCode (0) as unavailable with a 502 status', () => {
    const outcome = classifyTypeCode(HmlrTypeCode.ABSENT);
    expect(outcome.deliverable).toBe(false);
    if (!outcome.deliverable) {
      expect(outcome.cause).toBe('hmlr_unavailable');
      expect(outcome.status).toBe(502);
    }
  });

  it('should treat any unrecognised TypeCode as unavailable and name it in the message', () => {
    const outcome = classifyTypeCode(99);
    expect(outcome.deliverable).toBe(false);
    if (!outcome.deliverable) {
      expect(outcome.cause).toBe('hmlr_unavailable');
      expect(outcome.message).toContain('99');
    }
  });
});
