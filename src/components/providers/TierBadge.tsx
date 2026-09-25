interface TierBadgeProps {
  tier: 1 | 2;
}

export function TierBadge({ tier }: TierBadgeProps): React.ReactElement {
  const isTier1 = tier === 1;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-geist-mono text-[10px] uppercase tracking-wider ${
        isTier1
          ? 'bg-teal-500/10 text-teal-600 dark:bg-teal-400/10 dark:text-teal-400'
          : 'bg-[#84A98C]/10 text-[#5F8A68] dark:bg-[#84A98C]/10 dark:text-[#9CB8A4]'
      }`}
    >
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${
          isTier1 ? 'bg-teal-500 dark:bg-teal-400' : 'bg-[#84A98C]'
        }`}
      />
      {isTier1 ? 'API Integrated' : 'Semi-Auto'}
    </span>
  );
}
