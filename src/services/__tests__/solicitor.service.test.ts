import { describe, it, expect, beforeEach, vi } from 'vitest';
import { verifySolicitorCredentials } from '../solicitor.service';

describe('verifySolicitorCredentials', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should return verified result for valid SRA number', async () => {
    const mockResponse = {
      verified: true,
      name: 'Jane Smith',
      firm: 'Smith & Partners LLP',
      status: 'active',
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const result = await verifySolicitorCredentials('sra', '654321');

    expect(result.verified).toBe(true);
    expect(result.name).toBe('Jane Smith');
    expect(result.firm).toBe('Smith & Partners LLP');
    expect(fetch).toHaveBeenCalledWith(expect.any(String), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: 'sra', regNumber: '654321' }),
    });
  });

  it('should return not verified for invalid number', async () => {
    const mockResponse = {
      verified: false,
      name: '',
      firm: '',
      status: 'not_found',
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const result = await verifySolicitorCredentials('sra', '000000');

    expect(result.verified).toBe(false);
  });

  it('should throw on network error', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      statusText: 'Service Unavailable',
    });

    await expect(verifySolicitorCredentials('sra', '654321'))
      .rejects.toThrow('Verification failed: Service Unavailable');
  });
});
