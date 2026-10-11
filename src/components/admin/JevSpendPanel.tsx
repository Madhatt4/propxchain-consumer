// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * JevSpendPanel — the running cost of the AI checks (Jev) on the admin
 * Budget tab: four totals (today, 7 days, 30 days, all time) and a per-
 * function table. Reads its own data; renders a quiet line when nothing is
 * readable rather than an error, since a non-admin simply sees no rows.
 */
import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  formatUsd,
  loadJevSpend,
  SPEND_WINDOW_LABELS,
  SPEND_WINDOWS,
} from '@/services/jevSpend.service';
import type { SpendSummary } from '@/services/jevSpend.service';

export function JevSpendPanel(): ReactElement {
  const [summary, setSummary] = useState<SpendSummary | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    void loadJevSpend().then((loaded) => {
      if (!cancelled) setSummary(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (summary === undefined) {
    return (
      <Card>
        <CardContent className="p-4">
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (summary === null || summary.functions.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <h3 className="font-medium">AI checks (Jev) spend</h3>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No Jev calls recorded yet, or spend is not readable from this account.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <section aria-label="AI checks spend" className="space-y-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {SPEND_WINDOWS.map((window) => {
          const t = summary.totals[window];
          return (
            <Card key={window}>
              <CardHeader className="pb-2">
                <h3 className="text-sm text-muted-foreground">Jev · {SPEND_WINDOW_LABELS[window]}</h3>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatUsd(t.costUsd)}</p>
                <p className="text-xs text-muted-foreground">
                  {t.calls.toLocaleString()} calls · {t.inputTokens.toLocaleString()} tokens
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <h3 className="font-medium">AI checks (Jev) by function</h3>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-1 pr-2 font-medium">Function</th>
                <th className="py-1 pr-2 text-right font-medium">Today</th>
                <th className="py-1 pr-2 text-right font-medium">30 days</th>
                <th className="py-1 pr-2 text-right font-medium">All time</th>
                <th className="py-1 text-right font-medium">Calls (all)</th>
              </tr>
            </thead>
            <tbody>
              {summary.functions.map((fn) => (
                <tr key={fn.fn} className="border-t border-border">
                  <td className="py-1.5 pr-2">
                    <span className="font-medium">{fn.label}</span>
                    <span className="ml-1.5 text-xs text-muted-foreground">{fn.fn}</span>
                  </td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{formatUsd(fn.windows.today?.costUsd ?? 0)}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{formatUsd(fn.windows['30d']?.costUsd ?? 0)}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{formatUsd(fn.windows.all?.costUsd ?? 0)}</td>
                  <td className="py-1.5 text-right tabular-nums">{(fn.windows.all?.calls ?? 0).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted-foreground">
            Estimated from tokens at TypeSafe&apos;s observed rate (about $0.037 per million), in US dollars. TypeSafe
            bills by token and does not return a charge per call; the console is the exact figure.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}

export default JevSpendPanel;
