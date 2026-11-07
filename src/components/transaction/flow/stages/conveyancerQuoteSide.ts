/**
 * Which side an estimate request is for. conveyancer_quotes.transaction_type
 * is the requester's own perspective, and the backend keys three things on it:
 * the side the auto-decline on accept is scoped to, the on-chain slot the firm
 * is assigned to at redeem ('purchase' -> buyer, else seller), and the label
 * the firm sees in /pro. Hard-coding 'sale' put a buyer's firm in the seller's
 * slot (card 97344870), so the value is derived here and never defaulted.
 */
import type { DealSide } from '../../../../lib/dealAccess';
import type { JourneyRole } from '../../../../types/stage.types';

export type QuoteTransactionType = 'sale' | 'purchase';

export type QuoteSideBlock = 'side_unknown' | 'other_side';

export type QuoteSideResult =
  | { ok: true; transactionType: QuoteTransactionType }
  | { ok: false; reason: QuoteSideBlock };

/** The side a stored quote belongs to, using the backend's mapping. */
export function sideOfQuoteType(transactionType: string): JourneyRole {
  return transactionType === 'purchase' ? 'buyer' : 'seller';
}

/**
 * The transaction_type for a request made from `stageSide`'s conveyancer
 * stage by a viewer on `viewerSide`. Only a viewer on that same side may
 * request; anyone whose side is unknown ('other', or not loaded) is refused
 * rather than guessed.
 */
export function quoteTransactionTypeFor(
  stageSide: JourneyRole,
  viewerSide: DealSide | undefined,
): QuoteSideResult {
  if (viewerSide !== 'buyer' && viewerSide !== 'seller') return { ok: false, reason: 'side_unknown' };
  if (viewerSide !== stageSide) return { ok: false, reason: 'other_side' };
  return { ok: true, transactionType: viewerSide === 'buyer' ? 'purchase' : 'sale' };
}
