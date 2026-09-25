// PropXchain - Open Source Blockchain Property Conveyancing Platform
// Copyright (C) 2026 PropXchain Contributors
// SPDX-License-Identifier: Proprietary

/**
 * The SEPARATE "for your conveyancer" list — items needing legal attention,
 * kept visually distinct from the plain-English explainer so a seller/buyer
 * knows these are for their solicitor, not action points for them.
 */
import { Scale } from 'lucide-react';

export function ConveyancerFlags({ flags }: { flags: string[] }): JSX.Element | null {
  if (flags.length === 0) return null;
  return (
    <div className="rounded-lg border border-warning/40 bg-warning/5 p-4">
      <div className="mb-2 flex items-center gap-2">
        <Scale className="h-4 w-4 text-warning" />
        <span className="text-sm font-semibold text-foreground">For your conveyancer</span>
      </div>
      <ul className="list-disc space-y-1 pl-5">
        {flags.map((flag, i) => (
          <li key={i} className="text-sm text-foreground/90">
            {flag}
          </li>
        ))}
      </ul>
    </div>
  );
}
