// Seeding the TA6 shell: which step to open on, whether a stored record is
// in the 15-section shape, and the §1 prefill from the listing. Split from
// TA6Form.tsx to keep the shell under the file size cap.

import { jurisdictionFromPostcode } from '@/lib/jurisdiction';

import { TA6_STEP_COUNT } from './sectionMeta';
import { emptyTA6Form } from '../../../types/ta6.types';
import type { TA6PropertyInformation } from '../../../types/ta6.types';
import type { PropertyListing } from '../../../types/listing.types';
import { prefillTa6FromListing } from '../../../services/taFormsPrefill';

/** A deep link is user input: an unusable step opens the form at the start. */
export function openingStep(step: number | undefined): number {
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
// whether a prefill happened, so the shell can flag §1 dirty and show a banner,
// and when the stored form was last edited (null when there is none: a fresh
// form's lastModifiedAt is only the moment it was built).
export function buildInitial(
  initialData: TA6PropertyInformation | null | undefined,
  propertyAddress?: string,
  postcode?: string | null,
  listing?: PropertyListing | null,
): { form: TA6PropertyInformation; prefilled: boolean; savedAt: string | null } {
  const savedAt = isNewShape(initialData) ? initialData.lastModifiedAt : null;
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
  return { form, prefilled, savedAt };
}
