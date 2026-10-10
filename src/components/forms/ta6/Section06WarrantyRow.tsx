import React from 'react';

import { AnswerButtons } from './widgets/AnswerButtons';
import { DocumentSlot } from './widgets/DocumentSlot';
import { PromptHeader } from './widgets/PromptHeader';
import type { TA6PromptEntry } from './widgets/types';
import { isWarrantyType } from '../../../services/docClassify.service';
import type { DocScanContext } from '../../../services/docClassify.service';
import type { TA6WarrantyItem } from '../../../types/ta6.types';
import type { TA6UploadFile } from './section-props';

export interface Section06WarrantyRowProps {
  /** Question ref for the row, e.g. '6.1.roofing'; the slot uses `<ref>.doc`. */
  refBase: string;
  answerPrompt: TA6PromptEntry | undefined;
  documentPrompt: TA6PromptEntry | undefined;
  value: TA6WarrantyItem;
  onChange: (next: TA6WarrantyItem) => void;
  readOnly: boolean;
  uploadFile?: TA6UploadFile;
}

/**
 * One §6.1 checklist row: is this warranty present + the certificate slot.
 * The slot appears when the answer is 'yes' and stays visible while it holds
 * any non-draft status, so an answer change never hides recorded paperwork.
 */
export const Section06WarrantyRow: React.FC<Section06WarrantyRowProps> = ({
  refBase,
  answerPrompt,
  documentPrompt,
  value,
  onChange,
  readOnly,
  uploadFile,
}) => {
  const showDocument = value.present === 'yes' || value.document.status !== 'not-answered';
  // The ref suffix IS the warranty type ('6.1.roofing' -> 'roofing'), the
  // same closed vocabulary the function validates against.
  const warrantyType = refBase.slice(refBase.lastIndexOf('.') + 1);
  const scanContext: DocScanContext | undefined = isWarrantyType(warrantyType)
    ? { section: '6.1', warrantyType }
    : undefined;

  return (
    <div className="py-4 first:pt-0 last:pb-0 space-y-2">
      <PromptHeader refCode={refBase} prompt={answerPrompt} />
      <AnswerButtons
        value={value.present}
        onChange={(present) => onChange({ ...value, present })}
        readOnly={readOnly}
        label={`${refBase} answer`}
      />
      {showDocument && (
        <div className="pl-4 border-l-2 border-gray-100">
          <DocumentSlot
            refCode={`${refBase}.doc`}
            prompt={documentPrompt}
            value={value.document}
            onChange={(document) => onChange({ ...value, document })}
            readOnly={readOnly}
            onUpload={uploadFile}
            scanContext={scanContext}
          />
        </div>
      )}
    </div>
  );
};
