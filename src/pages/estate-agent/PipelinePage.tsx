// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The agent's pipeline is a chase list (stall attribution, spec
 * docs/plans/2026-09-05-stall-attribution-spec.md, surface 4): every live
 * sale started from a listing, longest wait first, each saying who owes the
 * next move and for how long. Roles only, never a name. The agent is the
 * natural chaser, so this is the surface that turns attribution into phone
 * calls. Reads the same server answer as every other stall surface.
 */
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { useEstateAgentOrg } from '@/hooks/useEstateAgentOrg';
import { useDealStalls } from '@/hooks/useDealStalls';
import { useDeskSignals } from '@/hooks/useDeskSignals';
import { estateAgentListingsService } from '@/services/estateAgentListings.service';
import { ChaseRowCard } from '@/components/estate-agent/ChaseRowCard';
import { describeChaseList, toChaseList } from '@/components/estate-agent/chaseList';

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

function LoadingPipelineState(): JSX.Element {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 text-center">
      <p className="font-[DM_Sans] text-sm text-gray-500 dark:text-gray-400">Loading your pipeline…</p>
    </div>
  );
}

function ErrorPipelineState({ onRetry }: { onRetry: () => void }): JSX.Element {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 text-center" data-testid="pipeline-error" role="alert">
      <h1 className="font-[Fraunces] text-2xl font-semibold text-gray-900 dark:text-gray-50">Pipeline</h1>
      <p className="mt-2 font-[DM_Sans] text-sm text-gray-500 dark:text-gray-400">
        Couldn&apos;t load your listings just now. Try again in a moment.
      </p>
      <button type="button" onClick={onRetry} className={`mt-6 ${CTA_CLASS}`}>
        Try again
      </button>
    </div>
  );
}

function EmptyPipelineState(): JSX.Element {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 text-center" data-testid="pipeline-empty">
      <h1 className="font-[Fraunces] text-2xl font-semibold text-gray-900 dark:text-gray-50">Pipeline</h1>
      <p className="mt-2 font-[DM_Sans] text-sm text-gray-500 dark:text-gray-400">
        No live sales yet. Start a sale from a listing and it appears here with who it is waiting on.
      </p>
      <Link to="/estate-agent/listings" className={`mt-6 ${CTA_CLASS}`}>
        Go to listings
      </Link>
    </div>
  );
}

export default function EstateAgentPipelinePage(): JSX.Element {
  const { organisationId, isLoading: isOrgLoading } = useEstateAgentOrg();

  const { data: listings = [], isLoading: isListingsLoading, isError, refetch } = useQuery({
    queryKey: ['estate-agent-listings', organisationId],
    enabled: !!organisationId,
    queryFn: () => estateAgentListingsService.listByOrganisation(organisationId!),
  });

  // Hooks before any early return. The stalls hook keys on the joined ids, so
  // a fresh array of the same deals does not refetch.
  const liveTransactionIds = useMemo(
    () => listings.flatMap((row) => (row.transaction_id ? [row.transaction_id] : [])),
    [listings],
  );
  const stallsByTx = useDealStalls(liveTransactionIds);
  const desk = useDeskSignals(organisationId);
  // The hook answers with a key per deal once loaded (an empty list when
  // nothing is waiting), so a missing key means still loading.
  const isStallsPending = liveTransactionIds.some((id) => !(id in stallsByTx));

  if (isOrgLoading || isListingsLoading) return <LoadingPipelineState />;
  if (!organisationId) return <UnlinkedAccountState />;
  // A failed read must never look like an empty desk.
  if (isError) return <ErrorPipelineState onRetry={() => void refetch()} />;

  const chase = toChaseList(listings, stallsByTx, desk);
  if (chase.length === 0) return <EmptyPipelineState />;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="font-[Fraunces] text-2xl font-semibold text-gray-900 dark:text-gray-50">Pipeline</h1>
      <p data-testid="pipeline-summary" className="mt-1 font-[DM_Sans] text-sm text-gray-500 dark:text-gray-400">
        {describeChaseList(chase, isStallsPending)}
      </p>
      <ul data-testid="chase-list" className="mt-6 space-y-3">
        {chase.map((entry) => (
          <ChaseRowCard key={entry.row.id} entry={entry} isPending={isStallsPending} />
        ))}
      </ul>
    </div>
  );
}
