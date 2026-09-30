// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Add listing -> Start sale -> transaction flow, as one continuous run for an
 * estate agent. Creating the listing is off-chain only; the on-chain mint
 * happens when the agent commits to a seller in the Start sale step, so an
 * abandoned import never reaches the audit trail. Closing the modal leaves a
 * draft listing on the dashboard.
 */

import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, type UseMutationResult } from '@tanstack/react-query';

import { useListingStartSale, type UseListingStartSaleResult } from '@/hooks/useListingStartSale';
import { usePrincipalId } from '@/stores/authStore';
import { estateAgentListingsService } from '@/services/estateAgentListings.service';
import type { CreateAgentListingInput } from '@/services/estateAgentListings.service';
import type { StartSaleResult } from '@/services/startSale.service';
import type { AgentListingRow } from '@/types/estateAgentListing.types';

const LISTINGS_PATH = '/estate-agent/listings';

export interface UseListingCreateFlowResult {
  mutation: UseMutationResult<AgentListingRow, Error, CreateAgentListingInput>;
  createdRow: AgentListingRow | null;
  agentPrincipal: string | null;
  startSale: UseListingStartSaleResult;
  handleCancel: () => void;
}

export function useListingCreateFlow(organisationId: string | null): UseListingCreateFlowResult {
  const navigate = useNavigate();
  const agentPrincipal = usePrincipalId();
  const [createdRow, setCreatedRow] = useState<AgentListingRow | null>(null);

  const onStarted = useCallback(
    (result: StartSaleResult): void => navigate(`/transaction/${result.transactionId}/flow`),
    [navigate],
  );
  const startSale = useListingStartSale(createdRow?.id, organisationId, onStarted);

  const mutation = useMutation<AgentListingRow, Error, CreateAgentListingInput>({
    mutationFn: (input) => estateAgentListingsService.create(input),
    onSuccess: (row) => {
      // No principal means the modal cannot run; the detail page can retry it
      // once the session is back, so land there rather than on a dead end.
      if (!agentPrincipal) {
        navigate(`${LISTINGS_PATH}/${row.id}`);
        return;
      }
      setCreatedRow(row);
      startSale.openModal();
    },
  });

  const handleCancel = useCallback((): void => {
    startSale.closeModal();
    navigate(LISTINGS_PATH);
  }, [startSale, navigate]);

  return { mutation, createdRow, agentPrincipal, startSale, handleCancel };
}
