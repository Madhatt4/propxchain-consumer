import React from 'react';
import { Plus, Trash2 } from 'lucide-react';

import { Section05DocumentRow } from './Section05DocumentRow';
import { PromptHeader } from './widgets/PromptHeader';
import { SECTION_05_PROMPTS } from '../../../lib/ta6-prompts/section05';
import { emptyAlterationDocument } from '../../../types/ta6.types';
import type { TA6AlterationDocument, TA6AlterationTypes } from '../../../types/ta6.types';
import type { TA6UploadFile } from './section-props';

export interface Section05DocumentsProps {
  value: TA6AlterationDocument[];
  onChange: (next: TA6AlterationDocument[]) => void;
  /** The 5.1 tick-set each row may point at. */
  alterations: TA6AlterationTypes;
  readOnly: boolean;
  uploadFile?: TA6UploadFile;
}

// Ghost row shown when no documents exist yet — same defaults the Add button
// appends. It joins the form value only on the first interaction.
const EMPTY_DOCUMENT_ROW: TA6AlterationDocument = emptyAlterationDocument();

/**
 * §5.2 paperwork for the alterations ticked in 5.1 — a variable-length list
 * of rows (what it is, which change, the slot) with add/remove controls.
 * Rows are positional (5.2.1, 5.2.2, ...); the on-chain shape is [AlterationDocument].
 */
export const Section05Documents: React.FC<Section05DocumentsProps> = ({
  value,
  onChange,
  alterations,
  readOnly,
  uploadFile,
}) => {
  // Ghost row: an open first slot renders without a click, but the form value
  // stays [] until the user interacts (setRow writes through the ghost).
  const displayRows = value.length > 0 ? value : readOnly ? [] : [EMPTY_DOCUMENT_ROW];

  const setRow = (index: number) => (next: TA6AlterationDocument): void => {
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
            <Section05DocumentRow
              index={index}
              value={doc}
              alterations={alterations}
              onChange={setRow(index)}
              readOnly={readOnly}
              uploadFile={uploadFile}
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
          onClick={() => onChange([...value, emptyAlterationDocument()])}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 border border-blue-200 rounded-md hover:bg-blue-50 transition-colors"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          Add document
        </button>
      )}
    </div>
  );
};
