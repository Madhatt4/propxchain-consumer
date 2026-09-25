// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { Link } from 'react-router-dom';

interface Props {
  siteId: string;
  importedCount: number;
  skippedCount: number;
  publishedCount: number | null;
  publishFailures: number;
}

export function PlotImportResult({
  siteId,
  importedCount,
  skippedCount,
  publishedCount,
  publishFailures,
}: Props): JSX.Element {
  return (
    <div className="max-w-2xl mx-auto text-center">
      <h2 className="text-2xl font-semibold mb-4">
        Successfully imported {importedCount} plot{importedCount === 1 ? '' : 's'}
      </h2>
      {skippedCount > 0 && (
        <p className="text-[var(--text-secondary)]">
          {skippedCount} row{skippedCount === 1 ? '' : 's'} were skipped due to errors.
        </p>
      )}
      {publishedCount !== null && (
        <p className="mt-2">
          {publishFailures === 0 ? (
            <>
              {publishedCount} plot{publishedCount === 1 ? '' : 's'} published and ready for reservations.
            </>
          ) : (
            <>
              {publishedCount} published, {publishFailures} failed to publish — see Plots list for details.
            </>
          )}
        </p>
      )}
      <div className="mt-8">
        <Link
          to={`/builder/sites/${siteId}/plots`}
          className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded inline-block"
        >
          Back to Plots
        </Link>
      </div>
    </div>
  );
}
