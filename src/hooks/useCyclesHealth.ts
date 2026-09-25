import { useCallback, useEffect, useRef, useState } from 'react';
import { icpService } from '../services/icp.service';
import { supabase } from '../lib/supabase';
import { logger } from '@/utils/logger';
import {
  computeBurnRate,
  getCanisterHealth,
  type CanisterHealth,
  type Measurement,
} from '../services/cyclesHealth';

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

interface UseCyclesHealthReturn {
  healthByCanister: Record<string, CanisterHealth>;
  list: CanisterHealth[];
  loading: boolean;
  error: string | null;
  lastRefreshed: Date | null;
  refresh: () => Promise<void>;
  liveRefresh: () => Promise<void>;
}

interface LiveBalance {
  canisterName: string;
  canisterId: string;
  cycles: bigint;
  error?: string;
}

// Wraps icp.service.getAllCanisterCycles into a flat array, ignoring entries
// without a canister id (frontend asset canister has no getCycles).
async function fetchLiveBalances(): Promise<LiveBalance[]> {
  const raw = await icpService.getAllCanisterCycles();
  return Object.entries(raw)
    .filter(([, v]) => Boolean(v.canisterId) && !v.error)
    .map(([canisterName, v]) => ({
      canisterName,
      canisterId: v.canisterId,
      cycles: v.cycles,
      error: v.error,
    }));
}

// Persist measurements via the SECURITY DEFINER RPC in the devops_board schema.
// Failures are logged but never thrown — UI must update even if write fails.
async function persistMeasurements(balances: LiveBalance[]): Promise<void> {
  await Promise.all(
    balances.map(async (b) => {
      const balanceCycles = Number(b.cycles);
      const balanceT = balanceCycles / 1_000_000_000_000;
      const { error } = await supabase
        .schema('devops_board')
        .rpc('record_cycle_balance', {
          p_canister_name: b.canisterName,
          p_canister_id: b.canisterId,
          p_balance_cycles: balanceCycles,
          p_balance_t: balanceT,
        });
      if (error) {
        logger.warn('record_cycle_balance failed', {
          canister: b.canisterName,
          message: error.message,
        });
      }
    }),
  );
}

// Patches an existing list with live measurements: appends a fresh point to
// the canister's history and recomputes burn rate / status. Canisters not in
// the prior list are added with a single-point history.
function applyLiveBalances(
  prior: CanisterHealth[],
  balances: LiveBalance[],
  measuredAt: Date,
): CanisterHealth[] {
  const priorByName = new Map(prior.map((c) => [c.canisterName, c]));
  const seen = new Set<string>();

  const updated: CanisterHealth[] = balances.map((b) => {
    seen.add(b.canisterName);
    const existing = priorByName.get(b.canisterName);
    const balanceCycles = Number(b.cycles);
    const balanceT = balanceCycles / 1_000_000_000_000;
    const point: Measurement = { measuredAt, balanceCycles, balanceT };
    const history = existing ? [...existing.history, point] : [point];
    const thresholdT = existing?.thresholdT ?? 0.5;
    const computed = computeBurnRate(history, thresholdT);
    return {
      canisterName: b.canisterName,
      canisterId: b.canisterId,
      thresholdT,
      history,
      ...computed,
    };
  });

  // Keep canisters that exist in prior history but weren't returned live —
  // unchanged so the user can still see them, just stale.
  const carried = prior.filter((c) => !seen.has(c.canisterName));
  const combined = [...updated, ...carried];

  const order: Record<CanisterHealth['status'], number> = {
    red: 0,
    amber: 1,
    grey: 2,
    green: 3,
  };
  return combined.sort(
    (a, b) =>
      order[a.status] - order[b.status] ||
      a.canisterName.localeCompare(b.canisterName),
  );
}

export function useCyclesHealth(): UseCyclesHealthReturn {
  const [list, setList] = useState<CanisterHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const isMountedRef = useRef(true);

  const refresh = useCallback(async (): Promise<void> => {
    setError(null);
    try {
      const result = await getCanisterHealth();
      if (!isMountedRef.current) return;
      setList(result);
      setLastRefreshed(new Date());
    } catch (err) {
      if (!isMountedRef.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load cycle history');
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, []);

  const liveRefresh = useCallback(async (): Promise<void> => {
    setError(null);
    setLoading(true);
    try {
      const balances = await fetchLiveBalances();
      if (!isMountedRef.current) return;
      const measuredAt = new Date();
      setList((prev) => applyLiveBalances(prev, balances, measuredAt));
      setLastRefreshed(measuredAt);
      // Fire-and-forget persistence — UI is already updated above.
      void persistMeasurements(balances).catch((err) => {
        logger.warn('persistMeasurements failed', { message: String(err) });
      });
    } catch (err) {
      if (!isMountedRef.current) return;
      setError(err instanceof Error ? err.message : 'Failed to query canisters');
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    void refresh();
    const id = window.setInterval(() => { void refresh(); }, REFRESH_INTERVAL_MS);
    return () => {
      isMountedRef.current = false;
      window.clearInterval(id);
    };
  }, [refresh]);

  const healthByCanister = list.reduce<Record<string, CanisterHealth>>((acc, h) => {
    acc[h.canisterName] = h;
    return acc;
  }, {});

  return { healthByCanister, list, loading, error, lastRefreshed, refresh, liveRefresh };
}
