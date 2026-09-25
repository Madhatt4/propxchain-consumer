// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Agent's listing stock: tiles (default) or rows of their `agent_listings`,
 * with an empty state and an unlinked-account state for users without an
 * agency membership yet.
 */

import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { useEstateAgentOrg } from '@/hooks/useEstateAgentOrg';
import { estateAgentListingsService } from '@/services/estateAgentListings.service';
import { ListingRowCard } from '@/components/estate-agent/ListingRowCard';
import { ListingTileCard } from '@/components/estate-agent/ListingTileCard';
import { ListingViewToggle } from '@/components/estate-agent/ListingViewToggle';
import { useListingView } from '@/hooks/useListingView';
import type { ListingView } from '@/hooks/useListingView';
import type { AgentListingRow } from '@/types/estateAgentListing.types';
import { ProfessionalOverviewPanel } from '@/components/professional/ProfessionalOverviewPanel';
import { toOverviewStatus } from '@/components/professional/toOverviewStatus';
import { useNavigate } from 'react-router-dom';

const CTA_CLASS =
  'inline-flex min-h-11 items-center rounded-md bg-[#0D9488] px-5 py-2.5 font-[DM_Sans] text-sm font-medium text-white hover:bg-[#0F766E]';

function UnlinkedAccountState(): JSX.Element {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 text-center">
      <h1 className="font-[Fraunces] text-2xl font-semibold text-gray-900 dark:text-gray-50">
        Your account isn&apos;t linked to an agency yet
      </h1>
      <p className="mt-2 font-[DM_Sans] text-sm text-gray-500 dark:text-gray-400">
        Register your agency to start listing properties.
      </p>
      <Link to="/register/estate-agent" className={`mt-6 ${CTA_CLASS}`}>
        Register your agency
      </Link>
    </div>
  );
}

function LoadingListingsState(): JSX.Element {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 text-center">
      <p className="font-[DM_Sans] text-sm text-gray-500 dark:text-gray-400">Loading your listings…</p>
    </div>
  );
}

function EmptyListingsState(): JSX.Element {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 text-center">
      <h1 className="font-[Fraunces] text-2xl font-semibold text-gray-900 dark:text-gray-50">Listings</h1>
      <p className="mt-2 font-[DM_Sans] text-sm text-gray-500 dark:text-gray-400">
        No listings yet — paste a Rightmove link to add your first
      </p>
      <Link to="/estate-agent/listings/new" className={`mt-6 ${CTA_CLASS}`}>
        Add a listing
      </Link>
    </div>
  );
}

interface ListingsHeaderProps {
  view: ListingView;
  onViewChange: (view: ListingView) => void;
}

function ListingsHeader({ view, onViewChange }: ListingsHeaderProps): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-4">
      <h1 className="font-[Fraunces] text-2xl font-semibold text-gray-900 dark:text-gray-50">Listings</h1>
      <div className="flex items-center gap-3">
        <ListingViewToggle view={view} onChange={onViewChange} />
        <Link to="/estate-agent/listings/new" className={CTA_CLASS}>
          Add a listing
        </Link>
      </div>
    </div>
  );
}

function ListingsBody({ view, listings }: { view: ListingView; listings: AgentListingRow[] }): JSX.Element {
  if (view === 'list') {
    return (
      <ul data-testid="listing-row-list" className="mt-6 space-y-3">
        {listings.map((row) => (
          <ListingRowCard key={row.id} row={row} />
        ))}
      </ul>
    );
  }
  return (
    <ul data-testid="listing-tile-grid" className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {listings.map((row) => (
        <ListingTileCard key={row.id} row={row} />
      ))}
    </ul>
  );
}

/**
 * The panel wants transactions, not listings. A listing only has a
 * transaction once a sale has been started from it, so the unlinked ones are
 * dropped — passing them would make the panel fetch ledger events for ids
 * that do not exist.
 */
function toOverviewTransactions(listings: AgentListingRow[]): Array<{
  id: string;
  propertyAddress: string;
  status: string;
}> {
  return listings
    .filter((row) => row.transaction_id)
    .map((row) => ({
      id: row.transaction_id as string,
      propertyAddress: row.listing?.address ?? 'Unknown address',
      status: toOverviewStatus(row.status),
    }));
}

export default function EstateAgentListingListPage(): JSX.Element {
  const { organisationId, isLoading: isOrgLoading } = useEstateAgentOrg();
  const [view, setView] = useListingView();
  const navigate = useNavigate();

  const { data: listings = [], isLoading: isListingsLoading } = useQuery({
    queryKey: ['estate-agent-listings', organisationId],
    enabled: !!organisationId,
    queryFn: () => estateAgentListingsService.listByOrganisation(organisationId!),
  });

  if (isOrgLoading || isListingsLoading) return <LoadingListingsState />;
  if (!organisationId) return <UnlinkedAccountState />;
  if (listings.length === 0) return <EmptyListingsState />;

  const overviewTransactions = toOverviewTransactions(listings);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <ListingsHeader view={view} onViewChange={setView} />
      {/* Only rendered once a listing has a live sale behind it — before that
          there is nothing on-chain to summarise. */}
      {overviewTransactions.length > 0 && (
        <div className="mt-6">
          <ProfessionalOverviewPanel
            transactions={overviewTransactions}
            onTransactionClick={(transactionId) => {
              const row = listings.find((l) => l.transaction_id === transactionId);
              if (row) navigate(`/estate-agent/listings/${row.id}`);
            }}
          />
        </div>
      )}
      <ListingsBody view={view} listings={listings} />
    </div>
  );
}
