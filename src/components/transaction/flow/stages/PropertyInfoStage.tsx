import { useState, useRef, useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Check, Upload, PenLine, Pencil } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { icpService } from '@/services/icp.service';
import { web2DocumentService } from '@/services/web2-document.service';
import { sha256Hex } from '@/utils/fileHash';
import { logger } from '@/utils/logger';
import type { StageConfig } from '../../../../types/stage.types';
import type { Tenure } from '../../../../types/listing.types';
import ExplainerCard from '../../../explainer/ExplainerCard';
import ExplainerModal from '../../../explainer/ExplainerModal';
import { CheckMyAnswers } from '../../../propertyInfo/CheckMyAnswers';
import PropertyInfoExplainerContent, {
  showsLeaseholdForm,
} from '../../../propertyInfo/PropertyInfoExplainerContent';

interface StageProps {
  stage: StageConfig;
  onComplete?: (stageId: string) => void;
  transactionId?: string;
  postcode?: string | null;
  propertyAddress?: string;
  /** Tenure from the listing. Used to hide the TA7 (Leasehold) form for
   *  freehold sales. Falsy / 'unknown' values fall through to showing TA7
   *  (safer to surface it than to hide it if we don't know). */
  tenure?: Tenure | null;
  readOnly?: boolean;
  /** True when the user has clicked Edit on a completed stage. Re-opens the
   *  form list with previously-saved completion state pre-populated from
   *  the canister so the user can revise any of TA6/TA10/TA7 individually. */
  isEditing?: boolean;
  /** Cancel out of edit mode without saving. */
  onCancelEdit?: () => void;
  /** Bumped by the parent after successful save so cards driven by the
   *  invalidationKey (NextStepCard, PhaseIndicator, PhaseChecklist) refetch. */
  onAfterEdit?: () => void;
  /** True when the viewer is the buyer browsing the seller journey. The
   *  canister only lets the seller side complete these forms, so buyers get
   *  a hint + read-only view instead of buttons that dead-end at the gate. */
  viewerIsBuyer?: boolean;
}

type FormId = 'ta6' | 'ta10' | 'ta7';

interface FormSection {
  id: FormId;
  label: string;
  description: string;
  required: boolean;
}

const ALL_FORMS: FormSection[] = [
  { id: 'ta6', label: 'TA6 Property Information Form', description: 'Boundaries, disputes, notices, alterations, services', required: true },
  { id: 'ta10', label: 'TA10 Fittings & Contents', description: 'What is included/excluded in the sale', required: true },
  { id: 'ta7', label: 'TA7 Leasehold Information', description: 'Service charges, ground rent, management company', required: false },
];

/** TA7 is leasehold-only. Hide it for freehold sales so the seller isn't
 *  presented with an inapplicable form. We keep the existing data model
 *  (FormId still includes 'ta7', canister calls unchanged) — this is a
 *  pure visibility filter. */
function visibleForms(tenure: Tenure | null | undefined): FormSection[] {
  if (tenure === 'freehold' || tenure === 'shareOfFreehold') {
    return ALL_FORMS.filter(f => f.id !== 'ta7');
  }
  return ALL_FORMS;
}

type CompletionMethod = 'online' | 'uploaded' | null;

interface FormCompletion {
  method: CompletionMethod;
  detail: string | null; // filename for upload, ISO date for online
}

/**
 * "Check my answers" runs against the answers saved on chain, so it is
 * offered only once they are there, and only for the two forms the check can
 * read. An uploaded PDF leaves nothing for it to read, and TA7 has no check.
 */
function offersCheck(formId: FormId, completion: FormCompletion): formId is 'ta6' | 'ta10' {
  return (formId === 'ta6' || formId === 'ta10') && completion.method === 'online';
}

export function PropertyInfoStage({ stage, onComplete, transactionId, postcode, propertyAddress, tenure, readOnly = false, isEditing = false, onCancelEdit, onAfterEdit, viewerIsBuyer = false }: StageProps): ReactNode {
  const FORMS = visibleForms(tenure);
  const { toast } = useToast();
  const navigate = useNavigate();
  const fileInputRefs = useRef<Record<FormId, HTMLInputElement | null>>({ ta6: null, ta10: null, ta7: null });

  const [completions, setCompletions] = useState<Record<FormId, FormCompletion>>({
    ta6: { method: null, detail: null },
    ta10: { method: null, detail: null },
    ta7: { method: null, detail: null },
  });

  const [uploading, setUploading] = useState<FormId | null>(null);
  // Form IDs touched during this edit session. Drives audit-event emission
  // on save — only forms the user actually re-saved get a `ta_form_edited`
  // event, not every form on the stage. Reset whenever edit mode toggles.
  const [editedInSession, setEditedInSession] = useState<Set<FormId>>(new Set());

  const isCompleted = stage.status === 'completed' && !isEditing;

  // Hydrate completion state from the canister on every mount and when
  // entering edit mode. The form pages save straight to the chain, and the
  // seller comes back here afterwards, so an online save must show as done
  // before the stage is submitted; hydrating only for a completed stage (as
  // this once did) left a saved TA6 unticked and sent sellers off to upload
  // a PDF they had already answered. Online-form data is queryable
  // (getTA6/TA10/TA7 -> null when never saved, otherwise the record).
  // Uploaded PDFs aren't queryable, so an upload-only completion will
  // appear unset until the user re-uploads: acceptable trade-off for v1.
  useEffect(() => {
    if (!transactionId) return;
    let cancelled = false;
    void (async () => {
      try {
        const [ta6, ta10, ta7] = await Promise.all([
          icpService.getTA6(transactionId),
          icpService.getTA10(transactionId),
          icpService.getTA7(transactionId),
        ]);
        if (cancelled) return;
        setCompletions((prev) => ({
          ta6: ta6 ? { method: 'online', detail: 'Previously saved' } : prev.ta6,
          ta10: ta10 ? { method: 'online', detail: 'Previously saved' } : prev.ta10,
          ta7: ta7 ? { method: 'online', detail: 'Previously saved' } : prev.ta7,
        }));
      } catch (err) {
        logger.warn('[stage3] hydrate failed:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [transactionId, isEditing, stage.status]);

  // Reset the edit-session change tracker whenever edit mode toggles.
  useEffect(() => {
    if (!isEditing) setEditedInSession(new Set());
  }, [isEditing]);

  if (isCompleted) {
    return (
      <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-sm font-medium">
        <Check className="h-4 w-4" />
        Property information forms submitted
      </div>
    );
  }

  const requiredForms = FORMS.filter((f) => f.required);
  const allRequiredComplete = requiredForms.every((f) => completions[f.id].method !== null);

  async function handleUpload(formId: FormId, file: File): Promise<void> {
    if (!transactionId) return;
    setUploading(formId);
    try {
      const hash = await sha256Hex(file);
      await web2DocumentService.uploadDocument(file, transactionId, formId);
      await icpService.recordFormUpload(transactionId, formId, hash, file.name);
      setCompletions((prev) => ({
        ...prev,
        [formId]: { method: 'uploaded', detail: file.name },
      }));
      if (isEditing) setEditedInSession((s) => new Set(s).add(formId));
      toast({ title: `${formId.toUpperCase()} uploaded`, description: file.name });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      toast({ title: 'Upload failed', description: msg, variant: 'destructive' });
    } finally {
      setUploading(null);
    }
  }

  function handleFileChange(formId: FormId, e: React.ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0];
    if (!file) return;
    void handleUpload(formId, file);
    // Reset so same file can be re-picked if needed
    e.target.value = '';
  }

  function handleSaveEdits(): void {
    if (!transactionId) {
      onCancelEdit?.();
      return;
    }
    // Emit one ta_form_edited event per form touched in this edit session.
    // Caller principal + timestamp are recorded server-side by ledger_manager.
    // Each updateTA6/TA10/TA7 call already lands on chain via the form
    // pages' save handlers — this event captures the "edit during a completed
    // stage" intent so the audit trail distinguishes initial fill from
    // post-completion revision.
    for (const formId of editedInSession) {
      void icpService.ledgerManager
        ?.logEvent(
          transactionId,
          'ta_form_edited',
          `${formId.toUpperCase()} updated in edit mode`,
          [JSON.stringify({ formId })],
        )
        .catch((err: unknown) => logger.warn('[stage3] logEvent failed', err));
    }
    onAfterEdit?.();
    onCancelEdit?.();
  }

  const explainerHeadline = `${showsLeaseholdForm(tenure) ? 3 : 2} standard forms · your answers are legally binding`;

  return (
    <div className="flex flex-col gap-3">
      {transactionId && !viewerIsBuyer && (
        <>
          <ExplainerModal
            storageKey="property-info"
            transactionId={transactionId}
            title="Before you start these forms"
            dismissLabel="Got it, show me the forms"
          >
            <PropertyInfoExplainerContent tenure={tenure} />
          </ExplainerModal>
          <ExplainerCard label="What these forms are &amp; why" headline={explainerHeadline}>
            <PropertyInfoExplainerContent tenure={tenure} />
          </ExplainerCard>
        </>
      )}

      {isEditing && (
        <div className="flex items-center gap-2 rounded-lg border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-900/20 px-3 py-2 text-sm text-teal-700 dark:text-teal-300">
          <Pencil className="h-4 w-4 shrink-0" />
          <span>You're editing this stage. Re-open any form to revise it, then click Save changes — or Cancel to discard.</span>
        </div>
      )}

      <p className="text-sm text-gray-600 dark:text-slate-300">
        {isEditing
          ? 'Click "Edit" on any form below to update previously-saved answers, or upload a new PDF.'
          : 'Complete each property information form online, or upload a pre-completed PDF.'}
      </p>

      {FORMS.map((form) => {
        const completion = completions[form.id];
        const isComplete = completion.method !== null;
        const isUploadingThis = uploading === form.id;

        return (
          <div
            key={form.id}
            className={`rounded-lg border transition-colors ${
              isComplete
                ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20'
                : 'border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50'
            }`}
          >
            {/* Header row */}
            <div className="flex items-center gap-3 px-4 py-3">
              <div className={`w-6 h-6 rounded flex items-center justify-center shrink-0 ${
                isComplete ? 'bg-emerald-500 text-white' : 'bg-gray-200 dark:bg-slate-700 text-gray-500 dark:text-slate-400'
              }`}>
                {isComplete ? <Check className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className={`text-sm font-medium ${isComplete ? 'text-emerald-700 dark:text-emerald-300' : 'text-gray-800 dark:text-gray-200'}`}>
                    {form.label}
                  </p>
                  {!form.required && (
                    <span className="text-xs text-gray-400 dark:text-slate-500 bg-gray-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">Optional</span>
                  )}
                </div>
                {isComplete ? (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {completion.method === 'online'
                      ? `Filled online — ${completion.detail}`
                      : `Uploaded: ${completion.detail}`}
                  </p>
                ) : (
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{form.description}</p>
                )}
              </div>
            </div>

            {/* Buyers browsing the seller journey can't complete seller
                forms (the canister rejects them) — show why, and offer a
                read-only view of the TA6 once the seller has saved it. */}
            {viewerIsBuyer && !readOnly && (
              <div className="px-4 pb-3 flex items-center gap-2">
                <p className="flex-1 text-xs text-gray-500 dark:text-slate-400">
                  The seller (or their solicitor) completes this form.
                </p>
                {completion.method === 'online' && (
                  <button
                    type="button"
                    disabled={!transactionId}
                    onClick={() =>
                      navigate(`/transaction/${transactionId}/forms/${form.id}`, {
                        state: { postcode, propertyAddress, readOnly: true },
                      })
                    }
                    className="px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 text-xs font-medium hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                  >
                    View the seller's answers
                  </button>
                )}
              </div>
            )}

            {/* Action buttons. In edit mode they remain visible even when
                the form is "complete" so the user can revise it. The Fill
                online button changes copy from "Fill form online" to
                "Edit form" once a form is already saved. */}
            {(!isComplete || isEditing) && !readOnly && !viewerIsBuyer && (
              <div className="px-4 pb-3 flex gap-2">
                <button
                  type="button"
                  disabled={!transactionId}
                  onClick={() => {
                    // All three seller forms live on full pages now; the stage
                    // only shows TA7 for leasehold tenures, so the page can
                    // assume leasehold.
                    if (form.id === 'ta6') {
                      navigate(`/transaction/${transactionId}/forms/ta6`, {
                        state: { postcode, propertyAddress },
                      });
                    } else if (form.id === 'ta10') {
                      navigate(`/transaction/${transactionId}/forms/ta10`, {
                        state: { propertyAddress },
                      });
                    } else {
                      navigate(`/transaction/${transactionId}/forms/ta7`, {
                        state: { postcode, propertyAddress, isLeasehold: true },
                      });
                    }
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-teal-300 dark:border-teal-700 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 text-xs font-medium hover:bg-teal-100 dark:hover:bg-teal-900/30 transition-colors disabled:opacity-50"
                >
                  <PenLine className="h-3.5 w-3.5" />
                  {isComplete ? 'Edit form' : 'Fill form online'}
                </button>

                <button
                  type="button"
                  disabled={!transactionId || isUploadingThis}
                  onClick={() => fileInputRefs.current[form.id]?.click()}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 text-xs font-medium hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                >
                  {isUploadingThis ? (
                    <><div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-gray-500" /> Uploading…</>
                  ) : (
                    <><Upload className="h-3.5 w-3.5" /> {isComplete ? 'Replace upload' : 'Upload completed form'}</>
                  )}
                </button>

                {/* Hidden file input */}
                <input
                  ref={(el) => { fileInputRefs.current[form.id] = el; }}
                  type="file"
                  accept="application/pdf,image/*"
                  className="hidden"
                  onChange={(e) => handleFileChange(form.id, e)}
                  aria-label={`Upload ${form.label}`}
                />
              </div>
            )}

            {/* Advisory pre-submit check on the seller's own saved answers.
                It never gates the submit button below and never changes what
                is on chain — the seller reads it and decides. */}
            {transactionId && !readOnly && !viewerIsBuyer && offersCheck(form.id, completion) && (
              <CheckMyAnswers
                transactionId={transactionId}
                form={form.id}
                navState={{ postcode, propertyAddress }}
              />
            )}
          </div>
        );
      })}

      {/* Submit / save bar. In edit mode: always visible with Cancel + Save
          changes. Outside edit mode: only when all required forms are
          complete, single Submit button. */}
      {isEditing ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancelEdit}
            className="px-4 py-2.5 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 text-sm font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveEdits}
            className="flex-1 px-4 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold transition-colors"
          >
            Save changes
          </button>
        </div>
      ) : allRequiredComplete && (
        <button
          type="button"
          onClick={() => onComplete?.(stage.id)}
          className="w-full px-4 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold transition-colors"
        >
          Submit All Forms & Continue
        </button>
      )}
    </div>
  );
}
