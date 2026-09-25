/**
 * Area rules and price formatting for the tmGroup card, split out of
 * SearchPackageBuilder to keep that file under the 300-line rule — and because
 * area detection is logic worth testing without rendering a component.
 */

/**
 * Which searches a property's area makes necessary.
 *
 * Coal mining and Cornish tin are the two that matter: a conveyancer in a former
 * coalfield will require CON29M, and omitting it is the sort of gap that surfaces
 * weeks later. Matched on the local-authority name because that is what the
 * listing gives us; a proper mining-area polygon lookup would be better and is
 * not what we have.
 */
export function getRequiredSearchIds(localAuthority: string): string[] {
  const la = localAuthority.toLowerCase();
  const required: string[] = [];

  const coalfieldTerms = [
    'bedfordshire', 'bedford', 'central bedfordshire',
    'yorkshire', 'leeds', 'sheffield', 'barnsley', 'rotherham', 'doncaster',
    'wakefield', 'bradford',
    'wales', 'cymru', 'merthyr', 'rhondda',
    'midlands', 'walsall', 'dudley', 'wolverhampton', 'sandwell', 'birmingham',
  ];
  if (coalfieldTerms.some((t) => la.includes(t))) {
    required.push('tmg-con29m');
  }

  const tinTerms = ['cornwall', 'penwith', 'kerrier', 'carrick'];
  if (tinTerms.some((t) => la.includes(t))) {
    required.push('tmg-corntin');
  }

  return required;
}

export function pence(amount: number): string {
  return `£${(amount / 100).toFixed(2)}`;
}

/**
 * tmGroup price PER PROPERTY — Local Authority fees run £100-£300 by council and
 * water £17-£98 (tmGroup, 2026-07-23). Before a live Draft comes back there
 * is no honest number to show.
 *
 * Rendering `pence(0)` would put "£0.00" against a search, which reads as FREE
 * rather than as unknown. That is by far the more dangerous of the two mistakes.
 */
export function priceLabel(amount: number): string {
  return amount > 0 ? pence(amount) : '—';
}

/**
 * What an UNPRICED line says. Before a refresh it asks for one — tmGroup's first
 * answer for a new address is the one most likely to be their queue rather than
 * the property (2026-08-19). After a refresh it is still unpriced, so it is the
 * property: not offered here.
 */
export function unpricedLabel(suggestRefresh: boolean): string {
  return suggestRefresh ? 'Not priced — press Refresh quote' : 'Not available here';
}

/**
 * What to tell someone whose quote did not come back orderable.
 *
 * The distinction is not cosmetic. An unpriced basket means tmGroup could not
 * resolve THIS PROPERTY's authorities, so changing the selection will never
 * help — it is the address that needs attention. A failed product is the
 * opposite: deselect it and the rest will price.
 *
 * Lives here rather than beside the component because both the card and the
 * order handler need it, and because a .tsx file that exports a component AND a
 * plain function breaks Fast Refresh (react-refresh/only-export-components).
 */
export function describeQuoteFailure(quote: {
  message?: string;
  unpricedProductTypes?: string[];
  failedProductTypes?: string[];
}): string {
  if (quote.message) return quote.message;
  if (quote.unpricedProductTypes?.length) {
    // 2026-08-19: this used to say "check the address". Marc's address was fine;
    // tmGroup's provider lookup was still settling and the same address priced
    // in full two minutes later. The first thing to try is asking again.
    return 'tmGroup could not price every search for this property just now. Press Refresh quote to ask again — if it keeps happening, check the address is correct and complete.';
  }
  if (quote.failedProductTypes?.length) {
    return 'tmGroup could not quote for one of the selected searches. Try removing it.';
  }
  return 'We could not get a price for this property just now.';
}
