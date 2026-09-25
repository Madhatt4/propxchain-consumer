// Shared prop contract for the 15 TA6 6th-edition section components
// (Section01..Section15). Each section receives its slice of
// TA6PropertyInformation and reports edits upward — the shell owns state.
export interface TA6SectionProps<T> {
  value: T;
  onChange: (next: T) => void;
  readOnly: boolean;
  /** Resolves a picked file to a document_storage documentId (DocumentSlot uploads). */
  uploadFile?: (file: File) => Promise<string>;
}
