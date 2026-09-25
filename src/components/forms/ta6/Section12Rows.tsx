// TA6 §12 grid row editors — one component per connection record shape
// (forms_types.mo: ServiceConnection / MeteredConnection / WaterConnection /
// ServicedPlantConnection). §12 answers are yes/no on the form, so the
// buttons are constrained accordingly. Detail fields appear when connected
// (and stay visible while any detail holds text, so data is never hidden).

import React from 'react';

import { AnswerButtons } from './widgets/AnswerButtons';
import { PromptHeader } from './widgets/PromptHeader';
import { OptionalTextField } from './widgets/TextFields';
import type { TA6PromptEntry } from './widgets/types';
import type {
  TA6AnswerValue,
  TA6MeteredConnection,
  TA6ServiceConnection,
  TA6ServicedPlantConnection,
  TA6WaterConnection,
} from '../../../types/ta6.types';

const YES_NO: TA6AnswerValue[] = ['yes', 'no'];

function hasDetail(...values: (string | null)[]): boolean {
  return values.some((v) => v !== null);
}

function fieldId(refCode: string, field: string): string {
  return `ta6-${refCode.replace(/\./g, '-')}-${field}`;
}

interface RowShellProps {
  refCode: string;
  prompt: TA6PromptEntry | undefined;
  connected: TA6AnswerValue;
  onAnswer: (next: TA6AnswerValue) => void;
  readOnly: boolean;
  showDetails: boolean;
  children: React.ReactNode;
}

const RowShell: React.FC<RowShellProps> = ({
  refCode,
  prompt,
  connected,
  onAnswer,
  readOnly,
  showDetails,
  children,
}) => (
  <div role="group" aria-label={`${refCode} connection`} className="space-y-2">
    <PromptHeader refCode={refCode} prompt={prompt} />
    <AnswerButtons
      value={connected}
      onChange={onAnswer}
      readOnly={readOnly}
      options={YES_NO}
      label={`${refCode} answer`}
    />
    {showDetails && <div className="grid gap-3 sm:grid-cols-2">{children}</div>}
  </div>
);

interface RowProps<T> {
  refCode: string;
  prompt: TA6PromptEntry | undefined;
  value: T;
  onChange: (next: T) => void;
  readOnly: boolean;
}

/** Plain row (mains sewerage, telephone, broadband): provider only. */
export const ServiceRow: React.FC<RowProps<TA6ServiceConnection>> = ({
  refCode,
  prompt,
  value,
  onChange,
  readOnly,
}) => (
  <RowShell
    refCode={refCode}
    prompt={prompt}
    connected={value.connected}
    onAnswer={(connected) => onChange({ ...value, connected })}
    readOnly={readOnly}
    showDetails={value.connected === 'yes' || hasDetail(value.provider)}
  >
    <OptionalTextField
      id={fieldId(refCode, 'provider')}
      label="Provider"
      value={value.provider}
      onChange={(provider) => onChange({ ...value, provider })}
      readOnly={readOnly}
    />
  </RowShell>
);

/** Metered row (electricity, gas): provider + meter location + MPAN/MPRN. */
export const MeteredRow: React.FC<RowProps<TA6MeteredConnection>> = ({
  refCode,
  prompt,
  value,
  onChange,
  readOnly,
}) => (
  <RowShell
    refCode={refCode}
    prompt={prompt}
    connected={value.connected}
    onAnswer={(connected) => onChange({ ...value, connected })}
    readOnly={readOnly}
    showDetails={
      value.connected === 'yes' || hasDetail(value.provider, value.meterLocation, value.supplyNumber)
    }
  >
    <OptionalTextField
      id={fieldId(refCode, 'provider')}
      label="Provider"
      value={value.provider}
      onChange={(provider) => onChange({ ...value, provider })}
      readOnly={readOnly}
    />
    <OptionalTextField
      id={fieldId(refCode, 'meter-location')}
      label="Meter location"
      value={value.meterLocation}
      onChange={(meterLocation) => onChange({ ...value, meterLocation })}
      readOnly={readOnly}
    />
    <OptionalTextField
      id={fieldId(refCode, 'supply-number')}
      label="Supply number (MPAN/MPRN)"
      value={value.supplyNumber}
      onChange={(supplyNumber) => onChange({ ...value, supplyNumber })}
      readOnly={readOnly}
    />
  </RowShell>
);

/** Water row: provider + stopcock location + meter location. */
export const WaterRow: React.FC<RowProps<TA6WaterConnection>> = ({
  refCode,
  prompt,
  value,
  onChange,
  readOnly,
}) => (
  <RowShell
    refCode={refCode}
    prompt={prompt}
    connected={value.connected}
    onAnswer={(connected) => onChange({ ...value, connected })}
    readOnly={readOnly}
    showDetails={
      value.connected === 'yes' ||
      hasDetail(value.provider, value.stopcockLocation, value.meterLocation)
    }
  >
    <OptionalTextField
      id={fieldId(refCode, 'provider')}
      label="Provider"
      value={value.provider}
      onChange={(provider) => onChange({ ...value, provider })}
      readOnly={readOnly}
    />
    <OptionalTextField
      id={fieldId(refCode, 'stopcock')}
      label="Stopcock location"
      value={value.stopcockLocation}
      onChange={(stopcockLocation) => onChange({ ...value, stopcockLocation })}
      readOnly={readOnly}
    />
    <OptionalTextField
      id={fieldId(refCode, 'meter-location')}
      label="Meter location"
      value={value.meterLocation}
      onChange={(meterLocation) => onChange({ ...value, meterLocation })}
      readOnly={readOnly}
    />
  </RowShell>
);

/** Serviced plant row (treatment plant, shared heat pumps): make/model + servicer. */
export const PlantRow: React.FC<RowProps<TA6ServicedPlantConnection>> = ({
  refCode,
  prompt,
  value,
  onChange,
  readOnly,
}) => (
  <RowShell
    refCode={refCode}
    prompt={prompt}
    connected={value.connected}
    onAnswer={(connected) => onChange({ ...value, connected })}
    readOnly={readOnly}
    showDetails={
      value.connected === 'yes' ||
      hasDetail(value.provider, value.makeModel, value.serviceProvider)
    }
  >
    <OptionalTextField
      id={fieldId(refCode, 'provider')}
      label="Provider"
      value={value.provider}
      onChange={(provider) => onChange({ ...value, provider })}
      readOnly={readOnly}
    />
    <OptionalTextField
      id={fieldId(refCode, 'make-model')}
      label="Make and model"
      value={value.makeModel}
      onChange={(makeModel) => onChange({ ...value, makeModel })}
      readOnly={readOnly}
    />
    <OptionalTextField
      id={fieldId(refCode, 'service-provider')}
      label="Serviced by"
      value={value.serviceProvider}
      onChange={(serviceProvider) => onChange({ ...value, serviceProvider })}
      readOnly={readOnly}
    />
  </RowShell>
);
