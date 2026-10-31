/**
 * What the delivered searches say, shown to a firm preparing an estimate. The
 * shared scan's own words, one section per search: nothing here is a line to
 * price, and nothing is an enquiry.
 */
import {
  SEARCH_SUMMARY_HEADING,
  SEARCH_SUMMARY_NOTICE,
  SEARCH_SUMMARY_TRUNCATED_NOTICE,
  type SearchSummary,
} from '@/types/quoteScope.types';

export default function SearchSummaryBlock({ summary }: { summary: SearchSummary }): JSX.Element {
  return (
    <div className="mb-6">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
        {SEARCH_SUMMARY_HEADING}
      </h2>
      <p className="text-xs text-gray-500 dark:text-[#94A3B8] mb-4">{SEARCH_SUMMARY_NOTICE}</p>

      {summary.sections.map((section, idx) => (
        <div key={`${section.provider}-${idx}`} className="mb-5">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-[#CBD5E1] mb-2">{section.provider}</h3>
          {section.explainer && (
            <p className="whitespace-pre-line text-sm text-gray-600 dark:text-[#94A3B8]">{section.explainer}</p>
          )}
          {section.flags.length > 0 && (
            <ul className="mt-2 space-y-1">
              {section.flags.map((flag, flagIdx) => (
                <li key={flagIdx} className="border-l-2 border-teal-500 pl-3 py-2">
                  <p className="text-sm text-gray-800 dark:text-[#E5E7EB]">{flag.statement}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {[flag.searchName, flag.location].filter(Boolean).join(', ')}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}

      {summary.truncated && <p className="text-xs text-gray-500">{SEARCH_SUMMARY_TRUNCATED_NOTICE}</p>}
    </div>
  );
}
