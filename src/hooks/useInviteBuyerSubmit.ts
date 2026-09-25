// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Validation + submit for InviteBuyerForm, extracted so the form
 * component's own body stays under the 50-line declaration-to-close
 * budget.
 */

import { useCallback, useState } from 'react';

import { partyInviteService } from '@/services/partyInvite.service';

export interface UseInviteBuyerSubmitInput {
  transactionId: string;
  inviteCode: string;
  listingId: string;
  propertyAddress: string;
  onSent: () => void;
}

export interface UseInviteBuyerSubmitResult {
  error: string | null;
  isSending: boolean;
  submit: (buyerName: string, buyerEmail: string) => void;
  clearError: () => void;
}

/** Basic email regex — not exhaustive, just catches obvious typos. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function useInviteBuyerSubmit({
  transactionId,
  inviteCode,
  listingId,
  propertyAddress,
  onSent,
}: UseInviteBuyerSubmitInput): UseInviteBuyerSubmitResult {
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const submit = useCallback(
    async (buyerName: string, buyerEmail: string): Promise<void> => {
      const trimmedName = buyerName.trim();
      const trimmedEmail = buyerEmail.trim().toLowerCase();
      if (!trimmedName) return;
      if (!EMAIL_RE.test(trimmedEmail)) {
        setError('Please enter a valid email address');
        return;
      }
      setError(null);
      setIsSending(true);
      const result = await partyInviteService.send({
        transactionId,
        inviteCode,
        role: 'buyer',
        side: 'buyer',
        recipientName: trimmedName,
        recipientEmail: trimmedEmail,
        listingId,
        propertyAddress,
      });
      setIsSending(false);
      if (!result.ok) {
        setError(result.error ?? 'Invite could not be sent');
        return;
      }
      onSent();
    },
    [transactionId, inviteCode, listingId, propertyAddress, onSent],
  );

  const clearError = useCallback((): void => setError(null), []);

  return { error, isSending, submit, clearError };
}
