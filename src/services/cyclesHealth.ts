import { supabase } from '../lib/supabase';
import { logger } from '@/utils/logger';

// Default low-balance threshold per canister, in trillions of cycles.
// Mirrors the ops cron's notification threshold so the UI reflects the
// same boundary the topup workflow uses.
const DEFAULT_THRESHOLD_T = 0.5;

// Canisters never burn cycles negatively, but cron measurements can
// straddle a topup. A net-positive trend across the window is treated
// as "insufficient signal" rather than a negative burn rate.
const MIN_MEASUREMENTS_FOR_RATE = 2;

// Days-left thresholds for the traffic light. Match the cron's amber/red
// alerts in the monorepo's devops workflow.
const DAYS_LEFT_RED = 7;
const DAYS_LEFT_AMBER = 30;

export interface Measurement {
  measuredAt: Date;
  balanceT: number;
  balanceCycles: number;
}

export type HealthStatus = 'green' | 'amber' | 'red' | 'grey';

export interface CanisterHealth {
  canisterName: string;
  canisterId: string;
  currentBalanceT: number;
  burnRatePerDay: number | null;
  daysLeft: number | null;
  thresholdT: number;
  status: HealthStatus;
  history: Measurement[];
}

interface CyclesHistoryRow {
  measured_at: string;
  canister_name: string;
  canister_id: string;
  balance_cycles: string | number;
  balance_t: string | number;
}

export async function getCyclesHistory(
  canisterName?: string,
  days = 30,
): Promise<Measurement[] | Record<string, Measurement[]>> {
  const sinceIso = new Date(Date.now() - days * 86_400_000).toISOString();

  let query = supabase
    .schema('devops_board')
    .from('cycles_history')
    .select('measured_at, canister_name, canister_id, balance_cycles, balance_t')
    .gte('measured_at', sinceIso)
    .order('measured_at', { ascending: true });

  if (canisterName) {
    query = query.eq('canister_name', canisterName);
  }

  const { data, error } = await query;
  if (error) {
    logger.warn('cycles_history query failed', { message: error.message });
    throw new Error(error.message);
  }

  const rows = (data ?? []) as CyclesHistoryRow[];

  if (canisterName) {
    return rows.map(rowToMeasurement);
  }

  const grouped: Record<string, Measurement[]> = {};
  for (const row of rows) {
    const arr = grouped[row.canister_name] ?? (grouped[row.canister_name] = []);
    arr.push(rowToMeasurement(row));
  }
  return grouped;
}

export async function getCanisterMetadata(): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .schema('devops_board')
    .from('cycles_history')
    .select('canister_name, canister_id, measured_at')
    .order('measured_at', { ascending: false })
    .limit(500);

  if (error) {
    logger.warn('cycles_history metadata query failed', { message: error.message });
    return {};
  }

  const map: Record<string, string> = {};
  for (const row of (data ?? []) as CyclesHistoryRow[]) {
    if (!map[row.canister_name]) map[row.canister_name] = row.canister_id;
  }
  return map;
}

export function computeBurnRate(history: Measurement[], thresholdT = DEFAULT_THRESHOLD_T): {
  currentBalanceT: number;
  burnRatePerDay: number | null;
  daysLeft: number | null;
  status: HealthStatus;
} {
  if (history.length === 0) {
    return { currentBalanceT: 0, burnRatePerDay: null, daysLeft: null, status: 'grey' };
  }

  const newest = history[history.length - 1];
  const oldest = history[0];
  const currentBalanceT = newest.balanceT;

  if (history.length < MIN_MEASUREMENTS_FOR_RATE) {
    return {
      currentBalanceT,
      burnRatePerDay: null,
      daysLeft: null,
      status: currentBalanceT < thresholdT ? 'red' : 'grey',
    };
  }

  const millisBetween = newest.measuredAt.getTime() - oldest.measuredAt.getTime();
  const daysBetween = millisBetween / 86_400_000;

  if (daysBetween <= 0) {
    return { currentBalanceT, burnRatePerDay: null, daysLeft: null, status: 'grey' };
  }

  const burnRatePerDay = (oldest.balanceT - newest.balanceT) / daysBetween;

  if (burnRatePerDay <= 0) {
    return {
      currentBalanceT,
      burnRatePerDay: null,
      daysLeft: null,
      status: currentBalanceT < thresholdT ? 'red' : 'grey',
    };
  }

  const daysLeft = currentBalanceT / burnRatePerDay;

  let status: HealthStatus;
  if (currentBalanceT < thresholdT || daysLeft <= DAYS_LEFT_RED) {
    status = 'red';
  } else if (daysLeft <= DAYS_LEFT_AMBER) {
    status = 'amber';
  } else {
    status = 'green';
  }

  return { currentBalanceT, burnRatePerDay, daysLeft, status };
}

export async function getCanisterHealth(thresholdT = DEFAULT_THRESHOLD_T): Promise<CanisterHealth[]> {
  const grouped = (await getCyclesHistory()) as Record<string, Measurement[]>;
  const idMap = await getCanisterMetadata();

  return Object.entries(grouped)
    .map(([canisterName, history]) => {
      const computed = computeBurnRate(history, thresholdT);
      return {
        canisterName,
        canisterId: idMap[canisterName] ?? '',
        thresholdT,
        history,
        ...computed,
      };
    })
    .sort((a, b) => {
      const order: Record<HealthStatus, number> = { red: 0, amber: 1, grey: 2, green: 3 };
      return order[a.status] - order[b.status] || a.canisterName.localeCompare(b.canisterName);
    });
}

function rowToMeasurement(row: CyclesHistoryRow): Measurement {
  return {
    measuredAt: new Date(row.measured_at),
    balanceT: typeof row.balance_t === 'string' ? parseFloat(row.balance_t) : row.balance_t,
    balanceCycles: typeof row.balance_cycles === 'string' ? parseFloat(row.balance_cycles) : row.balance_cycles,
  };
}

export const CYCLES_HEALTH_CONSTANTS = {
  DEFAULT_THRESHOLD_T,
  DAYS_LEFT_RED,
  DAYS_LEFT_AMBER,
};
