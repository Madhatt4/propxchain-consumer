// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import React from 'react';
import { Link } from 'react-router-dom';
import { ROLE_CARDS, ROLE_PRICE_COPY, type RoleCardConfig } from './roleCards.config';

interface RoleCardsProps {
  /** Called for the cards that stay on /register (seller, buyer). */
  onChooseOnForm: (role: 'seller' | 'buyer') => void;
}

const CARD_CLASS =
  'group flex w-full flex-col gap-1 rounded-md border border-[#E5E7EB] bg-white px-4 py-4 text-left transition-colors hover:border-[#84A98C] hover:bg-[#F0F5F0] focus:outline-none focus:ring-2 focus:ring-[#0D9488]';

function CardBody({ card }: { card: RoleCardConfig }): JSX.Element {
  return (
    <>
      <span className="block font-dm-sans text-sm font-semibold text-[#1A1A1A]">{card.title}</span>
      <span className="block font-dm-sans text-sm text-[#6B7280]">{card.description}</span>
      <span className="block font-dm-sans text-xs font-semibold text-[#0F766E]">{ROLE_PRICE_COPY}</span>
    </>
  );
}

/**
 * First screen of registration: who are you. Seller and buyer carry on to the
 * account form below; estate agent, conveyancer and developer go to their own
 * registration pages.
 */
const RoleCards: React.FC<RoleCardsProps> = ({ onChooseOnForm }) => (
  <>
    <h1 className="font-fraunces text-[2rem] font-semibold leading-tight tracking-tight text-[#1A1A1A] sm:text-[2.5rem]">
      Welcome to PropXchain.
    </h1>
    <p className="mt-3 max-w-md font-dm-sans text-base text-[#6B7280]">Which best describes you?</p>

    <ul className="mt-8 space-y-3" aria-label="Choose your role">
      {ROLE_CARDS.map((card) => (
        <li key={card.role}>
          {card.destination === 'form' ? (
            <button
              type="button"
              className={CARD_CLASS}
              onClick={() => onChooseOnForm(card.role as 'seller' | 'buyer')}
            >
              <CardBody card={card} />
            </button>
          ) : (
            <Link to={card.destination} className={CARD_CLASS}>
              <CardBody card={card} />
            </Link>
          )}
        </li>
      ))}
    </ul>

    <p className="mt-10 font-dm-sans text-sm text-[#6B7280]">
      Already have an account?{' '}
      <Link to="/login" className="font-medium text-[#0D9488] hover:underline">
        Sign in
      </Link>
    </p>
  </>
);

export default RoleCards;
