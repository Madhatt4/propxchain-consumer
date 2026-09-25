// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The parties roster for a listing's linked transaction: seller/buyer
 * chips (joined / invited-pending / not-invited), read-only conveyancer
 * rows, and an inline "Invite buyer" form.
 */

import type { PartyRoleRow } from '@/services/partyRole.service';
import type { PartyInviteRow } from '@/services/partyInvite.service';
import { ROLE_DISPLAY, type DealSide } from '@/services/shareParty.service';
import { useListingParties, type SideStatus, type ResendError } from '@/hooks/useListingParties';
import InviteBuyerForm from '@/components/estate-agent/InviteBuyerForm';

export interface ListingPartiesSectionProps {
  transactionId: string;
  inviteCode: string | null;
  listingId: string;
  propertyAddress: string;
}

interface PartyChipProps {
  side: DealSide;
  status: SideStatus;
  invite: PartyInviteRow | undefined;
  onResend: (side: DealSide, invite: PartyInviteRow) => void;
  isResending: boolean;
  resendError: ResendError | null;
}

function PartyChip({ side, status, invite, onResend, isResending, resendError }: PartyChipProps): JSX.Element {
  const label = side === 'seller' ? 'Seller' : 'Buyer';
  const errorMessage = resendError?.side === side ? resendError.message : null;
  return (
    <div className="rounded-md border border-gray-200 px-3 py-2 dark:border-gray-700">
      <div className="flex items-center justify-between">
        <span className="font-[DM_Sans] text-sm font-medium text-gray-900 dark:text-gray-50">{label}</span>
        {status === 'joined' && <span className="font-[DM_Sans] text-xs font-medium text-[#0D9488]">Joined</span>}
        {status === 'invited' && (
          <div className="flex items-center gap-2">
            <span className="font-[DM_Sans] text-xs text-gray-500 dark:text-gray-400">Invited — pending</span>
            <button
              type="button"
              disabled={isResending}
              onClick={() => invite && onResend(side, invite)}
              className="rounded-md border border-[#0D9488] px-2 py-1 font-[DM_Sans] text-xs font-medium text-[#0D9488] hover:bg-[#CCFBF1] disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-[#042F2E]"
            >
              {isResending ? 'Sending…' : 'Re-send'}
            </button>
          </div>
        )}
        {status === 'none' && <span className="font-[DM_Sans] text-xs text-gray-400 dark:text-gray-500">Not invited</span>}
      </div>
      {errorMessage && (
        <p className="mt-1 font-[DM_Sans] text-xs text-red-600 dark:text-red-400">{errorMessage}</p>
      )}
    </div>
  );
}

interface PartyChipsRowProps {
  sellerStatus: SideStatus;
  buyerStatus: SideStatus;
  sellerInvite: PartyInviteRow | undefined;
  buyerInvite: PartyInviteRow | undefined;
  resendingSide: DealSide | null;
  resendError: ResendError | null;
  onResend: (side: DealSide, invite: PartyInviteRow) => void;
}

/** The seller + buyer chip pair. */
function PartyChipsRow({
  sellerStatus,
  buyerStatus,
  sellerInvite,
  buyerInvite,
  resendingSide,
  resendError,
  onResend,
}: PartyChipsRowProps): JSX.Element {
  return (
    <div className="space-y-2">
      <PartyChip
        side="seller"
        status={sellerStatus}
        invite={sellerInvite}
        onResend={onResend}
        isResending={resendingSide === 'seller'}
        resendError={resendError}
      />
      <PartyChip
        side="buyer"
        status={buyerStatus}
        invite={buyerInvite}
        onResend={onResend}
        isResending={resendingSide === 'buyer'}
        resendError={resendError}
      />
    </div>
  );
}

function ConveyancerRows({ roles }: { roles: PartyRoleRow[] }): JSX.Element | null {
  const conveyancers = roles.filter((r) => r.role === 'conveyancer');
  if (conveyancers.length === 0) return null;
  return (
    <div className="space-y-2">
      {conveyancers.map((row) => (
        <div
          key={row.principal}
          className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2 dark:border-gray-700"
        >
          <span className="font-[DM_Sans] text-sm font-medium text-gray-900 dark:text-gray-50">
            {ROLE_DISPLAY.conveyancer}
          </span>
          <span className="font-[DM_Sans] text-xs text-gray-500 dark:text-gray-400">{row.principal}</span>
        </div>
      ))}
    </div>
  );
}

export default function ListingPartiesSection({
  transactionId,
  inviteCode,
  listingId,
  propertyAddress,
}: ListingPartiesSectionProps): JSX.Element {
  const parties = useListingParties(transactionId, inviteCode, listingId, propertyAddress);

  if (parties.isLoading) {
    return <p className="font-[DM_Sans] text-sm text-gray-500 dark:text-gray-400">Loading parties…</p>;
  }

  return (
    <section className="space-y-4 rounded-lg border border-gray-200 p-4 dark:border-gray-700">
      <h2 className="font-[Fraunces] text-lg font-semibold text-gray-900 dark:text-gray-50">Parties</h2>
      <PartyChipsRow
        sellerStatus={parties.sellerStatus}
        buyerStatus={parties.buyerStatus}
        sellerInvite={parties.sellerInvite}
        buyerInvite={parties.buyerInvite}
        resendingSide={parties.resendingSide}
        resendError={parties.resendError}
        onResend={parties.handleResend}
      />
      <ConveyancerRows roles={parties.roles} />
      {parties.buyerStatus === 'none' && inviteCode && (
        <InviteBuyerForm
          transactionId={transactionId}
          inviteCode={inviteCode}
          listingId={listingId}
          propertyAddress={propertyAddress}
          onSent={parties.invalidate}
        />
      )}
    </section>
  );
}
