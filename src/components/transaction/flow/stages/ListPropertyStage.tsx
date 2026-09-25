import { useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { Check, Pencil, Link2, Loader2 } from 'lucide-react';
import type { StageConfig } from '../../../../types/stage.types';
import type { PropertyListing, ProvenanceMap, ProvenanceFieldKey, FieldProvenance, Tenure } from '../../../../types/listing.types';
import { scrapeListing, isValidListingUrl } from '../../../../services/listing.service';
import { icpService } from '../../../../services/icp.service';
import { recordOnBehalf } from '@/services/onBehalf';
import { logger } from '../../../../utils/logger';
import {
  storeRightmoveData,
  getRightmoveData,
  storeTitleNumber,
  getTitleNumber,
} from '../../../../utils/rightmoveStorage';
import { splitAddress, joinAddress } from '../../../../utils/addressSplit';
import { lookupEpc, type EpcCertificate } from '../../../../services/epc.service';
import { splitAddressLine1 } from '../../../../services/hmlrTitle.service';
import { getPropertyIntelligence } from '../../../../services/propertyIntelligenceService';
import { useAutoPropertyScan } from '../../../../hooks/useAutoPropertyScan';
import { PropertyDetailsForm, type PropertyDetailsValue } from './PropertyDetailsForm';
import { useToast } from '@/hooks/use-toast';

/**
 * Compute which blank list-property fields can be filled from a free EPC record.
 * Only ever fills blanks — never overwrites what the user typed. EPC gives the
 * energy band, and the EPC register also carries the UPRN (which the seller
 * rarely knows but which unlocks the precise OS Open UPRN pin downstream).
 */
export function buildEpcAutofill(
  details: PropertyDetailsValue,
  epc: EpcCertificate | null,
): { updates: Partial<PropertyDetailsValue>; filledKeys: Array<keyof PropertyDetailsValue> } {
  const updates: Partial<PropertyDetailsValue> = {};
  const filledKeys: Array<keyof PropertyDetailsValue> = [];
  if (!epc) return { updates, filledKeys };
  if (!details.epcRating && epc.currentBand) {
    updates.epcRating = epc.currentBand;
    filledKeys.push('epcRating');
  }
  if (!(details.uprn && details.uprn.trim()) && epc.uprn) {
    updates.uprn = epc.uprn;
    filledKeys.push('uprn');
  }
  return { updates, filledKeys };
}

/** Title-case the letter-runs of an EPC register line ("86A FAIRFIELD ROAD"
 *  → "86A Fairfield Road") — digit prefixes like "86A" keep their case. */
function titleCaseAddress(raw: string): string {
  return raw.replace(/[A-Za-z]+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

/**
 * When the form's Address line 1 is street-only (no house number or name —
 * the shape every portal import produces) and the matched EPC certificate's
 * first address segment DOES identify the dwelling, return that segment
 * title-cased as a one-tap suggestion. Null when there's nothing to add.
 * Fixes the HMLR title-search dead-end (SPD requires a house identifier)
 * and pins the EPC/UPRN match to a specific dwelling.
 */
export function buildAddressSuggestion(
  line1: string,
  epcAddress: string | null | undefined,
): string | null {
  if (!epcAddress || !epcAddress.trim()) return null;
  const current = splitAddressLine1(line1);
  // A house number or name already identifies the dwelling — nothing to add.
  if (current.houseNumber || current.houseName) return null;
  const candidate = (epcAddress.split(',')[0] ?? '').trim();
  if (!candidate) return null;
  const parsed = splitAddressLine1(candidate);
  // The register line must actually carry a house identifier, not just
  // repeat the street.
  if (!parsed.houseNumber && !parsed.houseName) return null;
  return titleCaseAddress(candidate);
}

interface StageProps {
  stage: StageConfig;
  onComplete?: (stageId: string) => void;
  transactionId?: string;
  onListingImported?: (listing: PropertyListing) => void;
  /** True when the user has clicked Edit on a completed stage to re-open
   *  it. Renders the input UI again with current values pre-filled. */
  isEditing?: boolean;
  /** Cancel out of edit mode without saving. */
  onCancelEdit?: () => void;
  /** Bumped by the parent after successful save so cards driven by the
   *  invalidationKey (NextStepCard, PhaseIndicator, PhaseChecklist) refetch. */
  onAfterEdit?: () => void;
}

/** Compute a per-field diff between the form's previous and new values.
 *  Used to emit one `listing_edited` audit event per changed field with the
 *  old/new pair embedded in metadata so the on-chain trail captures exactly
 *  what changed. */
function diffDetails(
  prev: PropertyDetailsValue,
  next: PropertyDetailsValue,
): Array<{ field: string; oldValue: string; newValue: string }> {
  const fields: Array<keyof PropertyDetailsValue> = [
    'addressLine1', 'addressLine2', 'town', 'county', 'postcode', 'titleNumber',
    'uprn', 'price', 'tenure', 'leaseYearsRemaining', 'groundRentPerYear',
    'serviceChargePerYear', 'propertyType', 'bedrooms', 'bathrooms',
    'receptions', 'epcRating', 'councilTaxBand',
  ];
  const out: Array<{ field: string; oldValue: string; newValue: string }> = [];
  for (const f of fields) {
    const a = prev[f];
    const b = next[f];
    const aStr = a === undefined || a === '' ? '' : String(a);
    const bStr = b === undefined || b === '' ? '' : String(b);
    if (aStr !== bStr) out.push({ field: f, oldValue: aStr, newValue: bStr });
  }
  return out;
}

const EMPTY_DETAILS: PropertyDetailsValue = {
  addressLine1: '',
  addressLine2: '',
  town: '',
  county: '',
  postcode: '',
  titleNumber: '',
  uprn: '',
  price: '',
  tenure: 'unknown',
};

/** Listing fields the import can populate, expressed as PropertyDetailsValue
 *  keys. Each name also exists as a ProvenanceFieldKey, so provenance reads
 *  directly. titleNumber is excluded — it has no listing provenance (it's
 *  entered/loaded separately). */
const PREFILLABLE_KEYS: ReadonlyArray<keyof PropertyDetailsValue> = [
  'addressLine1', 'addressLine2', 'town', 'county', 'postcode', 'price', 'tenure',
  'leaseYearsRemaining', 'groundRentPerYear', 'serviceChargePerYear',
  'propertyType', 'bedrooms', 'bathrooms', 'receptions', 'epcRating', 'councilTaxBand',
];

/** Provenance values meaning "the system filled this, not the user" — each
 *  warrants a review glance, whether scraped, parsed, or LLM-extracted. */
const AUTO_FILLED: ReadonlySet<FieldProvenance> = new Set<FieldProvenance>(['adapter', 'jsonld', 'llm']);

function computePrefilledFields(
  listing: PropertyListing | null,
): ReadonlySet<keyof PropertyDetailsValue> {
  const out = new Set<keyof PropertyDetailsValue>();
  const prov: ProvenanceMap | undefined = listing?.provenance;
  if (!prov) return out;
  for (const key of PREFILLABLE_KEYS) {
    const source = prov[key as ProvenanceFieldKey];
    if (source && AUTO_FILLED.has(source)) out.add(key);
  }
  return out;
}

function formatPrice(price: number): string {
  return `£${price.toLocaleString('en-GB')}`;
}

/** Only a real A-G band reaches the form. Older imports carried the Rightmove
 *  EPC graph *URL* in epcRating — truthy (so autofill skipped the field) but
 *  not a band (so the dropdown rendered blank). Cached listings still have it. */
function sanitiseEpcBand(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const b = raw.trim().toUpperCase();
  return ['A', 'B', 'C', 'D', 'E', 'F', 'G'].includes(b) ? b : undefined;
}

/**
 * Build a PropertyDetailsValue from a stored PropertyListing — using the
 * structured fields directly when present, otherwise falling back to the
 * heuristic address split. Title number is loaded separately because it
 * lives in its own localStorage namespace today (not part of the listing
 * shape).
 */
export function listingToDetails(
  listing: PropertyListing | null,
  titleNumber: string,
): PropertyDetailsValue {
  if (!listing) return { ...EMPTY_DETAILS, titleNumber };

  const hasStructured = Boolean(listing.addressLine1 || listing.town);
  const split = hasStructured
    ? null
    : splitAddress(listing.address);

  return {
    addressLine1: listing.addressLine1 ?? split?.line1 ?? '',
    addressLine2: listing.addressLine2 ?? split?.line2 ?? '',
    town: listing.town ?? split?.town ?? '',
    county: listing.county ?? split?.county ?? '',
    postcode: listing.postcode || split?.postcode || '',
    titleNumber,
    uprn: listing.uprn ?? '',
    price: listing.price > 0 ? listing.price : '',
    tenure: listing.tenure,
    leaseYearsRemaining: listing.leaseYearsRemaining ?? '',
    groundRentPerYear: listing.groundRentPerYear ?? '',
    serviceChargePerYear: listing.serviceChargePerYear ?? '',
    propertyType: listing.propertyType || undefined,
    bedrooms: listing.bedrooms > 0 ? listing.bedrooms : '',
    bathrooms: listing.bathrooms > 0 ? listing.bathrooms : '',
    receptions: listing.receptions ?? '',
    epcRating: sanitiseEpcBand(listing.epcRating),
    councilTaxBand: listing.councilTaxBand ?? undefined,
  };
}

/**
 * Merge user-edited details back into a PropertyListing, preserving fields
 * the form doesn't touch (images, description, agent info, provenance) when
 * an existing listing is provided. When called without a base listing
 * (manual entry path), constructs a minimal but valid PropertyListing.
 */
export function detailsToListing(
  details: PropertyDetailsValue,
  base: PropertyListing | null,
): PropertyListing {
  const address = joinAddress({
    line1: details.addressLine1,
    line2: details.addressLine2,
    town: details.town,
    county: details.county,
    postcode: details.postcode,
  });

  const empty: PropertyListing = {
    url: '',
    listingId: `manual-${Date.now()}`,
    source: 'manual',
    address: '',
    postcode: '',
    price: 0,
    propertyType: '',
    bedrooms: 0,
    tenure: 'unknown' as Tenure,
    priceQualifier: '',
    bathrooms: 0,
    description: '',
    keyFeatures: [],
    images: [],
    floorplanUrl: null,
    epcRating: null,
    agentName: '',
    agentBranch: '',
    agentLogoUrl: null,
    councilTaxBand: null,
    propertyPhrase: '',
    provenance: {} as ProvenanceMap,
  };

  const existing = base ?? empty;

  // UPRN is always user-entered in Phase 1 (no auto-lookup), so record 'user'
  // provenance when present; drop the key entirely when blank so an absent
  // UPRN stays absent in provenance too.
  const uprn = details.uprn?.trim() || undefined;
  const provenance: ProvenanceMap = { ...existing.provenance };
  if (uprn) provenance.uprn = 'user';
  else delete provenance.uprn;

  return {
    ...existing,
    address,
    uprn,
    provenance,
    postcode: details.postcode,
    price: typeof details.price === 'number' ? details.price : 0,
    propertyType: details.propertyType ?? existing.propertyType,
    bedrooms: typeof details.bedrooms === 'number' ? details.bedrooms : existing.bedrooms,
    bathrooms: typeof details.bathrooms === 'number' ? details.bathrooms : existing.bathrooms,
    tenure: details.tenure,
    addressLine1: details.addressLine1,
    addressLine2: details.addressLine2 || undefined,
    town: details.town,
    county: details.county || undefined,
    receptions: typeof details.receptions === 'number' ? details.receptions : undefined,
    leaseYearsRemaining: typeof details.leaseYearsRemaining === 'number' ? details.leaseYearsRemaining : undefined,
    groundRentPerYear: typeof details.groundRentPerYear === 'number' ? details.groundRentPerYear : undefined,
    serviceChargePerYear: typeof details.serviceChargePerYear === 'number' ? details.serviceChargePerYear : undefined,
    epcRating: details.epcRating ?? existing.epcRating,
    councilTaxBand: details.councilTaxBand ?? existing.councilTaxBand,
  };
}

export function ListPropertyStage({ stage, onComplete, transactionId, onListingImported, isEditing = false, onCancelEdit, onAfterEdit }: StageProps): ReactNode {
  const { toast } = useToast();
  const [url, setUrl] = useState<string>('');
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importError, setImportError] = useState<string | null>(null);
  // The full PropertyListing object (preserves images, description, agent
  // info, etc. across the import → form → save round-trip).
  const [baseListing, setBaseListing] = useState<PropertyListing | null>(null);
  // Form-controlled subset of fields the user can edit.
  const [details, setDetails] = useState<PropertyDetailsValue>(EMPTY_DETAILS);

  // Fields the import auto-filled get a "Pre-filled" chip + review gate in the
  // form. Skip while editing an already-confirmed listing — those values are
  // the user's own. Recompute only when the base listing changes.
  const prefilledFields = useMemo(
    () => (isEditing ? undefined : computePrefilledFields(baseListing)),
    [baseListing, isEditing],
  );

  // "Autofill from public records": fill blank EPC band + UPRN from the free EPC
  // register. Autofilled fields are merged into the review set so they get the
  // same "Pre-filled" chip + Save-gate as imported fields — suggest, don't impose.
  const [autofilling, setAutofilling] = useState<boolean>(false);
  const [autofillResult, setAutofillResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [autofilledKeys, setAutofilledKeys] = useState<ReadonlySet<keyof PropertyDetailsValue>>(
    () => new Set(),
  );
  // Address line of the last EPC certificate the scan matched — feeds the
  // one-tap "use the register's address" suggestion for street-only imports.
  const [epcAddress, setEpcAddress] = useState<string | null>(null);

  const formPrefilled = useMemo<ReadonlySet<keyof PropertyDetailsValue> | undefined>(() => {
    if (autofilledKeys.size === 0) return prefilledFields;
    return new Set<keyof PropertyDetailsValue>([...(prefilledFields ?? []), ...autofilledKeys]);
  }, [prefilledFields, autofilledKeys]);

  // Extracted so both the manual "Autofill" click and the automatic
  // postcode-driven scan share one implementation. The manual path passes no
  // signal (nothing to abort) and quiet:false (surface every outcome); the
  // auto path passes both so a stale scan can be discarded silently and a
  // miss/error doesn't interrupt someone still typing.
  const runEpcScan = useCallback(async (opts: { signal?: AbortSignal; quiet?: boolean } = {}): Promise<void> => {
    const { signal, quiet = false } = opts;
    const postcode = details.postcode.trim();
    if (!postcode) return;
    setAutofilling(true);
    // Always clear the previous banner — a "Found EPC band C…" message from
    // postcode A must not survive a scan for postcode B that misses quietly.
    setAutofillResult(null);
    try {
      const epc = await lookupEpc(postcode, {
        addressLine: details.addressLine1.trim() || undefined,
        signal,
      });
      if (signal?.aborted) return; // stale scan — postcode changed under us
      // Remember the matched certificate's address — when the form line is
      // street-only, its house identifier becomes a one-tap suggestion.
      setEpcAddress(epc?.address || null);
      const { updates, filledKeys } = buildEpcAutofill(details, epc);
      if (filledKeys.length > 0) {
        setDetails((prev) => ({ ...prev, ...updates }));
        setAutofilledKeys((prev) => new Set([...prev, ...filledKeys]));
        const bits: string[] = [];
        if (updates.epcRating) bits.push(`EPC band ${updates.epcRating}`);
        if (updates.uprn) bits.push(`UPRN ${updates.uprn}`);
        setAutofillResult({
          ok: true,
          message: `Found ${bits.join(' and ')} from public records — please check before continuing.`,
        });
      } else if (!quiet) {
        // Manual click deserves feedback; the auto path stays silent on a
        // miss (no error banner) so someone still typing their postcode
        // isn't interrupted.
        if (epc) {
          setAutofillResult({ ok: true, message: 'Public records matched, but those fields are already filled in.' });
        } else {
          setAutofillResult({ ok: false, message: 'No EPC found for this address — please enter the details manually.' });
        }
      }
    } finally {
      setAutofilling(false);
    }
  }, [details]);

  const handleAutofill = useCallback(async (): Promise<void> => runEpcScan(), [runEpcScan]);

  // One-tap address assist: offered only while Address line 1 is street-only
  // and the matched certificate identifies the dwelling. Accepting fills the
  // field (review chip applies) and the condition self-clears.
  const addressSuggestion = useMemo(
    () => buildAddressSuggestion(details.addressLine1, epcAddress),
    [details.addressLine1, epcAddress],
  );
  const handleAcceptAddressSuggestion = useCallback((): void => {
    if (!addressSuggestion) return;
    setDetails((prev) => ({ ...prev, addressLine1: addressSuggestion }));
    setAutofilledKeys((prev) => new Set([...prev, 'addressLine1']));
  }, [addressSuggestion]);

  // Auto-run the free scan once a full, valid UK postcode settles (debounced,
  // one scan per distinct postcode). Quiet on the EPC side (miss/error stay
  // silent; the success banner still shows) and fires a fire-and-forget
  // Property-tab pre-warm alongside so that tab hydrates instantly later.
  // Disabled while editing an already-confirmed listing or viewing a completed
  // stage (read-only summary — nothing to fill, don't burn the scan budget).
  useAutoPropertyScan(
    details.postcode,
    (postcode, signal) => {
      void runEpcScan({ signal, quiet: true });
      void getPropertyIntelligence(
        postcode,
        details.addressLine1.trim() || undefined,
        details.uprn?.trim() || undefined,
      ).catch(() => { /* per-source degradation already logged inside */ });
    },
    { disabled: Boolean(isEditing) || stage.status === 'completed' },
  );

  // Effective "completed" — when editing, treat as not completed so the
  // form re-renders with values pre-filled below.
  const isCompleted = stage.status === 'completed' && !isEditing;

  // Hydrate form + base listing from storage on mount and whenever the user
  // toggles edit mode. Combined into a single pass: load listing, load title,
  // compose into form-shape via listingToDetails.
  useEffect(() => {
    if (!transactionId) return;
    const stored = getRightmoveData(transactionId);
    const storedTitle = getTitleNumber(transactionId) ?? '';
    if (stored) setBaseListing(stored);
    setDetails(listingToDetails(stored, storedTitle));
  }, [transactionId, isEditing]);

  const handleImport = useCallback(async (): Promise<void> => {
    setImportError(null);
    const trimmed = url.trim();
    if (!isValidListingUrl(trimmed)) {
      setImportError('Please paste a valid Rightmove or Purplebricks property URL');
      return;
    }
    setIsImporting(true);
    try {
      const result = await scrapeListing(trimmed);
      const listing = result.listing;
      setBaseListing(listing);
      // Re-derive form values from the imported listing, preserving any
      // title number the user may have already typed.
      setDetails((prev) => ({
        ...listingToDetails(listing, ''),
        titleNumber: prev.titleNumber,
      }));
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Failed to import listing');
    } finally {
      setIsImporting(false);
    }
  }, [url]);

  const handleSave = useCallback(async (): Promise<void> => {
    if (!transactionId) return;

    // CAPTURE PREVIOUS STATE FIRST — must run before any of the persistence
    // calls below overwrite localStorage. Otherwise the diff reads the
    // already-saved new values and reports zero changes, and we silently
    // skip the canister-side title-number update.
    const prevTitle = isEditing ? (getTitleNumber(transactionId) ?? '') : '';
    const prevDetails = isEditing ? listingToDetails(baseListing, prevTitle) : null;

    const merged = detailsToListing(details, baseListing);

    // Persist the listing JSON on chain (covers structured address, price,
    // tenure, lease fields, etc. — everything except the title number, which
    // lives on the transaction record itself). Await the chain write so a silent
    // failure surfaces: localStorage already holds the listing, but if the
    // on-chain write fails the buyer won't see these details until it's re-saved.
    const chainResult = await storeRightmoveData(transactionId, merged);
    storeTitleNumber(transactionId, details.titleNumber.trim());
    onListingImported?.(merged);

    if (!chainResult.ok) {
      toast({
        title: 'Saved on this device — blockchain sync failed',
        description:
          'Your property details are saved locally but could not be written on-chain, '
          + 'so they may not reach the buyer until you save again.'
          + (chainResult.error ? ` (${chainResult.error})` : ''),
        variant: 'destructive',
      });
    }

    if (isEditing && prevDetails) {
      const changes = diffDetails(prevDetails, details);
      logger.warn('[stage1] edit diff:', JSON.stringify(changes));

      // Title number lives on the transaction record (not in listingData),
      // and createTransaction set it once at wizard time. Sync the current
      // value to chain on every save — the canister no-ops if unchanged.
      // We can't gate on the diff here because earlier saves (from before
      // updateTitleNumber existed) wrote the title to localStorage only;
      // the chain has stayed empty even though the client has a value.
      // Always-sync ensures convergence regardless of how we got here.
      const trimmedTitle = details.titleNumber.trim();
      if (trimmedTitle.length > 0) {
        logger.warn('[stage1] syncing title to chain:', trimmedTitle);
        try {
          const result = await icpService.updateTitleNumber(transactionId, trimmedTitle);
          if ('err' in result) {
            logger.warn('[stage1] updateTitleNumber rejected:', result.err);
          } else {
            logger.warn('[stage1] updateTitleNumber ok:', result.ok);
            void recordOnBehalf(transactionId, 'seller', 'fill_pack_form', 'title_number');
          }
        } catch (err) {
          logger.warn('[stage1] updateTitleNumber threw:', err);
        }
      }

      // Fire-and-forget audit events — one per changed field so the audit
      // trail UI can render row-per-edit. Caller principal + timestamp are
      // recorded server-side by ledger_manager.
      for (const c of changes) {
        void icpService.ledgerManager
          ?.logEvent(
            transactionId,
            'listing_edited',
            `${c.field} updated`,
            [JSON.stringify({ field: c.field, oldValue: c.oldValue, newValue: c.newValue })],
          )
          .catch((err: unknown) => logger.warn('[stage1] logEvent failed', err));
      }

      onAfterEdit?.();
      onCancelEdit?.();
      return;
    }
    onComplete?.(stage.id);
  }, [transactionId, details, baseListing, isEditing, onCancelEdit, onAfterEdit, onComplete, onListingImported, stage.id, toast]);

  if (isCompleted) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-sm font-medium">
          <Check className="h-4 w-4" />
          Property listed
        </div>
        {baseListing && <CompletedSummary listing={baseListing} titleNumber={details.titleNumber} />}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {isEditing && (
        <div className="flex items-center gap-2 rounded-lg border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-900/20 px-3 py-2 text-sm text-teal-700 dark:text-teal-300">
          <Pencil className="h-4 w-4 shrink-0" />
          <span>You're editing this stage. Update the values and click Save changes, or Cancel to discard.</span>
        </div>
      )}

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-slate-400 mb-2 flex items-center gap-1.5">
          <Link2 className="h-3.5 w-3.5" />
          Quick-fill from a listing URL <span className="font-normal normal-case text-gray-400 dark:text-slate-500">(optional)</span>
        </p>
        <div className="flex gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste a Rightmove property URL"
            className="flex-1 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          />
          <button
            type="button"
            onClick={() => void handleImport()}
            disabled={isImporting || !url.trim()}
            className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors whitespace-nowrap flex items-center gap-1.5"
          >
            {isImporting ? <><Loader2 className="h-4 w-4 animate-spin" />Importing...</> : 'Import'}
          </button>
        </div>
        {importError && (
          <p className="text-sm text-rose-600 dark:text-rose-400 mt-2">{importError}</p>
        )}
        <p className="text-xs text-gray-500 dark:text-slate-500 mt-2">
          No URL? Just fill in the details below.
        </p>
      </div>

      {baseListing?.images && baseListing.images.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {baseListing.images.slice(0, 5).map((img, idx) => (
            <img
              key={idx}
              src={img.url}
              alt={`Property image ${idx + 1}`}
              className="h-24 w-36 object-cover rounded-lg flex-shrink-0 border border-gray-200 dark:border-slate-600"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ))}
        </div>
      )}

      <PropertyDetailsForm
        value={details}
        onChange={setDetails}
        onSave={() => { void handleSave(); }}
        onCancel={isEditing ? onCancelEdit : undefined}
        showCancel={isEditing}
        saveLabel={isEditing ? 'Save changes' : 'Confirm Listing & Continue'}
        transactionId={transactionId}
        prefilledFields={formPrefilled}
        onAutofill={() => { void handleAutofill(); }}
        autofilling={autofilling}
        autofillResult={autofillResult}
        addressSuggestion={addressSuggestion}
        onAcceptAddressSuggestion={handleAcceptAddressSuggestion}
      />
    </div>
  );
}

function CompletedSummary({ listing, titleNumber }: { listing: PropertyListing; titleNumber: string }): ReactNode {
  const lines = [
    listing.addressLine1 || listing.address,
    listing.addressLine2,
    [listing.town, listing.county].filter(Boolean).join(', '),
    listing.postcode,
  ].filter(Boolean);

  return (
    <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 p-4 text-sm text-gray-800 dark:text-gray-200">
      <div className="flex flex-col gap-1">
        {lines.map((line, idx) => (
          <p key={idx} className={idx === 0 ? 'font-semibold' : ''}>{line}</p>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-600 dark:text-slate-400">
        {listing.price > 0 && (
          <span className="font-bold text-teal-700 dark:text-teal-400 text-sm">{formatPrice(listing.price)}</span>
        )}
        {listing.tenure !== 'unknown' && <span>· {listing.tenure}</span>}
        {listing.bedrooms > 0 && <span>· {listing.bedrooms} bed</span>}
        {listing.bathrooms > 0 && <span>· {listing.bathrooms} bath</span>}
        {listing.receptions !== undefined && <span>· {listing.receptions} reception</span>}
      </div>
      {titleNumber && (
        <p className="mt-2 text-xs text-gray-600 dark:text-slate-400">
          Title number: <span className="font-mono">{titleNumber}</span>
        </p>
      )}
      {listing.uprn && (
        <p
          className="mt-1 text-xs text-gray-600 dark:text-slate-400"
          title="UPRN — a free, unique ID for the property, like a barcode for the address. It identifies the property, not the owner."
        >
          UPRN: <span className="font-mono">{listing.uprn}</span>
        </p>
      )}
    </div>
  );
}
