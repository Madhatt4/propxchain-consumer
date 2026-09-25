/**
 * The spinning-house "we're working on it" block.
 *
 * Born on the Property tab, where the first open fans out to ~10 open-gov
 * sources; now shared with the tmGroup search card, whose catalogue quote is up
 * to three real drafts while tmGroup's provider lookup settles (18s, 12s, then
 * 4s on a cold start, measured 2026-08-18). Both are waits long enough that a
 * silent grey box, or one line of grey text, reads as broken. Same house, same
 * teal, so the app has one way of saying "still working, not stuck".
 */

import { Home } from 'lucide-react';

interface LoadingHouseProps {
  title: string;
  detail: string;
}

export function LoadingHouse({ title, detail }: LoadingHouseProps): JSX.Element {
  return (
    <div
      className="flex h-72 w-full flex-col items-center justify-center gap-5 rounded-2xl bg-gray-100 dark:bg-gray-800"
      role="status"
      aria-live="polite"
    >
      <Home className="h-14 w-14 animate-spin text-teal-600 dark:text-teal-400" aria-hidden="true" />
      <p className="text-xl font-semibold text-gray-800 dark:text-gray-100">{title}</p>
      <p className="max-w-sm text-center text-sm text-gray-500 dark:text-gray-400">{detail}</p>
    </div>
  );
}
