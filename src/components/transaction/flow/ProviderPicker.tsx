import { useState } from 'react';
import type { ReactNode } from 'react';
import type { ServiceProvider } from '../../../types/provider.types';
import { ProviderCard } from './ProviderCard';
import { CostTransparencyLine } from './CostTransparencyLine';

interface ProviderPickerProps {
  providers: ServiceProvider[];
  onSelect: (provider: ServiceProvider) => void;
  selectedProviderId?: string;
}

function sortProviders(providers: ServiceProvider[]): ServiceProvider[] {
  return [...providers].sort((a, b) => {
    if (b.averageRating !== a.averageRating) return b.averageRating - a.averageRating;
    return b.totalReviews - a.totalReviews;
  });
}

export function ProviderPicker({ providers, onSelect, selectedProviderId }: ProviderPickerProps): ReactNode {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const sorted = sortProviders(providers);
  const topRatedId = sorted.length > 0 ? sorted[0].id : null;
  const selectedProvider = selectedProviderId ? sorted.find(p => p.id === selectedProviderId) : undefined;

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <div>
          <p className="text-sm font-bold text-slate-100">Choose Your Provider</p>
          <p className="text-[10px] text-slate-500">Sorted by customer rating</p>
        </div>
        <span className="glass rounded-2xl px-3 py-1 text-[10px] text-teal-400 font-semibold">
          {sorted.length} provider{sorted.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Provider List */}
      <div className="flex flex-col gap-2.5">
        {sorted.map((provider) => (
          <ProviderCard
            key={provider.id}
            provider={provider}
            isTopRated={provider.id === topRatedId}
            isSelected={provider.id === selectedProviderId}
            isExpanded={provider.id === expandedId}
            onSelect={() => onSelect(provider)}
            onToggle={() => setExpandedId(expandedId === provider.id ? null : provider.id)}
          />
        ))}
      </div>

      {selectedProvider && (
        <div className="mt-3">
          <CostTransparencyLine
            costPence={selectedProvider.priceInPence}
            label={selectedProvider.category === 'searches' ? 'includes our small search margin' : undefined}
          />
        </div>
      )}
    </div>
  );
}
