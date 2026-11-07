// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Under the conveyancer stage: lets the client say their conveyancer is not
 * on PropXchain and was instructed directly, so Contract & Exchange is not
 * locked behind a firm that will never join. Marc's completion rule: that
 * stage then reads as client-confirmed, never as verified by a conveyancer.
 */
import { useState } from 'react';
import type { ReactElement } from 'react';

interface ConveyancerDirectConfirmProps {
  /** The stage is done on the client's word (not a verified firm). */
  isClientConfirmed: boolean;
  /** The stage is done for any reason (verified or client-confirmed). */
  isComplete: boolean;
  /** The viewer is the client this stage belongs to; only they may confirm. */
  canConfirm: boolean;
  onConfirm: () => void;
}

export function ConveyancerDirectConfirm({
  isClientConfirmed,
  isComplete,
  canConfirm,
  onConfirm,
}: ConveyancerDirectConfirmProps): ReactElement | null {
  const [isAsking, setIsAsking] = useState(false);

  if (isClientConfirmed) {
    return (
      <p className="mt-4 border-t border-gray-200 dark:border-slate-700 pt-3 text-sm text-gray-600 dark:text-slate-300">
        <span className="font-medium">Client-confirmed, not verified by a conveyancer.</span>{' '}
        You told us you instructed your conveyancer directly. If they join PropXchain, this
        stage will show their details instead.
      </p>
    );
  }
  if (isComplete || !canConfirm) return null;

  if (!isAsking) {
    return (
      <button
        type="button"
        onClick={() => setIsAsking(true)}
        className="mt-4 text-sm text-gray-600 dark:text-slate-300 underline underline-offset-2 hover:text-gray-900 dark:hover:text-white"
      >
        My conveyancer isn&rsquo;t on PropXchain &mdash; I&rsquo;ve instructed them directly
      </button>
    );
  }

  return (
    <div className="mt-4 border-t border-gray-200 dark:border-slate-700 pt-3 text-sm text-gray-700 dark:text-slate-200">
      <p>
        This marks the stage done on your word. It will show as client-confirmed, not
        verified by a conveyancer, and the next stage opens.
      </p>
      <div className="mt-2 flex gap-4">
        <button
          type="button"
          onClick={() => { setIsAsking(false); onConfirm(); }}
          className="font-medium text-teal-700 dark:text-teal-400 hover:underline"
        >
          Confirm
        </button>
        <button
          type="button"
          onClick={() => setIsAsking(false)}
          className="text-gray-500 dark:text-slate-400 hover:underline"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
