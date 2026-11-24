// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  ANALYTICS_CONSENT_EVENT,
  readAnalyticsConsent,
  saveAnalyticsConsent,
} from '@/lib/analyticsConsent';

export function CookieConsentBanner(): JSX.Element | null {
  const [isUndecided, setIsUndecided] = useState(() => readAnalyticsConsent() === null);

  useEffect(() => {
    const sync = (): void => setIsUndecided(readAnalyticsConsent() === null);
    window.addEventListener(ANALYTICS_CONSENT_EVENT, sync);
    return () => window.removeEventListener(ANALYTICS_CONSENT_EVENT, sync);
  }, []);

  if (!isUndecided) return null;

  return (
    <div
      role="region"
      aria-label="Cookie choice"
      className="fixed inset-x-0 bottom-0 z-[60] border-t border-gray-200 bg-white px-4 py-3 shadow-[0_-2px_8px_rgba(0,0,0,0.06)] dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-3 text-sm text-gray-700 sm:flex-row sm:items-center sm:justify-between dark:text-slate-200">
        <p>
          We use Google Analytics cookies to count visits and see which pages help. They stay off unless you accept.{' '}
          <Link to="/privacy" className="underline">
            Privacy policy
          </Link>
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => saveAnalyticsConsent('denied')}
            className="rounded-md border border-gray-300 px-4 py-2 font-semibold text-gray-800 hover:bg-gray-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            Reject
          </button>
          <button
            type="button"
            onClick={() => saveAnalyticsConsent('granted')}
            className="rounded-md bg-teal-600 px-4 py-2 font-semibold text-white hover:bg-teal-700"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
