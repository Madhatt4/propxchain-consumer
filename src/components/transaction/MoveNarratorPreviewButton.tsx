// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * MoveNarratorPreviewButton — admin-only control to fire the Move Narrator on
 * demand for the open transaction, against its current state, so the AI card
 * appears in seconds without waiting for a real blocker change. For testing /
 * demoing the premium "where's my move?" push.
 */

import React from 'react';
import { Sparkles } from 'lucide-react';

import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useSubscription } from '../../hooks/useSubscription';
import { useMoveNarratorPreview } from '../../hooks/useMoveNarratorPreview';

interface MoveNarratorPreviewButtonProps {
  txId: string;
  role: 'buyer' | 'seller';
  propertyAddress: string;
  className?: string;
}

const MoveNarratorPreviewButton: React.FC<MoveNarratorPreviewButtonProps> = ({
  txId,
  role,
  propertyAddress,
  className = '',
}) => {
  const { isAdmin } = useIsAdmin();
  const { isPremium } = useSubscription();
  const { runPreview, isRunning } = useMoveNarratorPreview({ txId, role, propertyAddress });

  // Admin-only AND premium: the preview demonstrates a premium feature, so it
  // must not appear on the starter tier — otherwise toggling tier shows no
  // difference. Switch the tier toggle to premium to see it.
  if (!isAdmin || !isPremium) return null;

  return (
    <button
      type="button"
      onClick={() => void runPreview()}
      disabled={isRunning}
      className={`inline-flex items-center gap-2 rounded-lg border border-amber-400/50 bg-amber-50/60 dark:bg-amber-900/10 px-3 py-2 text-sm font-medium text-amber-800 dark:text-amber-300 transition-colors hover:bg-amber-100/70 dark:hover:bg-amber-900/20 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      <Sparkles className={`h-4 w-4 ${isRunning ? 'animate-pulse' : ''}`} />
      {isRunning ? 'Generating AI update…' : 'Preview AI update (admin)'}
    </button>
  );
};

export default MoveNarratorPreviewButton;
