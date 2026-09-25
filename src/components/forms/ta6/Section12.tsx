import React from 'react';

import { MeteredRow, PlantRow, ServiceRow, WaterRow } from './Section12Rows';
import { PromptHeader } from './widgets/PromptHeader';
import { SECTION_12_PROMPTS } from '../../../lib/ta6-prompts/section12';
import type { TA6SectionProps } from './section-props';
import type { TA6PromptEntry } from './widgets/types';
import type { TA6Section12Connections } from '../../../types/ta6.types';

function promptFor(ref: string): TA6PromptEntry | undefined {
  return SECTION_12_PROMPTS.find((p) => p.ref === ref);
}

// §12 has no numbered sub-questions — the grid rows use the synthetic
// "12.<service>" prompt keys (see forms_types.mo §12 verification note).
interface GridProps {
  value: TA6Section12Connections;
  onChange: (next: TA6Section12Connections) => void;
  readOnly: boolean;
}

const MainsRows: React.FC<GridProps> = ({ value, onChange, readOnly }) => (
  <>
    <MeteredRow
      refCode="12.electricity"
      prompt={promptFor('12.electricity')}
      value={value.mainsElectricity}
      onChange={(mainsElectricity) => onChange({ ...value, mainsElectricity })}
      readOnly={readOnly}
    />
    <MeteredRow
      refCode="12.gas"
      prompt={promptFor('12.gas')}
      value={value.mainsGas}
      onChange={(mainsGas) => onChange({ ...value, mainsGas })}
      readOnly={readOnly}
    />
    <WaterRow
      refCode="12.water"
      prompt={promptFor('12.water')}
      value={value.mainsWater}
      onChange={(mainsWater) => onChange({ ...value, mainsWater })}
      readOnly={readOnly}
    />
    <ServiceRow
      refCode="12.sewerage"
      prompt={promptFor('12.sewerage')}
      value={value.mainsSewerage}
      onChange={(mainsSewerage) => onChange({ ...value, mainsSewerage })}
      readOnly={readOnly}
    />
  </>
);

const PlantAndCommsRows: React.FC<GridProps> = ({ value, onChange, readOnly }) => (
  <>
    <PlantRow
      refCode="12.treatment-plant"
      prompt={promptFor('12.treatment-plant')}
      value={value.smallSewageTreatmentPlant}
      onChange={(smallSewageTreatmentPlant) => onChange({ ...value, smallSewageTreatmentPlant })}
      readOnly={readOnly}
    />
    <PlantRow
      refCode="12.heat-pumps"
      prompt={promptFor('12.heat-pumps')}
      value={value.sharedHeatPumps}
      onChange={(sharedHeatPumps) => onChange({ ...value, sharedHeatPumps })}
      readOnly={readOnly}
    />
    <ServiceRow
      refCode="12.telephone"
      prompt={promptFor('12.telephone')}
      value={value.telephone}
      onChange={(telephone) => onChange({ ...value, telephone })}
      readOnly={readOnly}
    />
    <ServiceRow
      refCode="12.broadband"
      prompt={promptFor('12.broadband')}
      value={value.broadband}
      onChange={(broadband) => onChange({ ...value, broadband })}
      readOnly={readOnly}
    />
  </>
);

const OtherServices: React.FC<GridProps> = ({ value, onChange, readOnly }) => (
  <div className="space-y-2">
    <PromptHeader refCode="12.other" prompt={promptFor('12.other')} />
    <textarea
      aria-label="12.other details"
      value={value.otherServices ?? ''}
      onChange={(e) => onChange({ ...value, otherServices: e.target.value === '' ? null : e.target.value })}
      disabled={readOnly}
      rows={3}
      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder:text-gray-400"
      placeholder="e.g. oil, LPG or a communal energy scheme..."
    />
  </div>
);

/** TA6 §12 — Connection to services grid (schema: Section12Connections). */
export const Section12: React.FC<TA6SectionProps<TA6Section12Connections>> = ({
  value,
  onChange,
  readOnly,
}) => (
  <div className="space-y-6">
    <MainsRows value={value} onChange={onChange} readOnly={readOnly} />
    <PlantAndCommsRows value={value} onChange={onChange} readOnly={readOnly} />
    <OtherServices value={value} onChange={onChange} readOnly={readOnly} />
  </div>
);
