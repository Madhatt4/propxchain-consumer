import { supabase } from '../lib/supabase';

const MATERIAL_BYTES = 32;
const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/derive-key-material`;

export class MaterialUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MaterialUnavailableError';
  }
}

/** Rate limited. NEVER treat as a decrypt failure — it is retry-later. */
export class MaterialRateLimitedError extends MaterialUnavailableError {
  constructor() {
    super('key material rate limited — retry later');
    this.name = 'MaterialRateLimitedError';
  }
}

interface CachedMaterial {
  material: Uint8Array;
  pepperVersion: number;
}

// Cached for the lifetime of the page load: one oracle call per load, not per
// operation. NEVER persisted to localStorage/IndexedDB — the material is a
// durable decrypt capability, unlike a JWT it does not expire.
//
// Keyed on `${userId}:${pepperVersion}` — NOT pepperVersion alone. This app
// switches accounts on a shared device without a page reload, so a
// pepperVersion-only key would serve user A's cached material to user B
// (silent key-at-rest corruption on B's next load). See PR #135 review.
const cache = new Map<string, CachedMaterial>();

function decodeBase64(input: string): Uint8Array {
  const binary = atob(input);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export const keyMaterialService = {
  /**
   * Fetch this user's HKDF material from the derive-key-material oracle.
   *
   * @param pepperVersion the version stamped on the blob being decrypted. Omit
   *   for a fresh encrypt (the server picks the current version and echoes it).
   *   Passing the blob's own version is what makes rotation safe.
   */
  async getMaterial(pepperVersion?: number): Promise<CachedMaterial> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new MaterialUnavailableError('no session — cannot derive key material');

    const userId = session.user.id;
    const cacheKey = `${userId}:${pepperVersion ?? 'current'}`;
    const hit = cache.get(cacheKey);
    if (hit) return hit;

    let response: Response;
    try {
      response = await fetch(FN_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(pepperVersion ? { pepperVersion } : {}),
      });
    } catch (networkError) {
      throw new MaterialUnavailableError(`key material oracle unreachable: ${networkError}`);
    }

    if (response.status === 429) throw new MaterialRateLimitedError();
    if (!response.ok) {
      throw new MaterialUnavailableError(`key material oracle returned ${response.status}`);
    }

    const body = (await response.json()) as { material?: string; pepperVersion?: number };
    if (!body.material || typeof body.pepperVersion !== 'number') {
      throw new MaterialUnavailableError('malformed key material response');
    }
    // Defence-in-depth: a specific version was requested (decrypting an
    // existing blob), so the oracle echoing a different one is a server bug,
    // not something to silently cache and decrypt against.
    if (pepperVersion && pepperVersion !== body.pepperVersion) {
      throw new MaterialUnavailableError(
        `oracle echoed pepper version ${body.pepperVersion}, expected ${pepperVersion}`,
      );
    }

    const material = decodeBase64(body.material);
    if (material.length !== MATERIAL_BYTES) {
      throw new MaterialUnavailableError(
        `key material is ${material.length} bytes, expected ${MATERIAL_BYTES}`,
      );
    }

    const result = { material, pepperVersion: body.pepperVersion };
    cache.set(cacheKey, result);
    cache.set(`${userId}:${body.pepperVersion}`, result);
    return result;
  },
};
