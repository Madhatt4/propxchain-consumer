import React, { useState } from 'react';
import type { PropertyListing, ProvenanceMap } from '@/types/listing.types';
import { normaliseExternalUrl } from '@/utils/externalUrl';

interface Props {
  listing: PropertyListing;
  /** The agency's own listing URL, when the caller keeps one. Passing it
   *  (even as `null`) renders the field; omitting it leaves the form exactly
   *  as it was — the seller-side import flow has no agency site to link to. */
  agentUrl?: string | null;
  /** `agentUrl` is `undefined` when this form isn't managing the field —
   *  distinct from `null`, which means the agent deliberately cleared it. A
   *  caller that doesn't render the field must not appear to have blanked it. */
  onSave: (
    updated: PropertyListing,
    provenance: ProvenanceMap,
    agentUrl: string | null | undefined,
  ) => void;
  onCancel: () => void;
}

type FormState = Omit<PropertyListing, 'provenance' | 'url' | 'listingId' | 'source' | 'images' | 'keyFeatures'> & {
  keyFeaturesRaw: string;
};

const toFormState = (l: PropertyListing): FormState => ({
  address: l.address,
  postcode: l.postcode,
  price: l.price,
  propertyType: l.propertyType,
  bedrooms: l.bedrooms,
  tenure: l.tenure,
  priceQualifier: l.priceQualifier,
  bathrooms: l.bathrooms,
  description: l.description,
  keyFeaturesRaw: l.keyFeatures.join('\n'),
  floorplanUrl: l.floorplanUrl,
  epcRating: l.epcRating,
  agentName: l.agentName,
  agentBranch: l.agentBranch,
  agentLogoUrl: l.agentLogoUrl,
  councilTaxBand: l.councilTaxBand,
  propertyPhrase: l.propertyPhrase,
});

const ListingEditForm: React.FC<Props> = ({ listing, agentUrl, onSave, onCancel }) => {
  const [form, setForm] = useState<FormState>(toFormState(listing));
  const showAgentUrl = agentUrl !== undefined;
  const [agentUrlRaw, setAgentUrlRaw] = useState<string>(agentUrl ?? '');
  const [agentUrlError, setAgentUrlError] = useState<string | null>(null);

  const update = <K extends keyof FormState>(k: K, v: FormState[K]): void =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSave = (): void => {
    // `undefined` from the normaliser means "typed something that isn't a
    // web address" — distinct from `null`, which is a deliberate clear.
    // `undefined` carries two meanings and they must never share a variable:
    // the normaliser returns it for "that isn't a web address", and this form
    // reports it upward for "I'm not managing this field". Resolving the first
    // inside the branch keeps them apart — collapsing them into one ternary
    // made a hidden field look like a validation failure and blocked the save.
    let normalisedAgentUrl: string | null | undefined;
    if (showAgentUrl) {
      const parsed = normaliseExternalUrl(agentUrlRaw);
      if (parsed === undefined) {
        setAgentUrlError('Enter a web address, like demoandsons.co.uk/45-laburnum-road');
        return;
      }
      normalisedAgentUrl = parsed;
      setAgentUrlError(null);
    }

    const { keyFeaturesRaw, ...rest } = form;
    const keyFeatures = keyFeaturesRaw.split('\n').map((s) => s.trim()).filter(Boolean);
    const updated: PropertyListing = { ...listing, ...rest, keyFeatures };

    const newProv: ProvenanceMap = { ...listing.provenance };
    (Object.keys(rest) as (keyof typeof rest)[]).forEach((k) => {
      if (String(listing[k as keyof PropertyListing] ?? '') !== String(form[k as keyof FormState] ?? '')) {
        (newProv as Record<string, string>)[k] = 'user';
      }
    });
    if (keyFeatures.join('|') !== listing.keyFeatures.join('|')) {
      newProv.keyFeatures = 'user';
    }
    onSave(updated, newProv, normalisedAgentUrl);
  };

  const L = ({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }): React.ReactElement => (
    <label htmlFor={htmlFor} className="block text-xs font-medium text-gray-700 mb-1">{children}</label>
  );

  const inputClass = 'w-full h-10 px-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500';

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <L htmlFor="address">Address</L>
          <input
            id="address"
            className={inputClass}
            value={form.address}
            onChange={(e) => update('address', e.target.value)}
          />
        </div>
        <div>
          <L htmlFor="postcode">Postcode</L>
          <input
            id="postcode"
            className={inputClass}
            value={form.postcode}
            onChange={(e) => update('postcode', e.target.value.toUpperCase())}
          />
        </div>
        <div>
          <L htmlFor="price">Price (£)</L>
          <input
            id="price"
            type="number"
            className={inputClass}
            value={form.price}
            onChange={(e) => update('price', Number(e.target.value))}
          />
        </div>
        <div>
          <L htmlFor="priceQualifier">Price qualifier</L>
          <input
            id="priceQualifier"
            className={inputClass}
            value={form.priceQualifier}
            onChange={(e) => update('priceQualifier', e.target.value)}
          />
        </div>
        <div>
          <L htmlFor="propertyType">Property type</L>
          <input
            id="propertyType"
            className={inputClass}
            value={form.propertyType}
            onChange={(e) => update('propertyType', e.target.value)}
          />
        </div>
        <div>
          <L htmlFor="bedrooms">Bedrooms</L>
          <input
            id="bedrooms"
            type="number"
            className={inputClass}
            value={form.bedrooms}
            onChange={(e) => update('bedrooms', Number(e.target.value))}
          />
        </div>
        <div>
          <L htmlFor="bathrooms">Bathrooms</L>
          <input
            id="bathrooms"
            type="number"
            className={inputClass}
            value={form.bathrooms}
            onChange={(e) => update('bathrooms', Number(e.target.value))}
          />
        </div>
        <div>
          <L htmlFor="tenure">Tenure</L>
          <select
            id="tenure"
            className={inputClass}
            value={form.tenure}
            onChange={(e) => update('tenure', e.target.value as FormState['tenure'])}
          >
            <option value="unknown">Unknown</option>
            <option value="freehold">Freehold</option>
            <option value="leasehold">Leasehold</option>
          </select>
        </div>
        <div>
          <L htmlFor="councilTaxBand">Council tax band</L>
          <input
            id="councilTaxBand"
            className={inputClass}
            value={form.councilTaxBand ?? ''}
            onChange={(e) => update('councilTaxBand', e.target.value || null)}
          />
        </div>
        <div>
          <L htmlFor="agentName">Agent name</L>
          <input
            id="agentName"
            className={inputClass}
            value={form.agentName}
            onChange={(e) => update('agentName', e.target.value)}
          />
        </div>
        <div>
          <L htmlFor="agentBranch">Agent branch</L>
          <input
            id="agentBranch"
            className={inputClass}
            value={form.agentBranch}
            onChange={(e) => update('agentBranch', e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <L htmlFor="description">Description</L>
          <textarea
            id="description"
            rows={4}
            className={`${inputClass} h-auto py-2`}
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <L htmlFor="keyFeaturesRaw">Key features (one per line)</L>
          <textarea
            id="keyFeaturesRaw"
            rows={4}
            className={`${inputClass} h-auto py-2`}
            value={form.keyFeaturesRaw}
            onChange={(e) => update('keyFeaturesRaw', e.target.value)}
          />
        </div>
        {showAgentUrl && (
          <div className="sm:col-span-2">
            <L htmlFor="agentUrl">This property on your website</L>
            <input
              id="agentUrl"
              type="url"
              inputMode="url"
              placeholder="demoandsons.co.uk/45-laburnum-road"
              className={inputClass}
              value={agentUrlRaw}
              onChange={(e) => {
                setAgentUrlRaw(e.target.value);
                if (agentUrlError) setAgentUrlError(null);
              }}
              aria-invalid={agentUrlError !== null}
              aria-describedby={agentUrlError ? 'agentUrl-error' : 'agentUrl-hint'}
            />
            {agentUrlError ? (
              <p id="agentUrl-error" className="mt-1 text-xs text-red-600">{agentUrlError}</p>
            ) : (
              <p id="agentUrl-hint" className="mt-1 text-xs text-gray-500">
                Adds a &ldquo;View on our site&rdquo; button. Leave blank to remove it.
              </p>
            )}
          </div>
        )}
      </div>
      <div className="flex gap-2 justify-end pt-2">
        <button
          type="button"
          className="px-4 h-11 border border-gray-300 rounded-md hover:bg-gray-50"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="button"
          className="px-4 h-11 bg-green-600 text-white rounded-md hover:bg-green-700"
          onClick={handleSave}
        >
          Save
        </button>
      </div>
    </div>
  );
};

export default ListingEditForm;
