import { cloneElement, isValidElement, useId, useState, type ReactElement, type ReactNode, type ChangeEvent } from 'react';
import type { Tenure } from '../../../../types/listing.types';
import { cn } from '../../../../lib/utils';
import HMLRTitlePullButton from '../../HMLRTitlePullButton';
import TitleNumberFinder from '../../TitleNumberFinder';
import { usePrefillReview, PrefilledChip, PREFILLED_INPUT_CLASS } from './usePrefillReview';

/**
 * Editable shape used by the form. Mirrors the structured-address fields on
 * PropertyListing plus a couple of stage-1 specifics (price, tenure, lease
 * details). Extra optional fields (description, agent, etc.) are not edited
 * here — they're populated by the URL import and pass through unchanged.
 */
export interface PropertyDetailsValue {
  addressLine1: string;
  addressLine2?: string;
  town: string;
  county?: string;
  postcode: string;
  titleNumber: string;
  /** Unique Property Reference Number — optional, 1–12 digits. */
  uprn?: string;
  price: number | '';
  tenure: Tenure;
  leaseYearsRemaining?: number | '';
  groundRentPerYear?: number | '';
  serviceChargePerYear?: number | '';
  propertyType?: string;
  bedrooms?: number | '';
  bathrooms?: number | '';
  receptions?: number | '';
  epcRating?: string;
  councilTaxBand?: string;
}

interface Props {
  value: PropertyDetailsValue;
  onChange: (next: PropertyDetailsValue) => void;
  onSave: () => void;
  onCancel?: () => void;
  saveLabel?: string;
  /** When true, render a "Cancel" button next to Save. */
  showCancel?: boolean;
  /** When provided, the HMLR title-pull / view-existing button is rendered
   *  next to the Title number field. Omit (e.g. during onboarding before
   *  the transaction exists) to hide that affordance. */
  transactionId?: string;
  /** Field keys that were auto-populated from the listing import. Each gets a
   *  "Pre-filled" chip + teal treatment until the user reviews it (editing or
   *  acknowledging), and Save stays disabled until all are reviewed. Omit for
   *  manual entry or when re-editing an already-confirmed listing. */
  prefilledFields?: ReadonlySet<keyof PropertyDetailsValue>;
  /** When provided, renders an "Autofill from public records" button that fills
   *  blank EPC rating + UPRN from the free EPC register. The parent performs the
   *  lookup and marks the filled fields as pre-filled (review chips). */
  onAutofill?: () => void;
  /** True while the public-records lookup is in flight. */
  autofilling?: boolean;
  /** Outcome message from the last autofill attempt, or null. */
  autofillResult?: { ok: boolean; message: string } | null;
  /** House-identifying address line from the matched EPC certificate (e.g.
   *  "20 Ivel Road"), offered when Address line 1 is street-only. */
  addressSuggestion?: string | null;
  /** Fills Address line 1 with the suggestion (parent applies review chip). */
  onAcceptAddressSuggestion?: () => void;
}

const PROPERTY_TYPES = [
  'Detached', 'Semi-detached', 'Terraced', 'End-of-terrace', 'Flat',
  'Maisonette', 'Bungalow', 'Cottage', 'Other',
];

const EPC_RATINGS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
const COUNCIL_TAX_BANDS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

const POSTCODE_RE = /^[A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2}$/i;
const UPRN_RE = /^\d{1,12}$/;

function validate(v: PropertyDetailsValue): string[] {
  const errors: string[] = [];
  if (!v.addressLine1.trim()) errors.push('Address line 1');
  if (!v.town.trim()) errors.push('Town/city');
  if (!v.postcode.trim()) errors.push('Postcode');
  else if (!POSTCODE_RE.test(v.postcode.trim())) errors.push('Postcode (invalid format)');
  if (!v.titleNumber.trim()) errors.push('Title number');
  // UPRN is optional — only validate format when something was entered.
  if (v.uprn && v.uprn.trim() && !UPRN_RE.test(v.uprn.trim())) {
    errors.push('UPRN (must be 1–12 digits)');
  }
  if (typeof v.price !== 'number' || v.price <= 0) errors.push('Price');
  if (v.tenure === 'unknown') errors.push('Tenure');
  if (v.tenure === 'leasehold') {
    if (typeof v.leaseYearsRemaining !== 'number' || v.leaseYearsRemaining <= 0) {
      errors.push('Lease years remaining');
    }
    if (typeof v.groundRentPerYear !== 'number' || v.groundRentPerYear < 0) {
      errors.push('Ground rent (£/yr)');
    }
    if (typeof v.serviceChargePerYear !== 'number' || v.serviceChargePerYear < 0) {
      errors.push('Service charge (£/yr)');
    }
  }
  return errors;
}

const inputClass =
  'w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500';

const labelClass =
  'block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1';

/**
 * Renders a real <label htmlFor=...> bound to the child input/select via an
 * auto-generated id. Previously this used a <p> visual-only label, which
 * meant screen readers had no field name and clicking the label didn't
 * focus the input. Each Field call site passes exactly one input/select/
 * textarea as `children`; we clone it to inject the matching id.
 *
 * When `pending` is true the field was pre-filled from the import and not yet
 * reviewed: the input gets the teal treatment and the label gets a chip.
 */
function Field({ label, required, children, span2 = false, pending = false }: {
  label: string;
  required?: boolean;
  children: ReactElement<{ id?: string; className?: string }>;
  span2?: boolean;
  pending?: boolean;
}): ReactNode {
  const fieldId = useId();
  const child = isValidElement(children)
    ? cloneElement(children, {
        id: fieldId,
        className: pending
          ? cn(children.props.className, PREFILLED_INPUT_CLASS)
          : children.props.className,
      })
    : children;
  return (
    <div className={span2 ? 'sm:col-span-2' : ''}>
      <label htmlFor={fieldId} className={labelClass}>
        {label}
        {required && <span className="text-rose-500 ml-0.5">*</span>}
        {pending && <PrefilledChip />}
      </label>
      {child}
    </div>
  );
}

function numberOrEmpty(e: ChangeEvent<HTMLInputElement>): number | '' {
  const raw = e.target.value;
  if (raw === '') return '';
  const n = Number(raw);
  return Number.isFinite(n) ? n : '';
}

export function PropertyDetailsForm({ value, onChange, onSave, onCancel, saveLabel = 'Save', showCancel = false, transactionId, prefilledFields, onAutofill, autofilling = false, autofillResult, addressSuggestion, onAcceptAddressSuggestion }: Props): ReactNode {
  const [showErrors, setShowErrors] = useState(false);
  const uprnId = useId();
  const review = usePrefillReview(prefilledFields);
  const errors = validate(value);
  const pendingCount = review.pendingKeys.length;

  const update = <K extends keyof PropertyDetailsValue>(key: K, v: PropertyDetailsValue[K]): void => {
    review.markReviewed(key);
    onChange({ ...value, [key]: v });
  };

  const handleSave = (): void => {
    if (errors.length > 0) {
      setShowErrors(true);
      return;
    }
    // pendingCount > 0: the review note below is always visible, so it already
    // tells the user what to check. Just don't proceed.
    if (pendingCount > 0) return;
    onSave();
  };

  const isLeasehold = value.tenure === 'leasehold';
  // The autofill button has nothing left to offer once both fields it can
  // fill are already populated — hide it, but keep the result banner
  // (rendered outside this check below) so the auto-scan's message survives.
  const autofillUseful = !value.epcRating || !(value.uprn ?? '').trim();

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Address line 1" required span2 pending={review.isPending('addressLine1')}>
          <input
            className={inputClass}
            value={value.addressLine1}
            onChange={(e) => update('addressLine1', e.target.value)}
            placeholder="e.g. 12 High Street"
          />
        </Field>
        {addressSuggestion && onAcceptAddressSuggestion && (
          <p className="sm:col-span-2 -mt-2 text-xs text-gray-600 dark:text-gray-400">
            Is this your property? The EPC register has{' '}
            <strong className="text-gray-900 dark:text-gray-100">{addressSuggestion}</strong>{' '}
            <button
              type="button"
              onClick={onAcceptAddressSuggestion}
              className="font-semibold text-teal-700 dark:text-teal-400 hover:underline"
            >
              Use this
            </button>
          </p>
        )}
        <Field label="Address line 2" span2 pending={review.isPending('addressLine2')}>
          <input
            className={inputClass}
            value={value.addressLine2 ?? ''}
            onChange={(e) => update('addressLine2', e.target.value)}
            placeholder="Optional"
          />
        </Field>
        <Field label="Town / City" required pending={review.isPending('town')}>
          <input
            className={inputClass}
            value={value.town}
            onChange={(e) => update('town', e.target.value)}
          />
        </Field>
        <Field label="County" pending={review.isPending('county')}>
          <input
            className={inputClass}
            value={value.county ?? ''}
            onChange={(e) => update('county', e.target.value)}
            placeholder="Optional"
          />
        </Field>
        <Field label="Postcode" required pending={review.isPending('postcode')}>
          <input
            className={`${inputClass} font-mono`}
            value={value.postcode}
            onChange={(e) => update('postcode', e.target.value.toUpperCase())}
            placeholder="e.g. SG19 1AB"
          />
        </Field>
        {/* Title number + its free address→title finder share one grid cell
            so the finder sits directly under the field (sellers who don't
            know their title number search, then pick a result to fill it). */}
        <div>
          <Field label="Title number (HMLR)" required>
            <input
              className={`${inputClass} font-mono`}
              value={value.titleNumber}
              onChange={(e) => update('titleNumber', e.target.value.toUpperCase())}
              placeholder="e.g. BD123456"
            />
          </Field>
          <div className="mt-1.5">
            <TitleNumberFinder
              postcode={value.postcode}
              addressLine1={value.addressLine1}
              onSelect={(tn) => update('titleNumber', tn.toUpperCase())}
            />
          </div>
        </div>
        {/* UPRN sits beside Title number — both are "property identity"
            fields. Optional, and never blocks continuing. Most sellers have
            never heard of a UPRN, so lead with plain-English help + a finder
            link rather than assuming they know the number. */}
        <div className="sm:col-span-2">
          <label htmlFor={uprnId} className={labelClass}>UPRN</label>
          <input
            id={uprnId}
            className={`${inputClass} font-mono`}
            value={value.uprn ?? ''}
            onChange={(e) => update('uprn', e.target.value)}
            placeholder="e.g. 100023336956"
            inputMode="numeric"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-slate-500">
            A free, unique ID for your property — like a barcode for the address.
            Optional, and you don&rsquo;t need it to continue.{' '}
            {/* Deliberately NOT given a 44px target: this is a link inside a
                sentence, which WCAG 2.5.5 / 2.5.8 exempt, and forcing a
                minimum height here would break the paragraph. It does get a
                persistent underline — hover-only underlining leaves it
                indistinguishable from the surrounding text until you find it
                with the mouse. */}
            <a
              href="https://www.findmyaddress.co.uk/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-teal-700 underline underline-offset-2 hover:text-teal-800 dark:text-teal-400 dark:hover:text-teal-300"
            >
              Find my UPRN &rarr;
            </a>
          </p>
        </div>
      </div>

      {/* Autofill from free public records — fills blank EPC rating + UPRN from
          the EPC register. Suggest, don't impose: filled fields get the
          "Pre-filled" review chip via prefilledFields. */}
      {onAutofill && (
        <div className="rounded-lg border border-teal-600/30 bg-teal-50 dark:border-teal-500/40 dark:bg-teal-950/30 p-4">
          {autofillUseful && (
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Save time — autofill from public records
                </p>
                <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                  We&rsquo;ll look up the EPC rating and property ID (UPRN) for your address.
                  Free, and you can edit anything we find.
                </p>
              </div>
              <button
                type="button"
                onClick={onAutofill}
                disabled={autofilling || !value.postcode.trim()}
                title={!value.postcode.trim() ? 'Enter a postcode first' : undefined}
                className="shrink-0 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 text-sm font-semibold text-white transition-colors"
              >
                {autofilling ? 'Searching…' : 'Autofill'}
              </button>
            </div>
          )}
          {autofillResult && (
            <p
              className={cn(
                'mt-2 text-xs',
                autofillResult.ok
                  ? 'text-teal-700 dark:text-teal-300'
                  : 'text-amber-600 dark:text-amber-400',
              )}
            >
              {autofillResult.message}
            </p>
          )}
        </div>
      )}

      {/* HMLR title-pull — gated on a transactionId (skipped pre-listing
          onboarding) and on a syntactically valid title number. The
          button itself decides whether to charge £7 or view a cached
          pull by querying the hmlr_pulls index in Supabase. */}
      {transactionId && value.titleNumber.trim().length > 0 && (
        <div className="mt-2 rounded-lg border border-teal-600/30 bg-teal-50 dark:border-teal-500/40 dark:bg-teal-950/30 p-4">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
            Check who owns YOUR property — £7
          </p>
          <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
            Hit the Title button and we fetch your Official Copy from HM
            Land Registry — it names the registered owner. We store the
            canonical JSON off-chain and register the SHA-256 hash on the
            IC, so that proof is anchored and tamper-proof. If you've
            already pulled this title number you can view it again for
            free.
          </p>
          <div className="mt-3">
            <HMLRTitlePullButton
              titleNumber={value.titleNumber}
              transactionId={transactionId}
            />
          </div>
        </div>
      )}

      {/* Everything from here down is the listing's disclosure set — grouped
          under the term buyers, agents and the government's reform roadmap
          all use, so sellers recognise what they're providing. */}
      <div className="mt-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-slate-400">
          Material information
        </p>
        <p className="mt-0.5 text-xs text-gray-500 dark:text-slate-500">
          The facts a listing must disclose — shown to buyers up front.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Asking price (£)" required pending={review.isPending('price')}>
          <input
            type="number"
            min={0}
            className={inputClass}
            value={value.price}
            onChange={(e) => update('price', numberOrEmpty(e))}
          />
        </Field>
        <Field label="Tenure" required pending={review.isPending('tenure')}>
          <select
            className={inputClass}
            value={value.tenure}
            onChange={(e) => update('tenure', e.target.value as Tenure)}
          >
            <option value="unknown">— Select tenure —</option>
            <option value="freehold">Freehold</option>
            <option value="leasehold">Leasehold</option>
            <option value="shareOfFreehold">Share of freehold</option>
          </select>
        </Field>
      </div>

      {isLeasehold && (
        <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/30 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-slate-400 mb-2">
            Leasehold details
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Years remaining" required pending={review.isPending('leaseYearsRemaining')}>
              <input
                type="number"
                min={0}
                className={inputClass}
                value={value.leaseYearsRemaining ?? ''}
                onChange={(e) => update('leaseYearsRemaining', numberOrEmpty(e))}
              />
            </Field>
            <Field label="Ground rent (£/yr)" required pending={review.isPending('groundRentPerYear')}>
              <input
                type="number"
                min={0}
                className={inputClass}
                value={value.groundRentPerYear ?? ''}
                onChange={(e) => update('groundRentPerYear', numberOrEmpty(e))}
              />
            </Field>
            <Field label="Service charge (£/yr)" required pending={review.isPending('serviceChargePerYear')}>
              <input
                type="number"
                min={0}
                className={inputClass}
                value={value.serviceChargePerYear ?? ''}
                onChange={(e) => update('serviceChargePerYear', numberOrEmpty(e))}
              />
            </Field>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Field label="Property type" pending={review.isPending('propertyType')}>
          <select
            className={inputClass}
            value={value.propertyType ?? ''}
            onChange={(e) => update('propertyType', e.target.value || undefined)}
          >
            <option value="">—</option>
            {PROPERTY_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="Bedrooms" pending={review.isPending('bedrooms')}>
          <input
            type="number"
            min={0}
            className={inputClass}
            value={value.bedrooms ?? ''}
            onChange={(e) => update('bedrooms', numberOrEmpty(e))}
          />
        </Field>
        <Field label="Bathrooms" pending={review.isPending('bathrooms')}>
          <input
            type="number"
            min={0}
            className={inputClass}
            value={value.bathrooms ?? ''}
            onChange={(e) => update('bathrooms', numberOrEmpty(e))}
          />
        </Field>
        <Field label="Receptions" pending={review.isPending('receptions')}>
          <input
            type="number"
            min={0}
            className={inputClass}
            value={value.receptions ?? ''}
            onChange={(e) => update('receptions', numberOrEmpty(e))}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="EPC rating" pending={review.isPending('epcRating')}>
          <select
            className={inputClass}
            value={value.epcRating ?? ''}
            onChange={(e) => update('epcRating', e.target.value || undefined)}
          >
            <option value="">—</option>
            {EPC_RATINGS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </Field>
        <Field label="Council tax band" pending={review.isPending('councilTaxBand')}>
          <select
            className={inputClass}
            value={value.councilTaxBand ?? ''}
            onChange={(e) => update('councilTaxBand', e.target.value || undefined)}
          >
            <option value="">—</option>
            {COUNCIL_TAX_BANDS.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </Field>
      </div>

      {showErrors && errors.length > 0 && (
        <div className="rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/20 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
          Please complete: {errors.join(', ')}
        </div>
      )}

      {pendingCount > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border border-teal-500/30 bg-teal-50 dark:border-teal-500/40 dark:bg-teal-950/30 px-3 py-2.5">
          <p className="text-sm text-teal-800 dark:text-teal-200">
            We pre-filled {pendingCount} detail{pendingCount === 1 ? '' : 's'} from the listing.
            Please check {pendingCount === 1 ? 'it' : 'them'} before continuing.
          </p>
          <button
            type="button"
            onClick={review.markAllReviewed}
            className="self-start rounded-lg border border-teal-500/40 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-slate-700 transition-colors"
          >
            These details look right
          </button>
        </div>
      )}

      <div className="flex gap-2">
        {showCancel && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 text-sm font-semibold transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={pendingCount > 0}
          title={pendingCount > 0 ? 'Review the pre-filled details first' : undefined}
          className="flex-1 px-4 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
        >
          {saveLabel}
        </button>
      </div>
    </div>
  );
}
