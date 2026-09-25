import type { HighlightType } from './types';

interface HighlightBadgeProps {
  type: HighlightType;
}

const badgeStyles: Record<HighlightType, string> = {
  Recommended: 'bg-teal-500/90 text-white',
  'Best Value': 'bg-emerald-600/90 text-white',
  Fastest: 'bg-amber-500/90 text-white',
  'Top Rated': 'bg-[#D4A843]/90 text-white',
  Local: 'bg-[#84A98C]/90 text-white',
  'Local Expert': 'bg-[#84A98C]/90 text-white',
  Budget: 'bg-gray-500/90 text-white',
};

export function HighlightBadge({ type }: HighlightBadgeProps): React.ReactElement {
  return (
    <span
      className={`absolute -top-0 right-3 rounded-b-md px-2.5 py-1 font-dm-sans text-[11px] font-semibold tracking-wide shadow-sm ${badgeStyles[type]}`}
    >
      {type}
    </span>
  );
}
