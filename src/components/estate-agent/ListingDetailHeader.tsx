// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Listing detail header: address, price, status, and the publish / view /
 * start-sale actions.
 */

import { Link } from 'react-router-dom';

import { ListingStatusBadge, STATUS_LABELS } from '@/components/estate-agent/ListingStatusBadge';
import { safeExternalUrl } from '@/utils/externalUrl';
import type { AgentListingRow, AgentListingStatus } from '@/types/estateAgentListing.types';

const GBP_FORMATTER = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  maximumFractionDigits: 0,
});

const CTA_CLASS =
  'inline-flex min-h-11 items-center rounded-md bg-[#0D9488] px-5 py-2.5 font-[DM_Sans] text-sm font-medium text-white hover:bg-[#0F766E] disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 dark:disabled:bg-gray-700 dark:disabled:text-gray-400';

/** Secondary action: same size and rhythm as CTA_CLASS, but outlined — the
 *  agency's own site is a useful shortcut, not the thing we want them
 *  clicking. */
const CTA_SECONDARY_CLASS =
  'inline-flex min-h-11 items-center rounded-md border border-[#0D9488] px-5 py-2.5 font-[DM_Sans] text-sm font-medium text-[#0D9488] hover:bg-[#F0F5F0] dark:hover:bg-gray-800';

interface StatusSelectProps {
  status: AgentListingStatus;
  onStatusChange: (status: AgentListingStatus) => void;
}

function StatusSelect({ status, onStatusChange }: StatusSelectProps): JSX.Element {
  return (
    <div>
      <label htmlFor="listing-status" className="block font-[DM_Sans] text-xs font-medium text-gray-500 dark:text-gray-400">
        Status
      </label>
      <select
        id="listing-status"
        value={status}
        onChange={(e) => onStatusChange(e.target.value as AgentListingStatus)}
        className="mt-1 rounded-md border border-gray-300 bg-white px-3 py-2 font-[DM_Sans] text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-50"
      >
        {(Object.keys(STATUS_LABELS) as AgentListingStatus[]).map((value) => (
          <option key={value} value={value}>
            {STATUS_LABELS[value]}
          </option>
        ))}
      </select>
    </div>
  );
}

interface PublishOrViewButtonProps {
  slug: string | null;
  canPublish: boolean;
  onPublish: () => void;
}

/** "View public page" once a slug exists; otherwise "Publish" — disabled
 *  until `canPublish` (the agency name has resolved), since publishing
 *  without it would bake a broken slug that can never be regenerated.
 *
 *  Opens in a new tab. The public page is an anonymous, SEO-indexed page with
 *  no app chrome, so following it in the same tab strands the agent there with
 *  nothing to click back to. A back link on that page is the wrong fix — most
 *  of its visitors arrive cold from a search engine and have no portal to
 *  return to. */
function PublishOrViewButton({ slug, canPublish, onPublish }: PublishOrViewButtonProps): JSX.Element {
  if (slug) {
    return (
      <Link to={`/property/${slug}`} target="_blank" rel="noopener noreferrer" className={CTA_CLASS}>
        View public page
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={onPublish}
      disabled={!canPublish}
      title={canPublish ? undefined : 'Loading agency details…'}
      className={CTA_CLASS}
    >
      Publish
    </button>
  );
}

/** The agency's own listing page, when they've recorded one. A second button
 *  rather than a redirect of the first: the PropXchain page is the one that
 *  publishes material information up front, and replacing the link to it would
 *  make it unreachable from the portal. Guarded via `safeExternalUrl` because
 *  the value is agent-entered. */
function AgentSiteButton({ agentUrl }: { agentUrl: string | null }): JSX.Element | null {
  const href = safeExternalUrl(agentUrl);
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={CTA_SECONDARY_CLASS}>
      View on our site
    </a>
  );
}

function HeaderError({ message }: { message: string }): JSX.Element {
  return <p className="mt-2 w-full font-[DM_Sans] text-sm text-red-600 dark:text-red-400">{message}</p>;
}

interface StartSaleActionProps {
  row: AgentListingRow;
  agentPrincipal: string | null;
  onStartSale: () => void;
}

/** "Start sale" once unlinked, or a transaction-code chip once linked — the
 *  linkage is one-way (moves the listing to under_offer and mints an
 *  on-chain transaction), so there is no going back to the button. Disabled
 *  until `agentPrincipal` resolves, so a click can't queue a delayed,
 *  unprompted modal open once identity restores. */
function StartSaleAction({ row, agentPrincipal, onStartSale }: StartSaleActionProps): JSX.Element {
  if (row.transaction_id) {
    return (
      <div>
        <span className="block font-[DM_Sans] text-xs font-medium text-gray-500 dark:text-gray-400">Sale started</span>
        <span className="mt-1 inline-block font-[Geist_Mono] text-sm font-semibold text-gray-900 dark:text-gray-50">
          {row.transaction_id}
        </span>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onStartSale}
      disabled={!agentPrincipal}
      title={agentPrincipal ? undefined : 'Restoring your identity…'}
      className={CTA_CLASS}
    >
      Start sale
    </button>
  );
}

export interface ListingDetailHeaderProps {
  row: AgentListingRow;
  canPublish: boolean;
  onStatusChange: (status: AgentListingStatus) => void;
  onPublish: () => void;
  onStartSale: () => void;
  agentPrincipal: string | null;
  statusError?: string | null;
  publishError?: string | null;
}

/** Address, price, status badge/select, and the publish / view-page / start-sale actions. */
export function ListingDetailHeader({
  row,
  canPublish,
  onStatusChange,
  onPublish,
  onStartSale,
  agentPrincipal,
  statusError = null,
  publishError = null,
}: ListingDetailHeaderProps): JSX.Element {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="font-[Fraunces] text-2xl font-semibold text-gray-900 dark:text-gray-50">
          {row.listing.address}
        </h1>
        <p className="mt-1 font-[DM_Sans] text-sm text-gray-500 dark:text-gray-400">
          {GBP_FORMATTER.format(row.listing.price)}
        </p>
        <div className="mt-2">
          <ListingStatusBadge status={row.status} />
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <StatusSelect status={row.status} onStatusChange={onStatusChange} />
        <PublishOrViewButton slug={row.slug} canPublish={canPublish} onPublish={onPublish} />
        <AgentSiteButton agentUrl={row.agent_url} />
        <StartSaleAction row={row} agentPrincipal={agentPrincipal} onStartSale={onStartSale} />
        {statusError && <HeaderError message={statusError} />}
        {publishError && <HeaderError message={publishError} />}
      </div>
    </header>
  );
}

export default ListingDetailHeader;
