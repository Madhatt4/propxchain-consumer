// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import type { ReactNode } from 'react';
import AddToCalendar from '@/components/common/AddToCalendar';
import { completionCalendarEvent, isCalendarDate } from '@/lib/calendarLinks';

interface CompletionDateLineProps {
  date: string | null | undefined;
  propertyAddress?: string | null;
  className?: string;
}

function longDate(date: string): string {
  return new Date(`${date.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export default function CompletionDateLine({ date, propertyAddress, className = '' }: CompletionDateLineProps): ReactNode {
  if (!isCalendarDate(date)) return null;
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-700 dark:text-slate-300 ${className}`}>
      <span>
        Agreed completion date: <strong className="text-gray-900 dark:text-white">{longDate(date)}</strong>
      </span>
      <AddToCalendar event={completionCalendarEvent(propertyAddress, date)} />
    </div>
  );
}
