// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * DocVisibilityChooser — the "Who can see this" dropdown on a personal wallet
 * document (Marc, 2026-11-09). Shows the preset the current grants amount to,
 * who can see the document by role, and — under Custom — the per-party
 * switches passed in as children. Choosing Custom changes nothing by itself.
 */
import { useState, type ReactNode } from 'react';
import type { DealSide, ShareParty } from '@/services/shareParty.service';
import {
  PRESET_LABELS,
  derivePreset,
  presetTargets,
  roleLabelsFor,
  type VisibilityPreset,
} from './visibilityPresets';

interface DocVisibilityChooserProps {
  docHash: string;
  parties: ShareParty[];
  mySide: DealSide | null;
  grantedPrincipals: string[];
  isBusy: boolean;
  onChoose: (preset: VisibilityPreset) => void;
  /** The per-party switches, shown under Custom. */
  children: ReactNode;
}

const ORDER: VisibilityPreset[] = ['nobody', 'my_conveyancer', 'other_side', 'estate_agent', 'everyone', 'custom'];

function isAvailable(preset: VisibilityPreset, parties: ShareParty[], mySide: DealSide | null): boolean {
  if (preset === 'nobody' || preset === 'custom') return true;
  const targets = presetTargets(preset, parties, mySide);
  return targets !== null && targets.length > 0;
}

export function DocVisibilityChooser({
  docHash,
  parties,
  mySide,
  grantedPrincipals,
  isBusy,
  onChoose,
  children,
}: DocVisibilityChooserProps): JSX.Element {
  const [isCustomOpen, setIsCustomOpen] = useState(false);
  const derived = derivePreset(grantedPrincipals, parties, mySide);
  const shown: VisibilityPreset = isCustomOpen ? 'custom' : derived;
  const viewers = roleLabelsFor(grantedPrincipals, parties);
  const selectId = `visibility-${docHash.slice(0, 12)}`;

  const handleChange = (value: VisibilityPreset): void => {
    setIsCustomOpen(value === 'custom');
    onChoose(value);
  };

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={selectId} className="text-xs font-medium text-foreground">
          Who can see this
        </label>
        <select
          id={selectId}
          value={shown}
          disabled={isBusy}
          onChange={(e) => handleChange(e.target.value as VisibilityPreset)}
          className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground disabled:opacity-50"
        >
          {ORDER.map((preset) => (
            <option key={preset} value={preset} disabled={!isAvailable(preset, parties, mySide)}>
              {PRESET_LABELS[preset]}
            </option>
          ))}
        </select>
      </div>
      <p className="text-[11px] text-muted-foreground" data-testid="visible-to">
        {viewers.length > 0 ? `Visible to: ${viewers.join(', ')}` : 'Visible to nobody on this deal'}
      </p>
      {shown === 'custom' && children}
    </div>
  );
}
