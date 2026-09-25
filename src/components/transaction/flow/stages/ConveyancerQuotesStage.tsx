/**
 * ConveyancerQuotesStage — the quote-lifecycle-aware conveyancer stage.
 *
 * Replaces the direct ConveyancerPanel mount at seller-5/buyer-5 so the
 * stage covers the whole loop instead of ending at "quotes requested":
 *   no quotes yet      → browse the panel and request quotes
 *   quotes in flight   → compare and accept them in place
 *   quote accepted     → instructed state; the winning firm has been emailed
 *                        a one-time activation link and appears on the
 *                        transaction once they redeem it
 */
import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Loader2, MailCheck } from 'lucide-react';
import { ConveyancerPanel } from '../../../providers/ConveyancerPanel';
import { QuoteComparisonView } from '../../../providers/QuoteComparisonView';
import { conveyancerQuoteService } from '../../../../services/conveyancerQuote.service';
import { loadBuyerPack } from '../../../../services/buyerPack.service';
import type { ConveyancerQuote } from '../../../providers/types';
import type { PropertyListing } from '../../../../types/listing.types';
import { getRightmoveData, getTitleNumber, syncListingFromChain } from '../../../../utils/rightmoveStorage';
import { seedTransactionFactsFromListing, tenureLabel } from '../../../../services/transactionFacts.service';

interface ConveyancerQuotesStageProps {
  transactionId: string;
  postcode: string;
  partyName: string;
  partyEmail: string;
  propertyAddress: string;
  lenderName?: string;
  onLenderCaptured?: (lender: string) => void;
  /** Buyer side: read the lender from the Buyer Pack when none is passed. */
  readBuyerLender?: boolean;
  /** Fires when a fresh batch of quotes has been requested (stage-complete signal). */
  onQuotesRequested: () => void;
}

export function ConveyancerQuotesStage({
  transactionId,
  postcode,
  partyName,
  partyEmail,
  propertyAddress,
  lenderName,
  readBuyerLender = false,
  onLenderCaptured,
  onQuotesRequested,
}: ConveyancerQuotesStageProps): ReactNode {
  const [buyerLender, setBuyerLender] = useState<string | undefined>(lenderName);
  const [buyerIsCash, setBuyerIsCash] = useState(false);
  const [quotes, setQuotes] = useState<ConveyancerQuote[] | null>(null);
  const [showPanel, setShowPanel] = useState(false);
  // The listing supplies tenure and title number for the quote request, and
  // seeds transaction_facts so the quote scope and the conveyancer brief see
  // property type and tenure without the party answering them again.
  const [listing, setListing] = useState<PropertyListing | null>(() => (transactionId ? getRightmoveData(transactionId) : null));

  const loadQuotes = useCallback(async (): Promise<void> => {
    if (!transactionId) {
      setQuotes([]);
      return;
    }
    const loaded = await conveyancerQuoteService.getQuotesForTransaction(transactionId);
    setQuotes(loaded);
  }, [transactionId]);

  useEffect(() => {
    void loadQuotes();
  }, [loadQuotes]);
  useEffect(() => {
    if (!transactionId) return;
    let live = true;
    syncListingFromChain(transactionId)
      .then((l) => {
        if (!live) return;
        if (l) setListing(l);
        return seedTransactionFactsFromListing(transactionId, l ?? getRightmoveData(transactionId));
      })
      .catch(() => undefined); // facts are a convenience; the stage works without them
    return () => { live = false; };
  }, [transactionId]);
  useEffect(() => {
    if (!readBuyerLender || lenderName !== undefined || !transactionId) return;
    let live = true;
    loadBuyerPack(transactionId)
      .then((items) => {
        if (!live) return;
        const m = items.find((i) => i.item === 'mortgage')?.detail;
        setBuyerLender(m?.funding_type === 'mortgage' ? m.lender_name : undefined);
        setBuyerIsCash(m?.funding_type === 'cash');
      })
      .catch(() => undefined); // no pack yet is not an error for the quotes stage
    return () => { live = false; };
  }, [readBuyerLender, lenderName, transactionId]);

  if (quotes === null) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-gray-500 dark:text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Loading your quotes…
      </div>
    );
  }

  if (quotes.length === 0 || showPanel) {
    return (
      <ConveyancerPanel
        postcode={postcode}
        transactionId={transactionId}
        transactionType="sale"
        partyName={partyName}
        partyEmail={partyEmail}
        propertyAddress={propertyAddress}
        titleNumber={getTitleNumber(transactionId) ?? undefined}
        tenure={tenureLabel(listing)}
        onQuotesRequested={() => {
          setShowPanel(false);
          void loadQuotes();
          onQuotesRequested();
        }}
        lenderName={buyerLender}
        // A cash buyer has no lender to capture; a picked panel firm must not invent one.
        onLenderCaptured={buyerIsCash ? undefined : onLenderCaptured}
      />
    );
  }

  const acceptedQuote = quotes.find((q) => q.status === 'accepted');

  return (
    <div className="flex flex-col gap-4">
      {acceptedQuote && (
        <div className="flex items-start gap-3 rounded-lg border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-900/20 px-4 py-3">
          <MailCheck className="h-5 w-5 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" aria-hidden />
          <div>
            <p className="text-sm font-medium text-teal-700 dark:text-teal-300">
              {acceptedQuote.conveyancerName} instructed
            </p>
            <p className="text-xs text-teal-600 dark:text-teal-400 mt-1">
              We&rsquo;ve emailed the firm an activation link. They&rsquo;ll appear on this
              transaction with their CLC-registered details once they join.
            </p>
          </div>
        </div>
      )}

      <QuoteComparisonView quotes={quotes} onAccepted={() => { void loadQuotes(); }} />

      {!acceptedQuote && (
        <button
          type="button"
          onClick={() => setShowPanel(true)}
          className="self-start text-sm font-medium text-teal-600 dark:text-teal-400 hover:underline"
        >
          Request more quotes
        </button>
      )}
    </div>
  );
}
