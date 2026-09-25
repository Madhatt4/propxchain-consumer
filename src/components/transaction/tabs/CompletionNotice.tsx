// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * CompletionNotice — shown in the Transaction Wallet once a deal has
 * completed: sharing ends automatically at completion + 14 days (wallet spec
 * decision 8), so parties should take their copies before then.
 */
import { CalendarClock } from 'lucide-react';
import { COMPLETION_GRACE_DAYS } from '@/services/documentShare.service';

interface CompletionNoticeProps {
  accessEndsAt: string | null;
  expiredNow: number;
}

export function CompletionNotice({ accessEndsAt, expiredNow }: CompletionNoticeProps): JSX.Element {
  const ends = accessEndsAt ? new Date(accessEndsAt) : null;
  const daysLeft = ends ? Math.max(0, Math.ceil((ends.getTime() - Date.now()) / 86_400_000)) : null;
  return (
    <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
      <CalendarClock className="h-4 w-4 shrink-0 text-amber-600" />
      <p>
        This deal has completed.{' '}
        {ends && daysLeft !== null && daysLeft > 0 ? (
          <>
            Sharing ends automatically on <b>{ends.toLocaleDateString('en-GB')}</b> ({daysLeft}{' '}
            {daysLeft === 1 ? 'day' : 'days'} left of the {COMPLETION_GRACE_DAYS}-day grace period) — parties should
            take their copies before then.
          </>
        ) : (
          <>The {COMPLETION_GRACE_DAYS}-day grace period has ended and shared copies have been erased.</>
        )}
        {expiredNow > 0 && ` ${expiredNow} expired ${expiredNow === 1 ? 'share was' : 'shares were'} just erased.`}
      </p>
    </div>
  );
}
