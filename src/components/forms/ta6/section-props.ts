// Shared prop contract for the 15 TA6 6th-edition section components
// (Section01..Section15). Each section receives its slice of
// TA6PropertyInformation and reports edits upward — the shell owns state.
import type { TA6Upload } from './widgets/ta6Uploader';

/** Resolves a picked file to its document_storage documentId plus an advisory line (DocumentSlot uploads). */
export type TA6UploadFile = (file: File) => Promise<TA6Upload>;

export interface TA6SectionProps<T> {
  value: T;
  onChange: (next: T) => void;
  readOnly: boolean;
  uploadFile?: TA6UploadFile;
}
