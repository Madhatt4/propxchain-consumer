/**
 * CanistersTable
 *
 * Unified canister health table that joins two data sources in a single view:
 *  - Snapshot data (cycles, memory, freezing threshold) from the `canisters` prop
 *    (CanisterCycleInfo[], fed by useAdminDashboard → ICP canister query).
 *  - Time-series data (burn rate, runway, sparkline) from useCyclesHealth()
 *    (Supabase devops_board.cycles_history, polled every 24h by cron).
 *
 * Join key: CanisterCycleInfo.name === CanisterHealth.canisterName (case-sensitive).
 * Canisters present in only one source still render; missing columns show "—".
 *
 * Dialogs are in CanistersTableDialogs.tsx to keep this file under 300 lines.
 */
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Copy, RefreshCw, Shield, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { useThemeClasses } from '../../hooks/useThemeClasses';
import { useCyclesHealth } from '../../hooks/useCyclesHealth';
import type { CanisterCycleInfo } from '../../types/adminDashboard.types';
import type { CanisterHealth, Measurement, HealthStatus } from '../../services/cyclesHealth';
import {
  TopUpDialog,
  FreezingThresholdDialog,
  formatCanisterName,
  formatFreezingThreshold,
  type TopUpDialogState,
  type FreezingThresholdDialogState,
} from './CanistersTableDialogs';

// ── Cycles wallet footer (verbatim from CyclesHealthTable) ───────────────────

const CYCLES_WALLET_ID = 'lqmd6-yiaaa-aaaaa-qcwuq-cai';
const CYCLES_WALLET_FUND_CMD =
  `dfx ledger --network ic top-up ${CYCLES_WALLET_ID} \\\n  --amount <ICP> --identity Propxchain`;

// ── Snapshot formatters (verbatim from CanisterHealthPanel) ──────────────────

function formatCycles(cycles: bigint): string {
  const n = Number(cycles);
  // 2 dp at T-scale: a balance of 2.954T must not round up to "3.0T" and
  // mask a sub-threshold canister.
  if (n >= 1_000_000_000_000) return `${(n / 1_000_000_000_000).toFixed(2)}T`;
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  return n.toLocaleString();
}

function formatBytes(bytes: bigint): string {
  const n = Number(bytes);
  if (n >= 1_073_741_824) return `${(n / 1_073_741_824).toFixed(1)} GiB`;
  if (n >= 1_048_576) return `${(n / 1_048_576).toFixed(1)} MiB`;
  if (n >= 1_024) return `${(n / 1_024).toFixed(1)} KiB`;
  return `${n} B`;
}

// ── Time-series formatters (verbatim from CyclesHealthTable) ─────────────────

function formatT(value: number): string {
  if (value >= 100) return value.toFixed(0);
  if (value >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

function formatDays(days: number | null): string {
  if (days == null) return '—';
  if (days >= 365) return `${(days / 365).toFixed(1)}y`;
  if (days >= 30) return `${(days / 30).toFixed(1)}mo`;
  if (days >= 1) return `${days.toFixed(0)}d`;
  return `${(days * 24).toFixed(1)}h`;
}

function formatBurnRate(rate: number | null): string {
  if (rate == null) return '—';
  return `${formatT(rate)} T/day`;
}

function formatRelativeTime(date: Date | null): string {
  if (!date) return '—';
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)} h ago`;
  return `${Math.floor(seconds / 86_400)} d ago`;
}

// ── Sparkline (verbatim from CyclesHealthTable) ──────────────────────────────

interface SparklineProps {
  history: Measurement[];
  status: HealthStatus;
  width?: number;
  height?: number;
}

const Sparkline: React.FC<SparklineProps> = ({ history, status, width = 100, height = 28 }) => {
  if (history.length < 2) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const values = history.map(m => m.balanceT);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = history.map((m, i) => {
    const x = (i / (history.length - 1)) * width;
    const y = height - ((m.balanceT - min) / range) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const strokeColor: Record<HealthStatus, string> = {
    green: 'stroke-green-500',
    amber: 'stroke-amber-500',
    red: 'stroke-red-500',
    grey: 'stroke-gray-400',
  };
  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline fill="none" strokeWidth={1.5} className={strokeColor[status]} points={points} />
    </svg>
  );
};

// ── Snapshot health → dot colour (CanisterCycleInfo.health) ─────────────────

const snapshotDot: Record<string, string> = {
  green: 'bg-green-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  unknown: 'bg-gray-400',
};

const snapshotBadgeVariant: Record<string, 'success' | 'warning' | 'destructive' | 'outline'> = {
  green: 'success',
  amber: 'warning',
  red: 'destructive',
  unknown: 'outline',
};

// ── Props ────────────────────────────────────────────────────────────────────

export interface CanistersTableProps {
  canisters: CanisterCycleInfo[];
  isLoading: boolean;
  error?: string;
  onSetFreezingThreshold?: (canisterId: string, thresholdSeconds: number) => Promise<void>;
}

// ── Component ────────────────────────────────────────────────────────────────

export const CanistersTable: React.FC<CanistersTableProps> = ({
  canisters,
  isLoading,
  error,
  onSetFreezingThreshold,
}) => {
  const themeClasses = useThemeClasses();
  const { list: tsList, loading: tsLoading, error: tsError, lastRefreshed, liveRefresh } = useCyclesHealth();

  // Dialog state (relocated verbatim from CanisterHealthPanel)
  const [topUpDialog, setTopUpDialog] = useState<TopUpDialogState | null>(null);
  const [topUpAmount, setTopUpAmount] = useState('1');
  const [thresholdDialog, setThresholdDialog] = useState<FreezingThresholdDialogState | null>(null);
  const [thresholdInput, setThresholdInput] = useState('');
  const [isActing, setIsActing] = useState(false);

  // Build a lookup from canisterName → CanisterHealth for O(1) join
  const tsMap = new Map<string, CanisterHealth>(tsList.map(h => [h.canisterName, h]));

  // Build the unified row list by outer-joining both sources on name.
  // Names appearing only in time-series are appended after snapshot names.
  const snapshotNames = new Set(canisters.map(c => c.name));
  const tsOnlyRows: CanisterHealth[] = tsList.filter(h => !snapshotNames.has(h.canisterName));

  // Sort snapshot rows: red/amber first (mirrors old CanisterHealthPanel sort)
  const sortOrder: Record<string, number> = { red: 0, amber: 1, unknown: 2, green: 3 };
  const sortedSnapshot = [...canisters].sort(
    (a, b) => (sortOrder[a.health] ?? 2) - (sortOrder[b.health] ?? 2),
  );

  const handleSetThreshold = async (canisterId: string): Promise<void> => {
    setIsActing(true);
    try {
      const days = parseInt(thresholdInput, 10);
      if (isNaN(days) || days <= 0) {
        toast({ description: 'Please enter a valid number of days', variant: 'destructive' });
        return;
      }
      await onSetFreezingThreshold?.(canisterId, days * 86_400);
      toast({ description: `Freezing threshold set to ${days} days` });
      setThresholdDialog(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update threshold';
      toast({ description: msg, variant: 'destructive' });
    } finally {
      setIsActing(false);
    }
  };

  const copyToClipboard = (text: string, label: string): void => {
    navigator.clipboard.writeText(text);
    toast({ description: `${label} copied to clipboard` });
  };

  // ── Loading skeleton ───────────────────────────────────────────────────────

  if (isLoading && canisters.length === 0) {
    return (
      <Card className={cn(themeClasses.cardBg)}>
        <CardContent className="p-6 space-y-2">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </CardContent>
      </Card>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────

  if (error && canisters.length === 0) {
    return (
      <Card className="border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800">
        <CardContent className="p-6 text-center">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </CardContent>
      </Card>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────

  return (
    <>
      <Card className={cn(themeClasses.cardBg)}>
        <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className={cn('text-base', themeClasses.headerText)}>Canister Health</CardTitle>
            <p className={cn('text-xs mt-1', themeClasses.textSecondary)}>
              Snapshot from ICP · burn-rate from devops_board.cycles_history (cron every 24h)
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={cn('text-xs', themeClasses.textSecondary)}>
              Last refreshed: {formatRelativeTime(lastRefreshed)}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { void liveRefresh(); }}
              disabled={tsLoading}
              className="gap-1"
              title="Query each canister's getCycles() and persist a fresh measurement"
            >
              <RefreshCw className={cn('h-3 w-3', tsLoading && 'animate-spin')} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Cycles wallet footer (verbatim from CyclesHealthTable) */}
          <div className="rounded-md border border-border/50 bg-muted/30 p-3 mb-3 space-y-2">
            <div className="flex items-center gap-2">
              <Wallet className={cn('h-3.5 w-3.5', themeClasses.textSecondary)} />
              <span className={cn('text-xs font-medium', themeClasses.textSecondary)}>
                Cycles wallet:
              </span>
              <code className="text-xs font-mono">{CYCLES_WALLET_ID}</code>
              <button
                type="button"
                onClick={() => copyToClipboard(CYCLES_WALLET_ID, 'Cycles wallet ID')}
                className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                title="Copy wallet ID"
              >
                <Copy className="h-3 w-3" />
              </button>
            </div>
            <div>
              <p className={cn('text-[11px] mb-1', themeClasses.textSecondary)}>
                Fund this wallet from ICP ledger:
              </p>
              <pre className="text-[11px] font-mono bg-background/60 border border-border/50 rounded px-2 py-1.5 whitespace-pre-wrap break-all leading-relaxed">
{CYCLES_WALLET_FUND_CMD}
              </pre>
            </div>
          </div>

          {/* Non-fatal time-series fetch error */}
          {tsError && (
            <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-3 mb-3 text-sm text-amber-700 dark:text-amber-300">
              Cycle history unavailable: {tsError}
            </div>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Canister</TableHead>
                <TableHead>Health</TableHead>
                <TableHead className="text-right">Cycles</TableHead>
                <TableHead className="text-right">Memory</TableHead>
                <TableHead>Freezing threshold</TableHead>
                <TableHead className="text-right">Burn/day</TableHead>
                <TableHead className="text-right">Runway</TableHead>
                <TableHead>Trend (30d)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Snapshot-led rows (with optional time-series join) */}
              {sortedSnapshot.map(c => {
                const ts = tsMap.get(c.name);
                return (
                  <TableRow key={c.name}>
                    {/* Canister name + ID */}
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span>{formatCanisterName(c.name)}</span>
                        <button
                          onClick={() => copyToClipboard(c.canisterId, 'Canister ID')}
                          className="text-[10px] text-muted-foreground hover:text-foreground font-mono cursor-pointer text-left"
                          title="Click to copy"
                        >
                          {c.canisterId}
                        </button>
                      </div>
                    </TableCell>
                    {/* Health dot + badge */}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className={cn('w-2.5 h-2.5 rounded-full', snapshotDot[c.health] ?? 'bg-gray-400')} />
                        <Badge variant={snapshotBadgeVariant[c.health] ?? 'outline'} className="text-[10px] px-1.5 py-0 h-4">
                          {c.health}
                        </Badge>
                      </div>
                    </TableCell>
                    {/* Cycles balance */}
                    <TableCell className="text-right font-mono text-sm">
                      <div className="flex items-center justify-end gap-1">
                        <span>{c.error ? 'Unknown' : formatCycles(c.cycles)}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0"
                          title="Top up"
                          onClick={() => setTopUpDialog({ name: c.name, canisterId: c.canisterId })}
                        >
                          <RefreshCw className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    {/* Memory */}
                    <TableCell className="text-right font-mono text-sm text-muted-foreground">
                      {c.memorySize != null ? formatBytes(c.memorySize) : '—'}
                    </TableCell>
                    {/* Freezing threshold */}
                    <TableCell>
                      {c.freezingThreshold != null ? (
                        <div className="flex items-center gap-1.5">
                          <Shield className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs">{formatFreezingThreshold(c.freezingThreshold)}</span>
                          {onSetFreezingThreshold && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 text-xs px-1"
                              onClick={() => {
                                setThresholdInput(String(Math.round(c.freezingThreshold! / 86_400)));
                                setThresholdDialog({
                                  name: c.name,
                                  canisterId: c.canisterId,
                                  currentSeconds: c.freezingThreshold!,
                                });
                              }}
                            >
                              Edit
                            </Button>
                          )}
                        </div>
                      ) : '—'}
                    </TableCell>
                    {/* Time-series: burn rate */}
                    <TableCell className="text-right font-mono text-sm">
                      {ts ? formatBurnRate(ts.burnRatePerDay) : '—'}
                    </TableCell>
                    {/* Time-series: runway */}
                    <TableCell className="text-right font-mono text-sm">
                      {ts ? formatDays(ts.daysLeft) : '—'}
                    </TableCell>
                    {/* Time-series: sparkline */}
                    <TableCell>
                      {ts ? <Sparkline history={ts.history} status={ts.status} /> : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                  </TableRow>
                );
              })}

              {/* Time-series-only rows (no snapshot data yet) */}
              {tsOnlyRows.map(ts => (
                <TableRow key={ts.canisterName}>
                  <TableCell className="font-medium">
                    <div className="flex flex-col">
                      <span>{formatCanisterName(ts.canisterName)}</span>
                      {ts.canisterId && (
                        <button
                          onClick={() => copyToClipboard(ts.canisterId, 'Canister ID')}
                          className="text-[10px] text-muted-foreground hover:text-foreground font-mono cursor-pointer text-left"
                          title="Click to copy"
                        >
                          {ts.canisterId}
                        </button>
                      )}
                    </div>
                  </TableCell>
                  {/* Health from time-series status (grey maps to unknown visually) */}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className={cn('w-2.5 h-2.5 rounded-full', snapshotDot[ts.status] ?? 'bg-gray-400')} />
                      <Badge variant={snapshotBadgeVariant[ts.status] ?? 'outline'} className="text-[10px] px-1.5 py-0 h-4">
                        {ts.status}
                      </Badge>
                    </div>
                  </TableCell>
                  {/* No snapshot data */}
                  <TableCell className="text-right text-muted-foreground text-sm">—</TableCell>
                  <TableCell className="text-right text-muted-foreground text-sm">—</TableCell>
                  <TableCell className="text-muted-foreground text-sm">—</TableCell>
                  {/* Time-series columns */}
                  <TableCell className="text-right font-mono text-sm">{formatBurnRate(ts.burnRatePerDay)}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{formatDays(ts.daysLeft)}</TableCell>
                  <TableCell><Sparkline history={ts.history} status={ts.status} /></TableCell>
                </TableRow>
              ))}

              {/* Empty state */}
              {sortedSnapshot.length === 0 && tsOnlyRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-6 text-sm text-muted-foreground">
                    No canister data available.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <TopUpDialog
        dialog={topUpDialog}
        topUpAmount={topUpAmount}
        onAmountChange={setTopUpAmount}
        onClose={() => setTopUpDialog(null)}
      />
      <FreezingThresholdDialog
        dialog={thresholdDialog}
        thresholdInput={thresholdInput}
        isActing={isActing}
        onInputChange={setThresholdInput}
        onConfirm={handleSetThreshold}
        onClose={() => setThresholdDialog(null)}
      />
    </>
  );
};
