import type { ReactNode } from 'react';
import { Star } from 'lucide-react';
import type { ServiceProvider } from '../../../types/provider.types';

interface ProviderCardProps {
  provider: ServiceProvider;
  isTopRated: boolean;
  isSelected: boolean;
  isExpanded: boolean;
  onSelect: () => void;
  onToggle: () => void;
}

function formatTurnaround(minutes: number): string {
  if (minutes <= 0) return '';
  if (minutes < 60) return `~${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `~${hours} hr`;
  const days = Math.round(minutes / 1440);
  return `~${days} day${days !== 1 ? 's' : ''}`;
}

function StarRating({ rating, count }: { rating: number; count: number }): ReactNode {
  const filled = Math.round(rating);
  return (
    <span className="flex items-center gap-0.5 text-sm">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 fill-current ${i < filled ? 'text-yellow-400' : 'text-slate-700'}`}
          aria-hidden="true"
        />
      ))}
      <span className="ml-1.5 text-[10px] text-slate-500">{rating.toFixed(1)} ({count} reviews)</span>
    </span>
  );
}

export function ProviderCard({
  provider,
  isTopRated,
  isSelected,
  isExpanded,
  onSelect,
  onToggle,
}: ProviderCardProps): ReactNode {
  const priceFormatted = `£${(provider.priceInPence / 100).toFixed(2)}`;
  const turnaround = formatTurnaround(provider.averageTurnaroundMinutes);

  return (
    <div
      className={`glass rounded-xl p-4 cursor-pointer transition-all duration-200 relative overflow-hidden ${
        isSelected ? 'border-teal-500/30 glow-teal' : 'hover:bg-white/[0.06]'
      }`}
      onClick={onToggle}
      role="article"
    >
      {/* Top-rated accent bar */}
      {isTopRated && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-teal-500/60" />
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${
            isTopRated
              ? 'bg-green-500/15 border border-green-500/25 text-green-400'
              : 'bg-slate-700/10 border border-slate-700/15 text-slate-400'
          }`}>
            {provider.logoInitials}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span data-testid="provider-name" className="font-bold text-slate-100">{provider.name}</span>
              {isTopRated && (
                <span className="text-[9px] px-2 py-0.5 rounded-[10px] bg-green-500/12 border border-green-500/25 text-green-400 font-semibold">
                  TOP RATED
                </span>
              )}
              {isSelected && (
                <span className="text-[9px] px-2 py-0.5 rounded-[10px] bg-teal-500/12 border border-teal-500/25 text-teal-400 font-semibold">
                  SELECTED
                </span>
              )}
            </div>
            <StarRating rating={provider.averageRating} count={provider.totalReviews} />
            <p className="text-[10px] text-slate-500 mt-1">
              {provider.description.split('.')[0]} {turnaround && `· ${turnaround}`}
            </p>
          </div>
        </div>

        <div className="text-right shrink-0">
          <p className="text-lg font-extrabold text-slate-100">{priceFormatted}</p>
          <p className="text-[9px] text-slate-500">{provider.category === 'searches' ? 'includes our margin' : 'at cost'}</p>
        </div>
      </div>

      {isExpanded && (
        <p className="mt-2 text-sm text-slate-400">{provider.description}</p>
      )}

      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onSelect(); }}
        className={`mt-3 w-full py-2.5 px-4 rounded-[10px] text-sm font-bold transition-all duration-200 ${
          isTopRated
            ? 'bg-teal-600 hover:bg-teal-700 border border-teal-500/25 text-white shadow-sm'
            : 'glass text-slate-200 hover:bg-white/[0.08]'
        }`}
      >
        Select & Pay {priceFormatted}
      </button>
      <p className="text-center text-[9px] text-green-400 mt-1.5">
        {provider.category === 'searches'
          ? 'PropXchain makes a small margin on searches'
          : 'Zero PropXchain markup'}
      </p>
    </div>
  );
}
