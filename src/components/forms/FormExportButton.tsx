// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Shared "Export PDF" button for the TA6/TA7/TA10 forms (Ship 2.7).
 *
 * Handles generating the PDF via formExportService and triggering a
 * browser download. Renders a loading state while generating.
 */

import { useState } from 'react';
import type { ReactElement } from 'react';

import {
  exportTA6ToPDF,
  exportTA7ToPDF,
  exportTA10ToPDF,
  downloadBlob,
  type ExportContext,
  type ExportOptions,
} from '../../services/formExportService';
import type { TA6PropertyInformation } from '../../types/ta6.types';
import type { TA7LeaseholdInformation } from '../../types/ta7.types';
import type { TA10FittingsAndContents } from '../../types/ta10.types';

type FormPayload =
  | { formType: 'TA6'; data: TA6PropertyInformation }
  | { formType: 'TA7'; data: TA7LeaseholdInformation }
  | { formType: 'TA10'; data: TA10FittingsAndContents };

interface FormExportButtonProps {
  payload: FormPayload;
  context: ExportContext;
  options?: ExportOptions;
  /** Filename base (no .pdf extension). Default: `<formType>-<date>`. */
  filename?: string;
  className?: string;
}

export function FormExportButton({
  payload,
  context,
  options,
  filename,
  className,
}: FormExportButtonProps): ReactElement {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async (): Promise<void> => {
    setError(null);
    setIsGenerating(true);
    try {
      let blob: Blob;
      switch (payload.formType) {
        case 'TA6':
          blob = await exportTA6ToPDF(payload.data, context, options);
          break;
        case 'TA7':
          blob = await exportTA7ToPDF(payload.data, context, options);
          break;
        case 'TA10':
          blob = await exportTA10ToPDF(payload.data, context, options);
          break;
      }
      const base = filename ?? `${payload.formType}-${new Date().toISOString().slice(0, 10)}`;
      downloadBlob(blob, `${base}.pdf`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate PDF');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="inline-flex flex-col items-end">
      <button
        type="button"
        onClick={handleClick}
        disabled={isGenerating}
        className={
          className ??
          'px-6 py-2 bg-white text-[#0D9488] border border-[#0D9488] rounded-md hover:bg-[#0D9488]/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
        }
        aria-label={`Export ${payload.formType} as PDF`}
      >
        {isGenerating ? 'Generating PDF…' : 'Export PDF'}
      </button>
      {error && (
        <span className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

export default FormExportButton;
