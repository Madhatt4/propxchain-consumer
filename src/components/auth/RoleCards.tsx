// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import React from 'react';
import { Link } from 'react-router-dom';
import {
  PROFESSIONALS_HEADING,
  ROLE_CARDS,
  ROLE_PRICE_COPY,
  type RoleCardConfig,
} from './roleCards.config';

interface RoleCardsProps {
  /** Called for the cards that stay on /register (seller, buyer). */
  onChooseOnForm: (role: 'seller' | 'buyer') => void;
}

const CARD_BASE =
  'group rounded-md border border-t-4 border-[#E5E7EB] bg-white text-left transition-all hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#0D9488]';

function IconChip({ card }: { card: RoleCardConfig }): JSX.Element {
  const Icon = card.icon;
  return (
    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${card.chipClass}`}>
      <Icon className="h-6 w-6" aria-hidden="true" />
    </span>
  );
}

function CardText({ card }: { card: RoleCardConfig }): JSX.Element {
  return (
    <span className="min-w-0">
      <span className="block font-dm-sans text-sm font-semibold text-[#1A1A1A]">{card.title}</span>
      <span className="mt-0.5 block font-dm-sans text-sm text-[#6B7280]">{card.description}</span>
      <span className="mt-1 block font-dm-sans text-xs font-semibold text-[#0F766E]">{ROLE_PRICE_COPY}</span>
    </span>
  );
}

interface CardProps {
  card: RoleCardConfig;
  layout: 'tile' | 'row';
  onChooseOnForm: RoleCardsProps['onChooseOnForm'];
}

function RoleCard({ card, layout, onChooseOnForm }: CardProps): JSX.Element {
  const layoutClass =
    layout === 'tile' ? 'flex h-full flex-col gap-3 p-4' : 'flex items-start gap-4 p-4';
  const className = `${CARD_BASE} ${card.edgeClass} ${layoutClass} w-full`;
  const body = (
    <>
      <IconChip card={card} />
      <CardText card={card} />
    </>
  );
  if (card.destination === 'form') {
    return (
      <button type="button" className={className} onClick={() => onChooseOnForm(card.role as 'seller' | 'buyer')}>
        {body}
      </button>
    );
  }
  return (
    <Link to={card.destination} className={className}>
      {body}
    </Link>
  );
}

/**
 * First screen of registration: who are you. Seller and buyer sit on one row
 * and carry on to the account form below; the professions sit under them and
 * go to their own registration pages.
 */
const RoleCards: React.FC<RoleCardsProps> = ({ onChooseOnForm }) => (
  <>
    <h1 className="font-fraunces text-[2rem] font-semibold leading-tight tracking-tight text-[#1A1A1A] sm:text-[2.5rem]">
      Welcome to PropXchain.
    </h1>
    <p className="mt-3 max-w-md font-dm-sans text-base text-[#6B7280]">Which best describes you?</p>

    <ul className="mt-8 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2" aria-label="Buying or selling">
      {ROLE_CARDS.filter((c) => c.group === 'people').map((card) => (
        <li key={card.role}>
          <RoleCard card={card} layout="tile" onChooseOnForm={onChooseOnForm} />
        </li>
      ))}
    </ul>

    <h2 className="mt-8 font-dm-sans text-xs font-semibold uppercase tracking-[0.14em] text-[#6B7280]">
      {PROFESSIONALS_HEADING}
    </h2>
    <ul className="mt-3 space-y-3" aria-label={PROFESSIONALS_HEADING}>
      {ROLE_CARDS.filter((c) => c.group === 'professionals').map((card) => (
        <li key={card.role}>
          <RoleCard card={card} layout="row" onChooseOnForm={onChooseOnForm} />
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
