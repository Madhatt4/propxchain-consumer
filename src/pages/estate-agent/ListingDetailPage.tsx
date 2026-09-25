// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * A single listing: edit its details, review/fill Material Information,
 * change its status, and publish it to the public listing page.
 */

import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { useEstateAgentOrg } from '@/hooks/useEstateAgentOrg';
import { useListingMaterialInfo } from '@/hooks/useListingMaterialInfo';
import { useListingDetailMutations } from '@/hooks/useListingDetailMutations';
import { useListingStartSale } from '@/hooks/useListingStartSale';
import { useTransactionInviteCode } from '@/hooks/useTransactionInviteCode';
import { useListingDetailHandlers } from '@/hooks/useListingDetailHandlers';
import { usePrincipalId } from '@/stores/authStore';
import { estateAgentListingsService } from '@/services/estateAgentListings.service';
import { ListingDetailBody } from '@/components/estate-agent/ListingDetailBody';

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function CenteredMessage({ children }: { children: string }): JSX.Element {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 text-center">
      <p className="font-[DM_Sans] text-sm text-gray-500 dark:text-gray-400">{children}</p>
    </div>
  );
}

export default function ListingDetailPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const { organisationId, organisationName, isLoading: isOrgLoading } = useEstateAgentOrg();

  const { data: row = null, isLoading: isRowLoading } = useQuery({
    queryKey: ['estate-agent-listing', id],
    enabled: !!id,
    queryFn: () => estateAgentListingsService.getById(id!),
  });

  const { info, overrides, setOverrides, epc } = useListingMaterialInfo(row);
  const { updateMutation, statusMutation, publishMutation } = useListingDetailMutations(id, organisationId, organisationName);
  const agentPrincipal = usePrincipalId();
  const startSale = useListingStartSale(id, organisationId);
  const inviteCode = useTransactionInviteCode(row?.transaction_id ?? null);
  const { handleDetailsSave, handleMaterialInfoSave } = useListingDetailHandlers(updateMutation, info, overrides, epc);

  if (isOrgLoading || isRowLoading) return <CenteredMessage>Loading…</CenteredMessage>;
  if (!organisationId) return <CenteredMessage>Your account isn&apos;t linked to an agency yet.</CenteredMessage>;
  if (!row) return <CenteredMessage>Listing not found.</CenteredMessage>;

  return (
    <ListingDetailBody
      row={row}
      info={info}
      overrides={overrides}
      onOverridesChange={setOverrides}
      canPublish={organisationName !== null}
      onStatusChange={(status) => statusMutation.mutate(status)}
      onPublish={() => publishMutation.mutate(info)}
      onDetailsSave={handleDetailsSave}
      onMaterialInfoSave={handleMaterialInfoSave}
      isMaterialInfoSaving={updateMutation.isPending}
      statusError={statusMutation.isError ? errorMessage(statusMutation.error, 'Failed to update status') : null}
      publishError={publishMutation.isError ? errorMessage(publishMutation.error, 'Failed to publish listing') : null}
      inviteCode={inviteCode}
      agentPrincipal={agentPrincipal}
      startSale={startSale}
    />
  );
}
