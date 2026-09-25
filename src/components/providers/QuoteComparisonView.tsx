import React, { useState } from 'react';
import type { ConveyancerQuote } from './types';
import { conveyancerQuoteService } from '../../services/conveyancerQuote.service';

interface QuoteComparisonViewProps {
  quotes: ConveyancerQuote[];
  onAccepted?: (quoteId: string) => void;
}

type QuoteStatus = ConveyancerQuote['status'];

interface StatusConfig {
  label: string;
  classes: string;
}

const STATUS_CONFIG: Record<QuoteStatus, StatusConfig> = {
  requested: {
    label: 'Awaiting Quote',
    classes: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  },
  quoted: {
    label: 'Quote Received',
    classes: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
  },
  accepted: {
    label: 'Instructed ✓',
    classes: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  },
  declined: {
    label: 'Declined',
    classes: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  },
  expired: {
    label: 'Expired',
    classes: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  },
};

function formatPence(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

interface QuoteCardProps {
  quote: ConveyancerQuote;
  hasAccepted: boolean;
  onAccept: (id: string) => Promise<void>;
  isAccepting: boolean;
}

function QuoteCard({ quote, hasAccepted, onAccept, isAccepting }: QuoteCardProps): React.ReactElement {
  const cfg = STATUS_CONFIG[quote.status];
  const isAccepted = quote.status === 'accepted';
  const showAcceptButton = quote.status === 'quoted' && !hasAccepted;
  const hasBreakdown = quote.legalFee != null || quote.disbursementsEstimate != null || quote.vat != null;
  const total =
    (quote.legalFee ?? 0) + (quote.disbursementsEstimate ?? 0) + (quote.vat ?? 0);

  return (
    <div
      className={[
        'rounded-xl border p-6 flex flex-col gap-4 bg-white dark:bg-[#0F1729] transition-colors',
        isAccepted
          ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20'
          : 'border-gray-200 dark:border-[#1E293B]',
      ].join(' ')}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold text-base text-[#1A1A1A] dark:text-[#F1F5F9] leading-snug">
          {quote.conveyancerName}
        </h3>
        <span
          className={[
            'shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
            cfg.classes,
          ].join(' ')}
        >
          {cfg.label}
        </span>
      </div>

      {/* Fee breakdown */}
      {hasBreakdown && (
        <div className="rounded-lg bg-[#F0F5F0] dark:bg-[#141F33] p-4 flex flex-col gap-2">
          {quote.legalFee != null && (
            <div className="flex justify-between text-sm">
              <span className="text-[#6B7280] dark:text-[#94A3B8]">Legal fee</span>
              <span className="font-mono tabular-nums text-[#1A1A1A] dark:text-[#F1F5F9]">
                {formatPence(quote.legalFee)}
              </span>
            </div>
          )}
          {quote.disbursementsEstimate != null && (
            <div className="flex justify-between text-sm">
              <span className="text-[#6B7280] dark:text-[#94A3B8]">Disbursements (est.)</span>
              <span className="font-mono tabular-nums text-[#1A1A1A] dark:text-[#F1F5F9]">
                {formatPence(quote.disbursementsEstimate)}
              </span>
            </div>
          )}
          {quote.vat != null && (
            <div className="flex justify-between text-sm">
              <span className="text-[#6B7280] dark:text-[#94A3B8]">VAT</span>
              <span className="font-mono tabular-nums text-[#1A1A1A] dark:text-[#F1F5F9]">
                {formatPence(quote.vat)}
              </span>
            </div>
          )}
          {hasBreakdown && (
            <div className="flex justify-between text-sm font-semibold border-t border-[#E5E7EB] dark:border-[#1E293B] pt-2 mt-1">
              <span className="text-[#1A1A1A] dark:text-[#F1F5F9]">Total</span>
              <span className="font-mono tabular-nums text-[#0D9488] dark:text-[#14B8A6]">
                {formatPence(total)}
              </span>
            </div>
          )}
          {quote.estimatedWeeks != null && (
            <p className="text-xs text-[#6B7280] dark:text-[#94A3B8] mt-1">
              Est. completion: {quote.estimatedWeeks} week{quote.estimatedWeeks !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      )}

      {/* Conditions */}
      {quote.conditions && (
        <p className="text-sm text-[#6B7280] dark:text-[#94A3B8] leading-relaxed">
          <span className="font-medium text-[#1A1A1A] dark:text-[#F1F5F9]">Conditions: </span>
          {quote.conditions}
        </p>
      )}

      {/* Accept button */}
      {showAcceptButton && (
        <button
          type="button"
          disabled={isAccepting}
          onClick={() => { void onAccept(quote.id); }}
          className={[
            'mt-auto w-full rounded-lg px-4 py-2.5 text-sm font-medium transition-colors',
            'bg-[#0D9488] text-white hover:bg-[#0F766E]',
            'dark:bg-[#14B8A6] dark:hover:bg-[#2DD4BF] dark:text-[#060B18]',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          ].join(' ')}
        >
          {isAccepting ? 'Instructing…' : 'Accept & Instruct'}
        </button>
      )}
    </div>
  );
}

export function QuoteComparisonView({ quotes, onAccepted }: QuoteComparisonViewProps): React.ReactElement {
  const [localQuotes, setLocalQuotes] = useState<ConveyancerQuote[]>(quotes);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  const hasAccepted = localQuotes.some((q) => q.status === 'accepted');

  async function handleAccept(quoteId: string): Promise<void> {
    setAcceptingId(quoteId);
    try {
      const result = await conveyancerQuoteService.acceptQuote(quoteId);
      if (!result.success) return;

      // The accept edge function auto-declines the other open quotes
      // server-side; mirror that in local state.
      setLocalQuotes((prev) =>
        prev.map((q) => {
          if (q.id === quoteId) return { ...q, status: 'accepted', acceptedAt: new Date().toISOString() };
          if (q.status === 'quoted') return { ...q, status: 'declined' };
          return q;
        }),
      );

      onAccepted?.(quoteId);
    } finally {
      setAcceptingId(null);
    }
  }

  if (localQuotes.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <h2 className="text-2xl font-semibold text-[#1A1A1A] dark:text-[#F1F5F9]" style={{ fontFamily: 'Fraunces, serif' }}>
          Your Quotes
        </h2>
        <p className="text-center text-[#6B7280] dark:text-[#94A3B8] py-12">
          No quotes requested yet.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-2xl font-semibold text-[#1A1A1A] dark:text-[#F1F5F9]" style={{ fontFamily: 'Fraunces, serif' }}>
        Your Quotes
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {localQuotes.map((quote) => (
          <QuoteCard
            key={quote.id}
            quote={quote}
            hasAccepted={hasAccepted}
            onAccept={handleAccept}
            isAccepting={acceptingId === quote.id}
          />
        ))}
      </div>
    </div>
  );
}

export default QuoteComparisonView;
