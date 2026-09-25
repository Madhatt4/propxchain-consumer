// TA6 6th-edition form widget kit — shared building blocks for the 15
// section components. Import from this barrel:
//   import { ResponseField, SectionCard, makeTa6Uploader } from './widgets';

export { AnswerButtons } from './AnswerButtons';
export type { AnswerButtonsProps } from './AnswerButtons';

export { ResponseField } from './ResponseField';
export type { ResponseFieldProps } from './ResponseField';

export { DocumentSlot } from './DocumentSlot';
export type { DocumentSlotProps } from './DocumentSlot';

export { SectionCard } from './SectionCard';
export type { SectionCardProps } from './SectionCard';

export { TextField, OptionalTextField } from './TextFields';
export type { TextFieldProps, OptionalTextFieldProps } from './TextFields';

export { PromptHeader } from './PromptHeader';
export type { PromptHeaderProps } from './PromptHeader';

export { SegmentedButtons } from './SegmentedButtons';
export type { SegmentedButtonsProps } from './SegmentedButtons';

export { makeTa6Uploader, TA6_ATTACHMENT_DOC_TYPE } from './ta6Uploader';

export {
  ANSWER_LABELS,
  DEFAULT_ANSWER_OPTIONS,
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_STATUS_OPTIONS,
} from './types';
export type { TA6PromptEntry, TA6DocumentStatusChoice } from './types';
