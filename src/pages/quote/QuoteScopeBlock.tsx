/**
 * Read-only pre-identified scope of work, rendered above the conveyancer's own
 * price fields on /quote/:token.
 *
 * No prices: PropXchain itemises the work, the conveyancer prices every line.
 * Provenance is shown on every item because a checkable claim carries weight and
 * a bare assertion does not.
 */
import type { QuoteScope, ScopeItem } from '@/types/quoteScope.types';

interface QuoteScopeBlockProps {
  scope: QuoteScope | null;
}

const GROUPS: ReadonlyArray<{ category: ScopeItem['category']; heading: string }> = [
  { category: 'supplement', heading: 'Supplements' },
  { category: 'enquiry', heading: 'Enquiries' },
  { category: 'task', heading: 'Tasks' },
];

function ScopeRow({ item }: { item: ScopeItem }): JSX.Element {
  return (
    <li className="border-l-2 border-teal-500 pl-3 py-2">
      <p className="text-sm font-medium text-gray-800">{item.title}</p>
      <p className="text-sm text-gray-600 mt-0.5">{item.detail}</p>
      <p className="text-xs text-gray-400 mt-1">
        {item.trigger} — {item.provenance}
        {item.confidence !== 'high' ? ` (${item.confidence} confidence)` : ''}
      </p>
    </li>
  );
}

export default function QuoteScopeBlock({ scope }: QuoteScopeBlockProps): JSX.Element | null {
  if (!scope) return null;

  return (
    <div className="mb-8">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
        Pre-identified Scope
      </h2>

      {scope.items.length === 0 ? (
        <p className="text-sm text-gray-500">
          No scope items were identified automatically for this file.
        </p>
      ) : (
        GROUPS.map(({ category, heading }) => {
          const items = scope.items.filter((i) => i.category === category);
          if (items.length === 0) return null;
          return (
            <div key={category} className="mb-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">{heading}</h3>
              <ul className="space-y-1">
                {items.map((item, idx) => (
                  <ScopeRow key={`${item.key}-${idx}`} item={item} />
                ))}
              </ul>
            </div>
          );
        })
      )}

      {scope.notAvailable.length > 0 && (
        <div className="mt-4 rounded bg-gray-50 p-3">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
            Not yet available
          </h3>
          <ul className="text-xs text-gray-500 list-disc list-inside">
            {scope.notAvailable.map((n, idx) => <li key={`${n}-${idx}`}>{n}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
