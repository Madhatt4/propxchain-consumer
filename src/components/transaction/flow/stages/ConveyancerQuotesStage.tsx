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
 *   firm joined        → the side's solicitor slot is filled: the firm is on
 *                        the deal, so the stage says so instead
 */
import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Loader2, MailCheck, Scale } from 'lucide-react';
import { ConveyancerPanel } from '../../../providers/ConveyancerPanel';
import { QuoteComparisonView } from '../../../providers/QuoteComparisonView';
import { PexaFact } from '../../../providers/PexaFact';
import { conveyancerQuoteService } from '../../../../services/conveyancerQuote.service';
import { loadBuyerPack } from '../../../../services/buyerPack.service';
import type { ConveyancerQuote } from '../../../providers/types';
import type { PropertyListing } from '../../../../types/listing.types';
import { getRightmoveData, getTitleNumber, syncListingFromChain } from '../../../../utils/rightmoveStorage';
import { seedTransactionFactsFromListing, tenureLabel } from '../../../../services/transactionFacts.service';
import { quoteTransactionTypeFor, sideOfQuoteType } from './conveyancerQuoteSide';
import type { QuoteSideBlock } from './conveyancerQuoteSide';
import type { DealSide } from '../../../../lib/dealAccess';
import type { DealConveyancer } from '../../../../lib/dealConveyancers';
import type { JourneyRole } from '../../../../types/stage.types';

const SIDE_BLOCK_COPY: Record<QuoteSideBlock, string> = {
  side_unknown:
    "We couldn't confirm whether you're the buyer or the seller on this deal, so you can't request estimates here yet. Reload the page, and contact support if this keeps happening.",
  other_side:
    "This stage is for the other side's conveyancer. You can request estimates for your own conveyancer at your own conveyancer stage.",
};

interface ConveyancerQuotesStageProps {
  /** Whose conveyancer this stage instructs: seller-5 is 'seller', buyer-5 'buyer'. */
  stageSide: JourneyRole;
  /** The viewer's real side on the deal ('other' when it can't be established). */
  viewerSide: DealSide | undefined;
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
  /** This side's firm from the on-chain solicitor slot, once it has joined. */
  joinedConveyancer?: DealConveyancer | null;
}

/** The joined line: "your" for the side's own party, the side's name for anyone else. */
function joinedConveyancerText(firmName: string, stageSide: JourneyRole, viewerSide: DealSide | undefined): string {
  const whose = viewerSide === stageSide ? 'your' : `the ${stageSide}'s`;
  return `${firmName} is on this transaction as ${whose} conveyancer.`;
}

export function ConveyancerQuotesStage({
  stageSide,
  viewerSide,
  transactionId,
  postcode,
  partyName,
  partyEmail,
  propertyAddress,
  lenderName,
  readBuyerLender = false,
  onLenderCaptured,
  onQuotesRequested,
  joinedConveyancer = null,
}: ConveyancerQuotesStageProps): ReactNode {
  const [buyerLender, setBuyerLender] = useState<string | undefined>(lenderName);
  const [buyerIsCash, setBuyerIsCash] = useState(false);
  const [quotes, setQuotes] = useState<ConveyancerQuote[] | null>(null);
  const [showPanel, setShowPanel] = useState(false);
  // The listing supplies tenure and title number for the quote request, and
  // seeds transaction_facts so the quote scope and the conveyancer brief see
  // property type and tenure without the party answering them again.
  const [listing, setListing] = useState<PropertyListing | null>(() => (transactionId ? getRightmoveData(transactionId) : null));

  const side = quoteTransactionTypeFor(stageSide, viewerSide);

  const loadQuotes = useCallback(async (): Promise<void> => {
    if (!transactionId) {
      setQuotes([]);
      return;
    }
    const loaded = await conveyancerQuoteService.getQuotesForTransaction(transactionId);
    // RLS returns every quote the viewer requested on the deal; this stage
    // shows only the ones for its own side.
    setQuotes(loaded.filter((q) => sideOfQuoteType(q.transactionType) === stageSide));
  }, [transactionId, stageSide]);

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

  // A firm already on this side needs no panel: only an explicit ask opens it.
  const needsPanel = showPanel || (quotes.length === 0 && !joinedConveyancer);

  if (needsPanel && !side.ok) {
    return (
      <p role="status" className="py-4 text-sm text-gray-600 dark:text-slate-300">
        {SIDE_BLOCK_COPY[side.reason]}
      </p>
    );
  }

  if (needsPanel && side.ok) {
    return (
      <ConveyancerPanel
        postcode={postcode}
        transactionId={transactionId}
        transactionType={side.transactionType}
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

  const joinedFirm = joinedConveyancer
    ? joinedConveyancer.firmName ?? acceptedQuote?.conveyancerName ?? 'A firm on the PropXchain panel'
    : null;

  return (
    <div className="flex flex-col gap-4">
      {joinedFirm && (
        <div
          data-testid="conveyancer-joined"
          className="flex items-start gap-3 rounded-lg border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-900/20 px-4 py-3"
        >
          <Scale className="h-5 w-5 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" aria-hidden />
          <div>
            <p className="text-sm font-medium text-teal-700 dark:text-teal-300">
              {joinedConveyancerText(joinedFirm, stageSide, viewerSide)}
            </p>
            {acceptedQuote && (
              <PexaFact
                isPexaEnabled={acceptedQuote.isConveyancerPexaEnabled}
                className="mt-1 block text-xs text-teal-600 dark:text-teal-400"
              />
            )}
          </div>
        </div>
      )}
      {acceptedQuote && !joinedFirm && (
        <div className="flex items-start gap-3 rounded-lg border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-900/20 px-4 py-3">
          <MailCheck className="h-5 w-5 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" aria-hidden />
          <div>
            <p className="text-sm font-medium text-teal-700 dark:text-teal-300">
              {acceptedQuote.conveyancerName} instructed
            </p>
            <PexaFact
              isPexaEnabled={acceptedQuote.isConveyancerPexaEnabled}
              className="mt-1 block text-xs text-teal-600 dark:text-teal-400"
            />
            <p className="text-xs text-teal-600 dark:text-teal-400 mt-1">
              We&rsquo;ve emailed the firm an activation link. They&rsquo;ll appear on this
              transaction with their CLC-registered details once they join.
            </p>
          </div>
        </div>
      )}

      {quotes.length > 0 && <QuoteComparisonView quotes={quotes} onAccepted={() => { void loadQuotes(); }} />}

      {!acceptedQuote && !joinedFirm && side.ok && (
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
