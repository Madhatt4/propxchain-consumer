import React from 'react';
import { Plus, Trash2 } from 'lucide-react';

import { DocumentSlot } from './widgets/DocumentSlot';
import { PromptHeader } from './widgets/PromptHeader';
import { SECTION_05_PROMPTS } from '../../../lib/ta6-prompts/section05';
import { emptyDocument } from '../../../types/ta6.types';
import type { TA6DocumentValue } from '../../../types/ta6.types';

export interface Section05DocumentsProps {
  value: TA6DocumentValue[];
  onChange: (next: TA6DocumentValue[]) => void;
  readOnly: boolean;
  uploadFile?: (file: File) => Promise<string>;
}

// Ghost row shown when no documents exist yet — same defaults the Add button
// appends. It joins the form value only on the first interaction.
const EMPTY_DOCUMENT_ROW: TA6DocumentValue = emptyDocument();

/**
 * §5.2 consent/permission paperwork for the alterations ticked in 5.1 —
 * a variable-length list of document slots with add/remove row controls.
 * Rows are positional (5.2.1, 5.2.2, ...); the on-chain shape is [TA6Document].
 */
export const Section05Documents: React.FC<Section05DocumentsProps> = ({
  value,
  onChange,
  readOnly,
  uploadFile,
}) => {
  // Ghost row: an open first slot renders without a click, but the form value
  // stays [] until the user interacts (setRow writes through the ghost).
  const displayRows = value.length > 0 ? value : readOnly ? [] : [EMPTY_DOCUMENT_ROW];

  const setRow = (index: number) => (next: TA6DocumentValue): void => {
    const base = value.length > 0 ? value : [EMPTY_DOCUMENT_ROW];
    onChange(base.map((doc, i) => (i === index ? next : doc)));
  };

  const removeRow = (index: number): void => {
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <PromptHeader refCode="5.2" prompt={SECTION_05_PROMPTS.find((p) => p.ref === '5.2')} />
      {displayRows.map((doc, index) => (
        // Rows carry no identity of their own — position IS the identity here.
        <div key={index} className="flex items-start gap-3 p-3 border border-gray-200 rounded-md">
          <div className="flex-1">
            <DocumentSlot
              refCode={`5.2.${index + 1}`}
              prompt={undefined}
              value={doc}
              onChange={setRow(index)}
              readOnly={readOnly}
              onUpload={uploadFile}
            />
          </div>
          {!readOnly && value.length > 0 && (
            <button
              type="button"
              onClick={() => removeRow(index)}
              aria-label={`Remove document ${index + 1}`}
              className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>
      ))}
      {!readOnly && (
        <button
          type="button"
          onClick={() => onChange([...value, emptyDocument()])}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 border border-blue-200 rounded-md hover:bg-blue-50 transition-colors"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          Add document
        </button>
      )}
    </div>
  );
};
