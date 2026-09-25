// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Simple file input that stores refs as JSONB metadata.
 * Full ICP document_storage integration comes later.
 */

import { useRef } from 'react';
import { Upload, X } from 'lucide-react';

import type { ImageRef } from '@/services/plot-types.service';

interface ImageUploadSectionProps {
  label: string;
  refs: ImageRef[];
  onChange: (refs: ImageRef[]) => void;
}

export default function ImageUploadSection({
  label,
  refs,
  onChange,
}: ImageUploadSectionProps): JSX.Element {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const files = e.target.files;
    if (!files) return;

    const newRefs: ImageRef[] = Array.from(files).map((file) => ({
      name: file.name,
      size: file.size,
      uploadedAt: new Date().toISOString(),
    }));

    onChange([...refs, ...newRefs]);

    // Reset the input so the same file can be re-selected
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeRef = (index: number): void => {
    onChange(refs.filter((_, i) => i !== index));
  };

  return (
    <div>
      <p className="mb-1.5 block font-[DM_Sans] text-sm font-medium text-[var(--text-secondary)]">
        {label}
      </p>

      {refs.length > 0 && (
        <ul className="mb-2 space-y-1">
          {refs.map((ref, idx) => (
            <li
              key={`${ref.name}-${idx}`}
              className="flex items-center justify-between rounded-md border border-[var(--border-color)] bg-[var(--bg-section)] px-3 py-2"
            >
              <span className="truncate font-[DM_Sans] text-sm text-[var(--text-secondary)]">
                {ref.name}
                <span className="ml-2 text-xs text-[var(--text-muted)]">
                  ({(ref.size / 1024).toFixed(0)} KB)
                </span>
              </span>
              <button
                type="button"
                onClick={() => removeRef(idx)}
                className="ml-2 rounded p-1 text-[var(--text-muted)] hover:bg-[var(--bg-section)] hover:text-[var(--text-main)]"
                aria-label={`Remove ${ref.name}`}
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="inline-flex min-h-10 items-center rounded-md border border-dashed border-[var(--border-color)] px-4 py-2 font-[DM_Sans] text-sm text-[var(--text-secondary)] transition-colors hover:border-[#0D9488] hover:text-[#0D9488] dark:hover:border-[#0D9488] dark:hover:text-[#0D9488]"
      >
        <Upload className="mr-1.5 h-4 w-4" />
        Add files
      </button>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={handleFiles}
        className="hidden"
      />
    </div>
  );
}
