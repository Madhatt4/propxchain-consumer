// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Chip-style multi-input for plot type features.
 * Type text + Enter to add, click X to remove.
 */

import { useState } from 'react';
import { X } from 'lucide-react';

interface FeatureChipsProps {
  features: string[];
  onChange: (features: string[]) => void;
}

export default function FeatureChips({ features, onChange }: FeatureChipsProps): JSX.Element {
  const [inputValue, setInputValue] = useState('');

  const addFeature = (): void => {
    const trimmed = inputValue.trim();
    if (!trimmed || features.includes(trimmed)) return;
    onChange([...features, trimmed]);
    setInputValue('');
  };

  const removeFeature = (index: number): void => {
    onChange(features.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addFeature();
    }
  };

  return (
    <div>
      {features.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {features.map((feature, idx) => (
            <span
              key={feature}
              className="inline-flex items-center gap-1 rounded-full bg-[#84A98C]/20 px-3 py-1 font-[DM_Sans] text-sm text-[#5F8A68] dark:text-[#84A98C]"
            >
              {feature}
              <button
                type="button"
                onClick={() => removeFeature(idx)}
                className="ml-0.5 rounded-full p-0.5 hover:bg-[#84A98C]/30"
                aria-label={`Remove ${feature}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a feature and press Enter"
        className="w-full min-h-12 rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] px-3 py-2.5 font-[DM_Sans] text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:border-[#0D9488] focus:outline-none focus:ring-1 focus:ring-[#0D9488] dark:focus:border-[#0D9488]"
      />
    </div>
  );
}
