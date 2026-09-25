// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { useRef, useState } from 'react';

interface Props {
  templateCsv: string;
  templateFilename: string;
  onFileSelected: (text: string) => void;
  parseError: string | null;
}

export function PlotImportDropzone({
  templateCsv,
  templateFilename,
  onFileSelected,
  parseError,
}: Props): JSX.Element {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function handleFile(file: File): Promise<void> {
    setLocalError(null);
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setLocalError('Only .csv files are supported');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setLocalError('File is too large (maximum 2 MB)');
      return;
    }
    const text = await file.text();
    onFileSelected(text);
  }

  function downloadTemplate(): void {
    if (!templateCsv) return;
    const blob = new Blob([templateCsv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = templateFilename;
    a.click();
    URL.revokeObjectURL(url);
  }

  const error = parseError ?? localError;

  return (
    <div className="max-w-2xl mx-auto">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          const file = e.dataTransfer.files[0];
          if (file) void handleFile(file);
        }}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
          dragActive ? 'border-teal-500 bg-teal-50 dark:border-teal-400 dark:bg-teal-900/20' : 'border-[var(--border-color)]'
        }`}
        role="button"
        tabIndex={0}
        aria-label="Drop CSV file or click to browse"
      >
        <p className="text-lg">Drop a CSV file here, or click to browse</p>
        <p className="text-sm text-[var(--text-secondary)] mt-2">Max 2 MB, up to 1000 plots</p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
      </div>

      {error && (
        <div
          role="alert"
          className="mt-4 p-4 bg-red-50 dark:bg-red-950 border border-red-300 dark:border-red-800 text-red-800 dark:text-red-200 rounded"
        >
          {error}
        </div>
      )}

      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={downloadTemplate}
          className="text-teal-600 dark:text-teal-400 underline"
        >
          Download CSV template for this site
        </button>
      </div>
    </div>
  );
}
