import { useEffect, useRef, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  open: boolean;
  title: string;
  message: string;
  /** Affirmative button label. Default: "Yes, continue". */
  confirmLabel?: string;
  /** Cancel button label. Default: "Cancel". */
  cancelLabel?: string;
  /** Tone of the confirm button. `danger` for destructive ops (the
   *  default — fits "this cancels your quote request" copy), `primary`
   *  for non-destructive confirmations. */
  tone?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Modal that gates destructive edits — used when changing a provider
 * selection mid-transaction will cancel an in-flight quote request, when
 * editing a signed document means re-signing, etc. The user must
 * explicitly confirm before the action proceeds.
 */
export function ConfirmEditDialog({
  open,
  title,
  message,
  confirmLabel = 'Yes, continue',
  cancelLabel = 'Cancel',
  tone = 'danger',
  onConfirm,
  onCancel,
}: Props): ReactNode {
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  // Esc to cancel + focus the cancel button on open (safer default than
  // focusing the destructive confirm).
  useEffect(() => {
    if (!open) return;
    cancelBtnRef.current?.focus();
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  const confirmClass = tone === 'danger'
    ? 'bg-rose-600 hover:bg-rose-700'
    : 'bg-teal-600 hover:bg-teal-700';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-edit-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white dark:bg-slate-800 shadow-xl border border-gray-200 dark:border-slate-700"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5">
          <div className="flex gap-3">
            <div className="shrink-0 h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1">
              <h3 id="confirm-edit-title" className="font-display text-lg text-gray-900 dark:text-gray-100">
                {title}
              </h3>
              <p className="mt-1 font-sans text-sm text-gray-600 dark:text-slate-300">
                {message}
              </p>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 pb-5">
          <button
            ref={cancelBtnRef}
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 text-sm font-semibold transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg text-white text-sm font-semibold transition-colors ${confirmClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
