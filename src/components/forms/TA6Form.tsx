// TA6 Property Information Form — 6th edition shell.
//
// A 15-step stepper matching the official Law Society form 1:1. Each section
// renders inside a SectionCard with its own Save button; saving serialises the
// WHOLE form (the canister stores one record) but only clears that section's
// dirty flag. An acknowledgment gate blocks editing until the seller confirms
// they understand PropXchain paraphrases the official wording. Section 1 is
// prefilled from the listing when empty, with its jurisdiction derived from the
// postcode. Cross-reference anomalies arrive via the `anomalies` prop and are
// placed on the section whose number leads each ref.

import { useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { ExternalLink } from 'lucide-react';

import { logger } from '@/utils/logger';
import { jurisdictionFromPostcode } from '@/lib/jurisdiction';

import { FormExportButton } from './FormExportButton';
import { AcknowledgmentGate } from './ta6/AcknowledgmentGate';
import { ActiveSection } from './ta6/ActiveSection';
import { SectionHelpCard } from './ta6/SectionHelpCard';
import { StepAnomalyFlag } from './ta6/StepAnomalyFlag';
import type { StepAnomaly } from './ta6/StepAnomalyFlag';
import { StepperNav } from './ta6/StepperNav';
import type { StepperStep } from './ta6/StepperNav';
import { SectionCard } from './ta6/widgets/SectionCard';
import { TA6_SECTION_TITLES, TA6_STEP_COUNT, isSectionComplete, stepForRef } from './ta6/sectionMeta';
import { TA6_OFFICIAL_FORM_URL } from '../../lib/ta6-prompts/types';
import { calculateTA6Completion, emptyTA6Form } from '../../types/ta6.types';
import type { TA6PropertyInformation } from '../../types/ta6.types';
import type { PropertyListing } from '../../types/listing.types';
import { prefillTa6FromListing } from '../../services/taFormsPrefill';

export interface TA6FormProps {
  transactionId: string;
  initialData?: TA6PropertyInformation | null;
  onSave: (data: TA6PropertyInformation) => Promise<void>;
  readOnly?: boolean;
  /** Property address shown in the exported PDF header and used to prefill §1. */
  propertyAddress?: string;
  /** Postcode used to prefill §1 and derive the jurisdiction. */
  postcode?: string | null;
  /** The transaction's listing: fills §1 blanks (UPRN, and address/postcode
   *  when the caller passed none). Blanks only. */
  listing?: PropertyListing | null;
  /** Whether the caller has acknowledged the official-wording notice. Explicit
   *  false (editable form) blocks with the gate; undefined never blocks. */
  hasAcknowledged?: boolean;
  onAcknowledge?: () => Promise<void>;
  /** Resolves a picked file to a document_storage documentId (DocumentSlots). */
  uploadFile?: (file: File) => Promise<string>;
  /** Server-side cross-reference anomalies keyed to question refs. */
  anomalies?: StepAnomaly[];
  /** 1-based section to open on. A "Check my answers" flag links to the
   *  section it is about, so the seller lands there rather than on §1. Out of
   *  range or absent falls back to §1. */
  initialStep?: number;
}

/** A deep link is user input: an unusable step opens the form at the start. */
function openingStep(step: number | undefined): number {
  if (step === undefined || !Number.isInteger(step) || step < 1 || step > TA6_STEP_COUNT) return 1;
  return step;
}

// A record whose shape predates the 15-section model (stale localStorage or a
// legacy transaction payload) must not reach the section components.
function isNewShape(data: TA6PropertyInformation | null | undefined): data is TA6PropertyInformation {
  return !!data && typeof data === 'object' && 'section1' in data && 'section15' in data;
}

// §1 prefill: fill an untouched address from the listing props and derive its
// jurisdiction from the postcode. Returns the (possibly) patched form plus
// whether a prefill happened, so the shell can flag §1 dirty and show a banner.
function buildInitial(
  initialData: TA6PropertyInformation | null | undefined,
  propertyAddress?: string,
  postcode?: string | null,
  listing?: PropertyListing | null,
): { form: TA6PropertyInformation; prefilled: boolean } {
  const base = isNewShape(initialData) ? initialData : emptyTA6Form();
  const addr = (propertyAddress ?? '').trim();
  let form = base;
  let prefilled = false;
  if (base.section1.propertyAddress.trim().length === 0 && addr.length > 0) {
    const pc = (postcode ?? '').trim();
    form = {
      ...base,
      jurisdiction: jurisdictionFromPostcode(pc) ?? base.jurisdiction,
      section1: { ...base.section1, propertyAddress: addr, postcode: pc || base.section1.postcode },
    };
    prefilled = true;
  }
  // The listing fills whatever is still blank (UPRN, or the address itself
  // when the page was opened without navigation state).
  const fromListing = prefillTa6FromListing(form, listing ?? null);
  if (fromListing.filled.length > 0) {
    form = fromListing.form;
    prefilled = true;
    const pc = form.section1.postcode.trim();
    if (pc) form = { ...form, jurisdiction: jurisdictionFromPostcode(pc) ?? form.jurisdiction };
  }
  return { form, prefilled };
}

const TA6Form = ({
  transactionId,
  initialData,
  onSave,
  readOnly = false,
  propertyAddress,
  postcode,
  listing,
  hasAcknowledged,
  onAcknowledge,
  uploadFile,
  anomalies = [],
  initialStep,
}: TA6FormProps): ReactElement => {
  const [{ form: seedForm, prefilled }] = useState(() =>
    buildInitial(initialData, propertyAddress, postcode, listing),
  );
  const [formData, setFormData] = useState<TA6PropertyInformation>(seedForm);
  const [activeStep, setActiveStep] = useState(() => openingStep(initialStep));
  const [dirtySteps, setDirtySteps] = useState<ReadonlySet<number>>(
    () => (prefilled ? new Set([1]) : new Set<number>()),
  );
  const [savingStep, setSavingStep] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const steps = useMemo<StepperStep[]>(
    () =>
      TA6_SECTION_TITLES.map((title, i) => {
        const step = i + 1;
        return {
          step,
          title,
          complete: isSectionComplete(formData, step),
          dirty: dirtySteps.has(step),
          anomalyCount: anomalies.filter((a) => stepForRef(a.ref) === step).length,
        };
      }),
    [formData, dirtySteps, anomalies],
  );

  const activeAnomalies = useMemo(
    () => anomalies.filter((a) => stepForRef(a.ref) === activeStep),
    [anomalies, activeStep],
  );

  const handleSectionChange = (next: TA6PropertyInformation): void => {
    setFormData({ ...next, lastModifiedAt: new Date().toISOString() });
    setDirtySteps((prev) => new Set(prev).add(activeStep));
  };

  const handleSaveSection = async (): Promise<void> => {
    if (readOnly) return;
    setSavingStep(activeStep);
    setSaveError(null);
    try {
      await onSave(formData);
      setDirtySteps((prev) => {
        const updated = new Set(prev);
        updated.delete(activeStep);
        return updated;
      });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save section');
      logger.error('TA6 section save error:', err);
    } finally {
      setSavingStep(null);
    }
  };

  if (hasAcknowledged === false && !readOnly && onAcknowledge) {
    return <AcknowledgmentGate onAcknowledge={onAcknowledge} />;
  }

  const activeTitle = TA6_SECTION_TITLES[activeStep - 1] ?? '';

  const completion = calculateTA6Completion(formData);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-slate-100">
              Tell us about your property
            </h2>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-slate-400">
              TA6 Property Information Form (6th edition)
            </p>
            <a
              href={TA6_OFFICIAL_FORM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-gray-400 transition-colors hover:text-teal-600 dark:text-slate-500 dark:hover:text-teal-400"
            >
              Read the official Law Society form
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          </div>
          <FormExportButton
            payload={{ formType: 'TA6', data: formData }}
            context={{ propertyAddress: propertyAddress ?? '', transactionId }}
            filename={`TA6-${transactionId}`}
          />
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-gray-500 dark:text-slate-400">
            <span>Your progress</span>
            <span>{completion}% complete</span>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-slate-800"
            role="progressbar"
            aria-valuenow={completion}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="TA6 completion"
          >
            <div
              className="h-full rounded-full bg-teal-500 transition-[width] duration-300"
              style={{ width: `${completion}%` }}
            />
          </div>
        </div>
        <StepperNav steps={steps} activeStep={activeStep} onSelect={setActiveStep} />
      </div>

      {prefilled && activeStep === 1 && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-relaxed text-blue-800 dark:border-blue-900 dark:bg-blue-900/20 dark:text-blue-300">
          Some details were prepopulated from the listing. Prepopulated information must be
          checked by the seller.
        </div>
      )}

      <SectionHelpCard section={activeStep} />

      <SectionCard
        index={activeStep}
        title={activeTitle}
        complete={isSectionComplete(formData, activeStep)}
        dirty={dirtySteps.has(activeStep)}
        saving={savingStep === activeStep}
        onSave={() => void handleSaveSection()}
        readOnly={readOnly}
      >
        {activeAnomalies.length > 0 && (
          <div className="space-y-2">
            {activeAnomalies.map((anomaly) => (
              <StepAnomalyFlag key={anomaly.ref} anomaly={anomaly} />
            ))}
          </div>
        )}
        <ActiveSection
          step={activeStep}
          form={formData}
          onChange={handleSectionChange}
          readOnly={readOnly}
          uploadFile={uploadFile}
        />
      </SectionCard>

      {saveError && (
        <p className="text-sm text-red-600" role="alert">
          {saveError}
        </p>
      )}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setActiveStep((s) => Math.max(1, s - 1))}
          disabled={activeStep === 1}
          className="rounded-full border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 transition-colors duration-200 hover:bg-gray-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Previous
        </button>
        <span className="text-sm font-medium text-gray-500 dark:text-slate-400">
          Section {activeStep} of {TA6_STEP_COUNT}
        </span>
        <button
          type="button"
          onClick={() => setActiveStep((s) => Math.min(TA6_STEP_COUNT, s + 1))}
          disabled={activeStep === TA6_STEP_COUNT}
          className="rounded-full bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-teal-700 disabled:opacity-40"
        >
          Next section
        </button>
      </div>
    </div>
  );
};

export default TA6Form;
