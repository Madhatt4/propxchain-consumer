// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import { Link } from 'react-router-dom';

interface BuilderEmptyPageProps {
  userName: string | null;
}

export default function BuilderEmptyPage({ userName }: BuilderEmptyPageProps): JSX.Element {
  const displayName = userName || 'there';

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h1
        className="font-fraunces text-3xl font-semibold tracking-tight text-[var(--text-main)]"
      >
        Welcome, {displayName}. Let&apos;s set up your first site.
      </h1>

      <p className="mt-4 max-w-md font-sans text-base text-[var(--text-secondary)]">
        PropXchain Dev tracks every plot from listing to completion.
        Start by adding a development.
      </p>

      <Link
        to="/builder/sites/new"
        className="mt-8 inline-flex items-center rounded-lg bg-teal-600 px-6 py-3 font-sans text-sm font-medium text-white transition-colors hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 dark:bg-teal-500 dark:hover:bg-teal-400"
      >
        Create your first site
      </Link>
    </div>
  );
}
