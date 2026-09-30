// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Wires the StartSaleModal open/close state and the listing-query
 * invalidation that follows a successful start-sale saga.
 */

import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import type { StartSaleResult } from '@/services/startSale.service';

export interface UseListingStartSaleResult {
  isModalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
  handleComplete: (result: StartSaleResult) => void;
}

/** Opens/closes StartSaleModal and, on completion, invalidates the list +
 *  detail queries so the just-linked transaction_id shows up immediately.
 *  `onStarted` lets a caller route somewhere once the sale exists; without
 *  it the agent stays on the page they are on (the listing detail page). */
export function useListingStartSale(
  id: string | undefined,
  organisationId: string | null,
  onStarted?: (result: StartSaleResult) => void,
): UseListingStartSaleResult {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openModal = useCallback((): void => setIsModalOpen(true), []);
  const closeModal = useCallback((): void => setIsModalOpen(false), []);

  const handleComplete = useCallback((result: StartSaleResult): void => {
    setIsModalOpen(false);
    queryClient.invalidateQueries({ queryKey: ['estate-agent-listings', organisationId] });
    queryClient.invalidateQueries({ queryKey: ['estate-agent-listing', id] });
    onStarted?.(result);
  }, [queryClient, organisationId, id, onStarted]);

  return { isModalOpen, openModal, closeModal, handleComplete };
}
