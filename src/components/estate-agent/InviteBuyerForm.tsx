// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Inline "Invite buyer" form for ListingPartiesSection — buyer name +
 * email, sent via partyInviteService.send with role/side 'buyer'.
 */

import { useState, type FormEvent } from 'react';

import { useInviteBuyerSubmit } from '@/hooks/useInviteBuyerSubmit';

interface InviteBuyerFormProps {
  transactionId: string;
  inviteCode: string;
  listingId: string;
  propertyAddress: string;
  onSent: () => void;
}

const FIELD_CLASS =
  'mt-1 rounded-md border border-gray-300 bg-white px-3 py-2 font-[DM_Sans] text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-50';

interface BuyerFieldsProps {
  buyerName: string;
  buyerEmail: string;
  isSending: boolean;
  onNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
}

function BuyerFields({ buyerName, buyerEmail, isSending, onNameChange, onEmailChange }: BuyerFieldsProps): JSX.Element {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <label htmlFor="buyer-invite-name" className="block font-[DM_Sans] text-xs font-medium text-gray-500 dark:text-gray-400">
          Buyer name
        </label>
        <input
          id="buyer-invite-name"
          type="text"
          required
          value={buyerName}
          onChange={(e) => onNameChange(e.target.value)}
          className={FIELD_CLASS}
        />
      </div>
      <div>
        <label htmlFor="buyer-invite-email" className="block font-[DM_Sans] text-xs font-medium text-gray-500 dark:text-gray-400">
          Buyer email
        </label>
        <input
          id="buyer-invite-email"
          type="email"
          required
          value={buyerEmail}
          onChange={(e) => onEmailChange(e.target.value)}
          className={FIELD_CLASS}
        />
      </div>
      <button
        type="submit"
        disabled={isSending}
        className="rounded-md bg-[#0D9488] px-4 py-2 font-[DM_Sans] text-sm font-medium text-white hover:bg-[#0F766E] disabled:cursor-not-allowed disabled:bg-gray-300"
      >
        {isSending ? 'Sending…' : 'Invite buyer'}
      </button>
    </div>
  );
}

export default function InviteBuyerForm({
  transactionId,
  inviteCode,
  listingId,
  propertyAddress,
  onSent,
}: InviteBuyerFormProps): JSX.Element {
  const [buyerName, setBuyerName] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const { error, isSending, submit, clearError } = useInviteBuyerSubmit({
    transactionId,
    inviteCode,
    listingId,
    propertyAddress,
    onSent: () => {
      setBuyerName('');
      setBuyerEmail('');
      onSent();
    },
  });

  const handleSubmit = (e: FormEvent): void => {
    e.preventDefault();
    submit(buyerName, buyerEmail);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 border-t border-gray-200 pt-4 dark:border-gray-700">
      <h3 className="font-[DM_Sans] text-sm font-medium text-gray-900 dark:text-gray-50">Invite buyer</h3>
      <BuyerFields
        buyerName={buyerName}
        buyerEmail={buyerEmail}
        isSending={isSending}
        onNameChange={setBuyerName}
        onEmailChange={(value) => {
          setBuyerEmail(value);
          clearError();
        }}
      />
      {error && <p className="font-[DM_Sans] text-xs text-red-600 dark:text-red-400">{error}</p>}
    </form>
  );
}
