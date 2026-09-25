import { useState } from 'react';
import type { ReactElement } from 'react';
import { ChevronDown } from 'lucide-react';
import type { StageConfig } from '../../../types/stage.types';
import type { ProviderSelection } from '../../../types/provider.types';
import { useAnimatedCounter } from '../../../hooks/useAnimatedCounter';
import AppTopBar from '@/components/navigation/AppTopBar';
import { RemindersMenu } from '../RemindersMenu';

interface TopBarProps {
  /** Drives the reminders popover in the context strip. */
  transactionId: string;
  propertyAddress: string;
  postcode: string;
  sellerName: string;
  buyerName: string | null;
  stages: StageConfig[];
  totalCostPence: number;
  /** PropXchain fee included in totalCostPence — 0 on the free Starter tier,
   *  which hides the fee line from the cost breakdown. */
  propxchainFeePence: number;
  providerSelections: Map<string, ProviderSelection>;
  /** First image from the imported listing — used as the topbar thumbnail
   *  in place of the 🏠 emoji when available. */
  thumbnailUrl?: string;
}

/** Portal target in the context strip for the transaction's section-menu
 *  opener, shown only below lg where the left-hand menu has no room. */
export const TRANSACTION_NAV_SLOT_ID = 'transaction-nav-actions';

function formatPence(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

function getInitial(name: string): string {
  return name.charAt(0).toUpperCase();
}

function CostBreakdown({ stages, providerSelections, propxchainFeePence }: {
  stages: StageConfig[];
  providerSelections: Map<string, ProviderSelection>;
  propxchainFeePence: number;
}): ReactElement {
  const stagesWithCosts = stages.filter(s => s.hasProviderMarketplace);

  return (
    <div className="glass rounded-xl px-6 py-3 mt-2 flex flex-wrap gap-x-8 gap-y-1">
      {stagesWithCosts.map(stage => {
        const selection = providerSelections.get(stage.id);
        return (
          <div key={stage.id} className="flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-slate-400">{stage.title}</span>
            <span className="text-xs text-gray-700 dark:text-slate-300 font-medium">
              {selection ? formatPence(selection.costPence) : '—'}
            </span>
          </div>
        );
      })}
      {propxchainFeePence > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-slate-400">PropXchain fee</span>
          <span className="text-xs text-gray-700 dark:text-slate-300 font-medium">{formatPence(propxchainFeePence)}</span>
        </div>
      )}
    </div>
  );
}

export function TopBar({
  transactionId,
  propertyAddress,
  postcode,
  sellerName,
  buyerName,
  stages,
  totalCostPence,
  propxchainFeePence,
  providerSelections,
  thumbnailUrl,
}: TopBarProps): ReactElement {
  const [isExpanded, setIsExpanded] = useState(false);
  const animatedTotal = useAnimatedCounter(totalCostPence);

  return (
    <div className="sticky top-0 z-50">
      <AppTopBar
        title={propertyAddress}
        subtitle={postcode}
        backTo="/dashboard"
        backLabel="Back to dashboard"
      />

      {/* Transaction context strip. The bar above is the app's chrome; what
          sits here is specific to this transaction and has nowhere else to
          live — who is in it, and what it has cost so far. */}
      <div className="border-b border-gray-200 bg-white/90 backdrop-blur-[24px] transition-colors dark:border-teal-500/10 dark:bg-[rgba(8,14,30,0.92)]">
        <div className="flex flex-wrap items-center gap-4 px-5 py-3 lg:px-7">
          {thumbnailUrl && (
            <div className="hidden h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-teal-500/25 bg-teal-600/20 sm:flex">
              <img
                src={thumbnailUrl}
                alt=""
                className="h-full w-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
          )}

          {/* Parties — sage for seller, teal for buyer (DESIGN.md palette, no blue) */}
          <div className="flex shrink-0 items-center gap-2.5">
            <div className="flex items-center gap-1.5" title={`Seller: ${sellerName}`}>
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#5F8A68] text-[10px] font-bold text-white">
                {getInitial(sellerName)}
              </div>
              <span className="text-[10px] font-semibold text-[#5F8A68] dark:text-[#9CB8A4]">Seller</span>
            </div>
            <div className="h-5 w-px bg-gray-200 dark:bg-slate-700/30" />
            <div className="flex items-center gap-1.5">
              {buyerName ? (
                <>
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-600 text-[10px] font-bold text-white dark:bg-teal-500"
                    title={`Buyer: ${buyerName}`}
                  >
                    {getInitial(buyerName)}
                  </div>
                  <span className="text-[10px] font-semibold text-teal-700 dark:text-teal-400">Buyer</span>
                </>
              ) : (
                <>
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-full border-[1.5px] border-dashed border-gray-300 text-[10px] text-gray-400 dark:border-slate-600 dark:text-slate-500"
                    title="No buyer has joined yet — share the invite code"
                    aria-label="No buyer has joined yet"
                  >
                    +
                  </div>
                  <span className="text-[10px] text-gray-500 dark:text-slate-400">Awaiting buyer</span>
                </>
              )}
            </div>
          </div>

          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            {/* Section navigation. The sections live in a left-hand menu at lg
                and up; below that there is no room for one, so TransactionTabs
                fills this slot with the opener for its drawer. Rendered
                unconditionally: TransactionTabs resolves the target once on
                mount, so a slot that appears later — or not at all — would
                leave narrow viewports with no section navigation and nothing to
                say so. An empty flex container costs nothing. */}
            <div id={TRANSACTION_NAV_SLOT_ID} className="flex flex-wrap items-center gap-1.5" />
            {/* Reminders — a count pill that opens the list in a popover.
                Renders nothing when there is nothing outstanding. */}
            {transactionId && <RemindersMenu transactionId={transactionId} />}
          </div>

          {/* Running total — desktop only. On mobile the running total lives
              in CostFooterMobile (sticky bottom bar) so showing it here too
              would be a duplicate. */}
          <div className="hidden shrink-0 items-center gap-2 lg:flex">
            <div className="text-right">
              <p className="text-xl font-black text-teal-700 dark:text-teal-300">
                {formatPence(animatedTotal)}
              </p>
              <p className="text-[9px] font-semibold tracking-wide text-gray-500 dark:text-slate-400">RUNNING TOTAL</p>
            </div>
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex h-7 w-7 items-center justify-center rounded-lg glass text-gray-400 transition-colors hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300"
              aria-label="Toggle cost breakdown"
            >
              <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {/* Expanded Cost Breakdown */}
        {isExpanded && (
          <div className="px-5 pb-3 lg:px-7">
            <CostBreakdown stages={stages} providerSelections={providerSelections} propxchainFeePence={propxchainFeePence} />
          </div>
        )}
      </div>
    </div>
  );
}
