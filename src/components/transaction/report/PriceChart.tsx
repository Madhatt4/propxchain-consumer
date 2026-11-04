// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Sold prices on the postcode as dots over time. Lazy-loaded from
 * PricesSection so Recharts stays out of every page that has no report.
 * Dots, not a line: the sales mix property types, so a line would invent a
 * trend the data does not show.
 */

import type { ReactElement } from 'react';
import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts';

import type { PriceSale } from '../../../services/propertyIntelligenceService';

interface Point {
  t: number;
  amount: number;
  label: string;
  latest: boolean;
}

const GBP = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 });

function compactGBP(v: number): string {
  if (v >= 1_000_000) return `£${(v / 1_000_000).toFixed(v % 1_000_000 === 0 ? 0 : 1)}m`;
  return `£${Math.round(v / 1000)}k`;
}

function toPoints(sales: PriceSale[]): Point[] {
  const sorted = [...sales].sort((a, b) => b.date.localeCompare(a.date));
  return sorted.map((s, i) => ({
    t: new Date(s.date).getTime(),
    amount: s.amount,
    label: `${new Date(s.date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}${s.propertyType ? `, ${s.propertyType === 'otherPropertyType' ? 'other' : s.propertyType.replace(/-/g, ' ')}` : ''}: ${GBP.format(s.amount)}`,
    latest: i === 0,
  }));
}

function Dot(props: { cx?: number; cy?: number; payload?: Point }): ReactElement {
  const { cx = 0, cy = 0, payload } = props;
  return payload?.latest ? <circle cx={cx} cy={cy} r={6} fill="#0D9488" /> : <circle cx={cx} cy={cy} r={4.5} fill="#84A98C" fillOpacity={0.85} />;
}

export default function PriceChart({ sales }: { sales: PriceSale[] }): ReactElement {
  const points = toPoints(sales);
  const years = points.map((p) => new Date(p.t).getFullYear());
  const from = Math.min(...years);
  const to = Math.max(...years);
  const ticks: number[] = [];
  const step = to - from > 15 ? 5 : to - from > 6 ? 2 : 1;
  for (let y = Math.ceil(from / step) * step; y <= to; y += step) ticks.push(new Date(`${y}-01-01`).getTime());

  return (
    <div className="h-64 w-full" role="img" aria-label={`Sold prices on this postcode, ${points.length} sales from ${from} to ${to}`}>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 12, right: 16, bottom: 4, left: 4 }}>
          <CartesianGrid stroke="#DAE5DC" vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            domain={['dataMin', 'dataMax']}
            ticks={ticks}
            tickFormatter={(t: number) => String(new Date(t).getFullYear())}
            tick={{ fill: '#6B7280', fontSize: 12, fontFamily: 'Geist Mono, ui-monospace, monospace' }}
            axisLine={{ stroke: '#DAE5DC' }}
            tickLine={false}
          />
          <YAxis
            dataKey="amount"
            type="number"
            tickFormatter={compactGBP}
            tick={{ fill: '#6B7280', fontSize: 12, fontFamily: 'Geist Mono, ui-monospace, monospace' }}
            axisLine={false}
            tickLine={false}
            width={56}
          />
          <Tooltip
            cursor={{ stroke: '#84A98C', strokeDasharray: '3 3' }}
            content={({ payload }) => {
              const p = payload?.[0]?.payload as Point | undefined;
              return p ? <div className="rounded-md border border-[#DAE5DC] bg-white px-2.5 py-1.5 font-[DM_Sans] text-[13px] text-[#1A1A1A] shadow-sm">{p.label}</div> : null;
            }}
          />
          <Scatter data={points} shape={<Dot />} isAnimationActive={false} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
