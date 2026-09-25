import React from 'react';

import { SegmentedButtons } from './SegmentedButtons';
import { ANSWER_LABELS, DEFAULT_ANSWER_OPTIONS } from './types';
import type { TA6AnswerValue } from '../../../../types/ta6.types';

export interface AnswerButtonsProps {
  value: TA6AnswerValue;
  onChange: (value: TA6AnswerValue) => void;
  readOnly?: boolean;
  /** Defaults to yes / no / not-known; pass to add e.g. 'not-applicable'. */
  options?: TA6AnswerValue[];
  /** Accessible name for the button group (defaults to 'Answer'). */
  label?: string;
}

/**
 * Segmented yes / no / not-known row. 'Not known' is a first-class button —
 * a legal TA6 answer in its own right, never hidden in a dropdown.
 * 'not-answered' (draft marker) is never rendered as a button; a draft
 * question simply shows with nothing pressed.
 */
export const AnswerButtons: React.FC<AnswerButtonsProps> = ({
  value,
  onChange,
  readOnly = false,
  options,
  label = 'Answer',
}) => (
  <SegmentedButtons
    options={options ?? DEFAULT_ANSWER_OPTIONS}
    labels={ANSWER_LABELS}
    value={value}
    onSelect={onChange}
    disabled={readOnly}
    label={label}
  />
);
