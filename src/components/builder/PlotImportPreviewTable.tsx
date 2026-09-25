// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { useState } from 'react';
import type { ValidationResult } from '@/services/plotImport.service';

interface Props {
  results: ValidationResult[];
  onCancel: () => void;
  onConfirm: (publishImmediately: boolean) => void;
  importing: boolean;
  importError: string | null;
}

export function PlotImportPreviewTable({
  results,
  onCancel,
  onConfirm,
  importing,
  importError,
}: Props): JSX.Element {
  const [publishImmediately, setPublishImmediately] = useState(false);

  const validCount = results.filter((r) => r.status === 'valid').length;
  const invalidCount = results.length - validCount;
  const hasValid = validCount > 0;

  return (
    <div>
      {importError && (
        <div
          role="alert"
          className="mb-4 p-4 bg-red-50 dark:bg-red-950 border border-red-300 dark:border-red-800 text-red-800 dark:text-red-200 rounded"
        >
          Import failed: {importError}
        </div>
      )}
      <div className="mb-4">
        <p className="text-lg">
          {results.length} rows parsed · {validCount} valid ·{' '}
          <span className={invalidCount > 0 ? 'text-red-600 dark:text-red-400' : ''}>
            {invalidCount} with errors
          </span>
        </p>
      </div>

      <div className="overflow-auto max-h-[60vh] border border-[var(--border-color)] rounded">
        <table className="w-full text-sm">
          <caption className="sr-only">CSV import preview results by row</caption>
          <thead className="bg-[var(--bg-section)] sticky top-0">
            <tr>
              <th scope="col" className="text-left p-2">Plot #</th>
              <th scope="col" className="text-left p-2">Plot Type</th>
              <th scope="col" className="text-left p-2">Price</th>
              <th scope="col" className="text-left p-2">Completion</th>
              <th scope="col" className="text-left p-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr
                key={r.rowIndex}
                className={
                  r.status === 'invalid'
                    ? 'bg-red-50 dark:bg-red-950 text-red-800 dark:text-red-200'
                    : ''
                }
              >
                <td className="p-2">{r.raw.plot_number || <em>(empty)</em>}</td>
                <td className="p-2">{r.raw.plot_type || <em>(empty)</em>}</td>
                <td className="p-2">{r.raw.price || <em>inherit</em>}</td>
                <td className="p-2">{r.raw.completion_date || '—'}</td>
                <td className="p-2">
                  {r.status === 'valid' ? '✓ Valid' : r.error}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={publishImmediately}
            onChange={(e) => setPublishImmediately(e.target.checked)}
            disabled={!hasValid || importing}
          />
          <span>Publish all imported plots immediately</span>
        </label>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={importing}
          className="px-4 py-2 border border-[var(--border-color)] rounded"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onConfirm(publishImmediately)}
          disabled={!hasValid || importing}
          className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded disabled:opacity-50"
        >
          {importing ? 'Importing…' : `Import ${validCount} valid row${validCount === 1 ? '' : 's'}`}
        </button>
      </div>
    </div>
  );
}
