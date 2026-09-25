import React from 'react';

import { Section11Drainage } from './Section11Drainage';
import { Section11Electrics } from './Section11Electrics';
import { HeatingSystemsEditor } from './Section11Heating';
import type { TA6SectionProps } from './section-props';
import type { TA6Section11Services } from '../../../types/ta6.types';

/**
 * TA6 §11 — Services (schema: Section11Services, forms_types.mo).
 * Composes three sibling blocks kept in their own files for the size caps:
 * electrics (11.1–11.3), heating systems (11.4) and drainage (11.5–11.7).
 */
export const Section11: React.FC<TA6SectionProps<TA6Section11Services>> = ({
  value,
  onChange,
  readOnly,
  uploadFile,
}) => (
  <div className="space-y-6">
    <Section11Electrics value={value} onChange={onChange} readOnly={readOnly} uploadFile={uploadFile} />
    <HeatingSystemsEditor
      systems={value.q11_4HeatingSystems}
      onChange={(q11_4HeatingSystems) => onChange({ ...value, q11_4HeatingSystems })}
      readOnly={readOnly}
      uploadFile={uploadFile}
    />
    <Section11Drainage value={value} onChange={onChange} readOnly={readOnly} />
  </div>
);
