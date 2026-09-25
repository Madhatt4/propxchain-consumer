import { useState } from 'react';
import type { ReactElement } from 'react';
import { ChevronUp } from 'lucide-react';
import type { ProviderSelection } from '../../../types/provider.types';
import { getSellerStages, getBuyerStages } from '../../../utils/stageConfig';
import { useAnimatedCounter } from '../../../hooks/useAnimatedCounter';

interface CostFooterMobileProps {
  totalCostPence: number;
  /** PropXchain fee included in totalCostPence — 0 on the free Starter tier,
   *  which hides the fee line from the expanded breakdown. */
  propxchainFeePence: number;
  providerSelections: Map<string, ProviderSelection>;
}

function formatPence(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

// Human-readable stage titles keyed by stageId, reused from the canonical
// stage config so the breakdown shows "Property Searches" rather than the
// raw "seller-2" identifier. Falls back to the raw id if unknown.
const STAGE_TITLES: Record<string, string> = Object.fromEntries(
  [...getSellerStages(), ...getBuyerStages()].map((s) => [s.id, s.title]),
);

function stageLabel(stageId: string): string {
  return STAGE_TITLES[stageId] ?? stageId;
}

export function CostFooterMobile({ totalCostPence, propxchainFeePence, providerSelections }: CostFooterMobileProps): ReactElement {
  const [isExpanded, setIsExpanded] = useState(false);
  const animatedTotal = useAnimatedCounter(totalCostPence);

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[rgba(8,14,30,0.95)] backdrop-blur-[20px] border-t border-gray-200 dark:border-teal-500/10 transition-colors">
      {isExpanded && (
        <div className="px-4 pt-3 pb-1 space-y-1">
          {Array.from(providerSelections.entries()).map(([stageId, sel]) => (
            <div key={stageId} className="flex justify-between">
              <span className="text-xs text-gray-500 dark:text-slate-400">{stageLabel(stageId)}</span>
              <span className="text-xs text-gray-700 dark:text-slate-300">{formatPence(sel.costPence)}</span>
            </div>
          ))}
          {propxchainFeePence > 0 && (
            <div className="flex justify-between">
              <span className="text-xs text-gray-500 dark:text-slate-400">PropXchain fee</span>
              <span className="text-xs text-gray-700 dark:text-slate-300">{formatPence(propxchainFeePence)}</span>
            </div>
          )}
        </div>
      )}
      <div className="flex items-center justify-between px-4 py-3">
        <div>
          <p className="text-lg font-black text-teal-700 dark:text-teal-300">
            {formatPence(animatedTotal)}
          </p>
          <p className="text-[9px] text-gray-500 dark:text-slate-400 font-semibold">RUNNING TOTAL</p>
        </div>
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-8 h-8 rounded-lg glass flex items-center justify-center text-gray-400 dark:text-slate-500"
        >
          <ChevronUp className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </button>
      </div>
    </div>
  );
}
