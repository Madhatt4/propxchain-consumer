// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Which firm acts for each side, in plain lines under the stall line
 * (card 5de4b8d4). Read from the on-chain solicitor slots by
 * lib/dealConveyancers, so it shows the firm the moment it joins.
 */
import { Scale } from 'lucide-react';
import { conveyancerLines, type DealConveyancers } from '@/lib/dealConveyancers';
import type { DealSide } from '@/lib/dealAccess';

interface ConveyancersLineProps {
  conveyancers: DealConveyancers;
  dealSide: DealSide;
  hasBuyer: boolean;
  className?: string;
}

export function ConveyancersLine({ conveyancers, dealSide, hasBuyer, className = '' }: ConveyancersLineProps): JSX.Element | null {
  const lines = conveyancerLines(conveyancers, dealSide, hasBuyer);
  if (lines.length === 0) return null;
  return (
    <div data-testid="conveyancers-line" className={className}>
      {lines.map((line, i) => (
        <p key={line.side} className={`flex items-start gap-2 font-sans text-sm text-stone-700 dark:text-slate-300${i > 0 ? ' mt-1' : ''}`}>
          <Scale className={`mt-0.5 h-4 w-4 shrink-0 text-stone-400 dark:text-slate-500${i > 0 ? ' invisible' : ''}`} aria-hidden />
          <span>{line.text}</span>
        </p>
      ))}
    </div>
  );
}
