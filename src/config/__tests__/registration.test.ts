import { describe, it, expect, vi, afterEach } from 'vitest';

/**
 * The bug this guards: VITE_MAINTENANCE_MODE gated the /register ROUTE from a
 * local const in App.tsx, so nothing that OFFERED registration could read it.
 * Login and pricing kept advertising sign-up while sign-up was closed.
 *
 * These assert the flag is derived from the same env var the route uses, so
 * the offer and the destination cannot drift apart again.
 */
async function loadFlag(value: string | undefined): Promise<boolean> {
  vi.resetModules();
  vi.stubEnv('VITE_MAINTENANCE_MODE', value as string);
  const mod = await import('../registration');
  return mod.IS_REGISTRATION_OPEN;
}

describe('IS_REGISTRATION_OPEN', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('should be closed when maintenance mode is on', async () => {
    expect(await loadFlag('true')).toBe(false);
  });

  it('should be open when maintenance mode is off', async () => {
    expect(await loadFlag('false')).toBe(true);
  });

  it('should be open when the variable is unset', async () => {
    // Default-open: a missing env var must not silently close sign-ups.
    expect(await loadFlag(undefined)).toBe(true);
  });

  it('should only treat the exact string "true" as maintenance mode', async () => {
    // Guards against 'TRUE' / '1' / 'yes' being read as on and closing
    // sign-ups by accident.
    expect(await loadFlag('TRUE')).toBe(true);
    expect(await loadFlag('1')).toBe(true);
  });
});

describe('PRELAUNCH_CAPTURE_PATH', () => {
  it('should point at the report section, the one open consumer path', async () => {
    const mod = await import('../registration');
    expect(mod.PRELAUNCH_CAPTURE_PATH).toBe('/#report');
  });
});
