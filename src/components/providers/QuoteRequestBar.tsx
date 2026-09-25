interface QuoteRequestBarProps {
  selectedCount: number;
  maxSelections: number;
  onRequestQuotes: () => void;
  isSubmitting: boolean;
}

export function QuoteRequestBar({
  selectedCount,
  maxSelections,
  onRequestQuotes,
  isSubmitting,
}: QuoteRequestBarProps): React.ReactElement | null {
  if (selectedCount === 0) return null;

  return (
    <div className="sticky bottom-0 flex items-center justify-between border-t border-[#1E2A3A] bg-white/95 px-5 py-3.5 shadow-lg backdrop-blur dark:border-[#1E2A3A] dark:bg-[#0E1425]/95">
      <p className="font-dm-sans text-sm text-gray-600 dark:text-gray-300">
        <span className="font-semibold text-gray-900 dark:text-gray-100">
          {selectedCount}
        </span>{' '}
        of {maxSelections} conveyancers selected
      </p>
      <button
        type="button"
        onClick={onRequestQuotes}
        disabled={isSubmitting}
        className="flex items-center gap-2 rounded-lg bg-[#0D9488] px-5 py-2 font-dm-sans text-sm font-medium text-white transition-colors hover:bg-[#0F766E] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? 'Sending…' : 'Request Quotes →'}
      </button>
    </div>
  );
}
