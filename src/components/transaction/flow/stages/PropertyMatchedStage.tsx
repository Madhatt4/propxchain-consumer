import { useState, type ReactNode } from 'react';
import { CheckCircle } from 'lucide-react';
import type { StageConfig } from '../../../../types/stage.types';
import { MORTGAGE_SLOTS } from '../../tabs/buyerPack/buyerPackLabels';
import { SendToSlot } from '../../tabs/buyerPack/SendToSlot';

interface StageProps {
  stage: StageConfig;
  onComplete?: (stageId: string) => void;
  transactionId?: string;
}

export function PropertyMatchedStage({ stage, onComplete, transactionId }: StageProps): ReactNode {
  const [agreedPrice, setAgreedPrice] = useState<string>('');
  const [priceConfirmed, setPriceConfirmed] = useState<boolean>(false);

  function handleConfirmPrice(): void {
    if (!agreedPrice.trim()) return;
    setPriceConfirmed(true);
  }

  function handleComplete(): void {
    onComplete?.(stage.id);
  }

  if (stage.status === 'completed') {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-3 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3">
          <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <p className="text-sm text-emerald-700 dark:text-emerald-300">
            Property matched. Transaction initiated.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3">
        <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <p className="text-sm text-emerald-700 dark:text-emerald-300">
          Offer accepted. You've been matched with this property.
        </p>
      </div>

      {/* Price confirmation */}
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-slate-400 mb-2">
          Confirm agreed price
        </p>
        {!priceConfirmed ? (
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">£</span>
              <input
                type="text"
                inputMode="numeric"
                value={agreedPrice}
                onChange={(e) => setAgreedPrice(e.target.value.replace(/[^0-9,]/g, ''))}
                placeholder="325,000"
                className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-gray-100 pl-7 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>
            <button
              type="button"
              onClick={handleConfirmPrice}
              disabled={!agreedPrice.trim()}
              className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
            >
              Confirm
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-sm font-medium">
            <CheckCircle className="h-4 w-4" />
            Agreed price: £{agreedPrice}
          </div>
        )}
      </div>

      {/* Decision in principle: sent from the PropXchain Wallet into the Buyer Pack (spec 2026-09-05) */}
      {transactionId && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-slate-400 mb-2">
            Decision in principle (optional)
          </p>
          <SendToSlot transactionId={transactionId} slots={MORTGAGE_SLOTS} onSent={() => undefined} />
        </div>
      )}

      {/* Complete button */}
      {priceConfirmed && (
        <button
          type="button"
          onClick={handleComplete}
          className="w-full px-4 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold transition-colors"
        >
          Confirm & Continue
        </button>
      )}

      <p className="text-xs text-gray-400 dark:text-slate-500">
        Confirm the agreed price and, if you have one, send your decision in principle from your wallet. Click
        "Confirm &amp; Continue" when you're ready to move on.
      </p>
    </div>
  );
}
