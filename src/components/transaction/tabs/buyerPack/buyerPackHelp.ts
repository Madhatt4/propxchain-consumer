// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The "?" help behind each Buyer pack row. Wording is verbatim from the
 * buyer-pack mock-up signed off on 2026-11-15 ("go with your recommendations").
 * Wording changes go through product sign-off first, not straight in here.
 * An id with no entry (a newer server item) simply gets no "?".
 */
import type { PackRowHelp } from '../salesPackHelp';

export const BUYER_PACK_HELP: Record<string, PackRowHelp> = {
  chain: {
    what: 'Whether buying this home depends on you selling another one first. Sellers ask early because a chain can slow a sale down or break it.',
    where: 'You already know. If you are selling, say so and keep your own sale moving.',
    cost: 'Free.',
    who: 'You.',
  },
  mortgage: {
    what: 'How you are paying. If you need a mortgage, a decision in principle (DIP) shows a lender is likely to lend to you; the mortgage offer comes later and is the formal one.',
    where: 'From your lender or mortgage broker. Save it to your wallet, then send it here. Check the date it runs out.',
    cost: 'A DIP is usually free. Some brokers charge a fee.',
    who: 'You, with your broker.',
  },
  proof_of_funds: {
    what: 'Evidence that you have the deposit, and any part of the price you are paying in cash. Anti-money-laundering rules require it.',
    where: 'Recent bank or savings statements. If family is gifting money, a signed gifted-deposit letter plus their statements. Save them to your wallet, then send them here.',
    cost: 'Free.',
    who: 'You. Your conveyancer checks it.',
  },
  id_aml: {
    what: 'The identity and anti-money-laundering check every conveyancer must carry out before they can act for you.',
    where: 'In the ID & AML tab, using your passport or driving licence and your phone. Only the result reaches this pack, never your documents.',
    cost: "Shown before you pay, at the checking provider's price.",
    who: 'You.',
  },
  survey: {
    what: "An independent inspection of the home's condition by a RICS surveyor, so you find problems before you commit, not after.",
    where: 'Choose one in the Property Survey stage, or upload a report you already have.',
    cost: 'Depends on the survey level and the property. Shown before you book.',
    who: "You. A lender's valuation is not a survey.",
  },
};
