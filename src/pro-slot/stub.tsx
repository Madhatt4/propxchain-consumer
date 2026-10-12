// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd
/**
 * Stand-in for PropXchain Pro in builds without the private package.
 * See config/pro-slot.ts.
 */
import { Link } from 'react-router-dom';

export default function ProApp(): JSX.Element {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold">PropXchain Pro</h1>
      <p className="mt-3 text-muted-foreground">
        The workspaces for conveyancers, estate agents and developers are not part of this build.
      </p>
      <Link to="/dashboard" className="mt-6 inline-block underline">
        Back to your dashboard
      </Link>
    </div>
  );
}
