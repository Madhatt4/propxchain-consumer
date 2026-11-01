// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import React from 'react';
import { CheckCircle } from 'lucide-react';
import { documentStatusLines, type DocumentStatusRow } from '@/lib/documentStatus';

interface DocumentStatusListProps {
  /** Rows the viewer cannot open: pass hiddenDocumentStatuses output. */
  rows: readonly DocumentStatusRow[];
}

/** Documents another party has uploaded: by category, never by filename. */
const DocumentStatusList: React.FC<DocumentStatusListProps> = ({ rows }) => {
  if (rows.length === 0) return null;

  return (
    <div className="mt-3" data-testid="document-status-list">
      <p className="text-sm font-medium mb-1 text-stone-600 dark:text-gray-400">Received from others</p>
      <ul className="space-y-1">
        {documentStatusLines(rows).map((line) => (
          <li key={line} className="flex items-center gap-2 text-sm text-stone-600 dark:text-gray-400">
            <CheckCircle className="w-4 h-4 text-teal-500 shrink-0" aria-hidden="true" />
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default DocumentStatusList;
