import { useState, type ReactNode } from 'react';

interface CollapsibleProviderCardProps {
  logo: string;
  name: string;
  tagline: string;
  turnaround: string;
  fromPricePence: number;
  badge?: string;
  defaultExpanded?: boolean;
  /** Optional PropXchain-style prefix shown above the provider name. */
  propxchainBranded?: boolean;
  /**
   * Keep the teal "recommended" border even when collapsed, so a featured
   * provider stays visually prominent in its small state.
   */
  highlighted?: boolean;
  children: ReactNode;
}

function pence(amount: number): string {
  return `£${(amount / 100).toFixed(2)}`;
}

export default function CollapsibleProviderCard({
  logo,
  name,
  tagline,
  turnaround,
  fromPricePence,
  badge,
  defaultExpanded = false,
  propxchainBranded = false,
  highlighted = false,
  children,
}: CollapsibleProviderCardProps): React.ReactElement {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div
      className={[
        'overflow-hidden rounded-xl border bg-white shadow-sm transition-colors dark:bg-[#0F1729]',
        expanded || highlighted
          ? 'border-[#0D9488]/40 dark:border-[#14B8A6]/30'
          : 'border-gray-200 hover:border-gray-300 dark:border-[#1E2A3A] dark:hover:border-[#2A3A52]',
      ].join(' ')}
    >
      {/* The collapsed rows are a comparison column, so they have to read as one
          set — but left to itself each one is a different height. A provider
          that quotes per property has no "inc VAT" line, which drops its price
          block below the 48px logo; a PropXchain-branded row carries an extra
          eyebrow above the name, which pushes it past both. Measured on the
          searches panel that is 86 / 82 / 91px, near enough to look like a
          mistake rather than a difference. A floor above the tallest of them
          settles all three at one height; it is a min, so nothing is clipped if
          a row ever needs more. */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex min-h-[92px] w-full items-center gap-4 px-6 py-4 text-left"
        aria-expanded={expanded}
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#0D9488]/10 dark:bg-[#14B8A6]/10">
          <span className="font-geist-mono text-base font-semibold text-[#0D9488] dark:text-[#14B8A6]">
            {logo}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          {propxchainBranded && (
            <p className="mb-0.5 font-geist-mono text-[10px] uppercase tracking-wider text-[#5F8A68] dark:text-[#9CB8A4]">
              PropXchain · {name}
            </p>
          )}
          <h3 className="font-dm-sans text-base font-semibold text-gray-900 dark:text-gray-100">
            {propxchainBranded ? `${name} bundles` : name}
          </h3>
          <p className="truncate text-xs text-gray-500 dark:text-gray-400">{tagline}</p>
        </div>

        {/* A provider priced per property has no "from" figure — tmGroup quote each
            address individually. Rendering pence(0) would head the card "from £0.00",
            which reads as free rather than as not-yet-known. */}
        <div className="hidden text-right md:block">
          <div className="font-geist-mono text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">
            {fromPricePence > 0 ? `from ${pence(fromPricePence)}` : 'Quoted per property'}
          </div>
          {fromPricePence > 0 && (
            <div className="text-[10px] text-gray-400 dark:text-gray-500">inc VAT</div>
          )}
          <div className="mt-0.5 font-geist-mono text-[10px] tabular-nums text-gray-500 dark:text-gray-400">
            {turnaround}
          </div>
        </div>

        {badge && (
          <span className="hidden shrink-0 rounded-full bg-[#84A98C]/15 px-2.5 py-0.5 text-xs font-medium text-[#5F8A68] dark:bg-[#9CB8A4]/10 dark:text-[#9CB8A4] md:inline-block">
            {badge}
          </span>
        )}

        <svg
          className={[
            'h-5 w-5 shrink-0 text-gray-400 transition-transform duration-200 dark:text-gray-500',
            expanded ? 'rotate-180' : '',
          ].join(' ')}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 px-6 py-5 dark:border-gray-700/50">
          {children}
        </div>
      )}
    </div>
  );
}
