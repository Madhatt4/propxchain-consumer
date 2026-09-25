// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Add a listing: paste a Rightmove / OnTheMarket URL to scrape, or enter
 * details manually. Either path lands on `estateAgentListingsService.create`
 * and navigates to the new listing's detail page.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';

import { useEstateAgentOrg } from '@/hooks/useEstateAgentOrg';
import { estateAgentListingsService } from '@/services/estateAgentListings.service';
import type { CreateAgentListingInput } from '@/services/estateAgentListings.service';
import type { AgentListingSource } from '@/types/estateAgentListing.types';
import type { PropertyListing, ProvenanceMap } from '@/types/listing.types';
import ListingImport from '@/components/forms/ListingImport';
import ListingEditForm from '@/components/forms/ListingEditForm';

type Tab = 'import' | 'manual';

const BLANK_LISTING: PropertyListing = {
  url: '',
  listingId: '',
  source: 'manual',
  address: '',
  postcode: '',
  price: 0,
  propertyType: '',
  bedrooms: 0,
  tenure: 'unknown',
  priceQualifier: '',
  bathrooms: 0,
  description: '',
  keyFeatures: [],
  images: [],
  floorplanUrl: null,
  epcRating: null,
  agentName: '',
  agentBranch: '',
  agentLogoUrl: null,
  councilTaxBand: null,
  propertyPhrase: '',
  provenance: {},
};

function toSource(listing: PropertyListing): AgentListingSource {
  if (listing.source === 'rightmove') return 'rightmove';
  if (listing.source === 'manual') return 'manual';
  return 'website';
}

function UnlinkedAccountState(): JSX.Element {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 text-center">
      <h1 className="font-[Fraunces] text-2xl font-semibold text-gray-900 dark:text-gray-50">
        Your account isn&apos;t linked to an agency yet
      </h1>
      <p className="mt-2 font-[DM_Sans] text-sm text-gray-500 dark:text-gray-400">
        Register your agency to start listing properties.
      </p>
    </div>
  );
}

function LoadingOrgState(): JSX.Element {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 text-center">
      <p className="font-[DM_Sans] text-sm text-gray-500 dark:text-gray-400">Loading…</p>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }): JSX.Element {
  return (
    <p className="mt-4 font-[DM_Sans] text-sm text-red-600 dark:text-red-400">{message}</p>
  );
}

const TAB_BASE_CLASS = 'min-h-11 rounded-md px-4 py-2 font-[DM_Sans] text-sm font-medium';
const TAB_ACTIVE_CLASS = 'bg-[#0D9488] text-white';
const TAB_INACTIVE_CLASS = 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300';

interface CreateListingTabsProps {
  active: Tab;
  onSelect: (tab: Tab) => void;
  disabled: boolean;
}

function CreateListingTabs({ active, onSelect, disabled }: CreateListingTabsProps): JSX.Element {
  return (
    <div className="mt-6 flex gap-2">
      <button
        type="button"
        disabled={disabled}
        className={`${TAB_BASE_CLASS} ${active === 'import' ? TAB_ACTIVE_CLASS : TAB_INACTIVE_CLASS} disabled:opacity-50`}
        onClick={() => onSelect('import')}
      >
        Paste a Rightmove / OnTheMarket link
      </button>
      <button
        type="button"
        disabled={disabled}
        className={`${TAB_BASE_CLASS} ${active === 'manual' ? TAB_ACTIVE_CLASS : TAB_INACTIVE_CLASS} disabled:opacity-50`}
        onClick={() => onSelect('manual')}
      >
        Enter details manually
      </button>
    </div>
  );
}

function ImportHint(): JSX.Element {
  return (
    <p className="mt-4 font-[DM_Sans] text-xs text-gray-500 dark:text-gray-400">
      Your own website link isn&apos;t supported yet — paste the Rightmove or OnTheMarket URL for the property.
    </p>
  );
}

interface MutationStatusProps {
  isPending: boolean;
  isError: boolean;
  error: unknown;
}

function MutationStatus({ isPending, isError, error }: MutationStatusProps): JSX.Element | null {
  if (isPending) {
    return <p className="mt-4 font-[DM_Sans] text-sm text-gray-500 dark:text-gray-400">Creating listing…</p>;
  }
  if (isError) {
    return <ErrorBanner message={error instanceof Error ? error.message : 'Failed to create listing'} />;
  }
  return null;
}

export default function ListingCreatePage(): JSX.Element {
  const navigate = useNavigate();
  const { organisationId, isLoading: isOrgLoading } = useEstateAgentOrg();
  const [tab, setTab] = useState<Tab>('import');

  const mutation = useMutation({
    mutationFn: (input: CreateAgentListingInput) => estateAgentListingsService.create(input),
    onSuccess: (row) => navigate(`/estate-agent/listings/${row.id}`),
  });

  if (isOrgLoading) return <LoadingOrgState />;
  if (!organisationId) return <UnlinkedAccountState />;

  const submit = (listing: PropertyListing, provenance: ProvenanceMap): void => {
    const source = toSource(listing);
    mutation.mutate({
      organisation_id: organisationId,
      source,
      source_url: source === 'manual' ? null : listing.url,
      listing,
      provenance,
    });
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="font-[Fraunces] text-2xl font-semibold text-gray-900 dark:text-gray-50">Add a listing</h1>

      <CreateListingTabs active={tab} onSelect={setTab} disabled={mutation.isPending} />

      {tab === 'import' && <ImportHint />}

      <div className={`mt-4 ${mutation.isPending ? 'pointer-events-none opacity-60' : ''}`}>
        {tab === 'import' ? (
          <ListingImport onImport={(listing) => submit(listing, listing.provenance)} />
        ) : (
          <ListingEditForm listing={BLANK_LISTING} onSave={submit} onCancel={() => setTab('import')} />
        )}
      </div>

      <MutationStatus isPending={mutation.isPending} isError={mutation.isError} error={mutation.error} />
    </div>
  );
}
