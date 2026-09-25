import React, { useState } from 'react';
import { Home, BedDouble, Bath, MapPin, Building2, ChevronDown, ChevronUp } from 'lucide-react';
import type { PropertyListing, ProvenanceMap, FieldProvenance } from '@/types/listing.types';
import { formatPrice } from '@/services/landRegistryService';
import { safeExternalUrl } from '@/utils/externalUrl';

interface Props {
  listing: PropertyListing;
  provenance: ProvenanceMap;
}

const portalLabel = (listing: PropertyListing): string => {
  if (listing.source === 'rightmove') return 'Rightmove';
  if (listing.source === 'purplebricks') return 'Purplebricks';
  if (listing.source === 'onthemarket') return 'OnTheMarket';
  if (listing.source === 'llm') return 'Auto-extracted from site';
  try { return new URL(listing.url).hostname.replace(/^www\./, ''); } catch { return 'Listing'; }
};

const portalBg = (listing: PropertyListing): string => {
  if (listing.source === 'purplebricks') return 'bg-[#550099] text-white';
  if (listing.source === 'rightmove') return 'bg-[#00DEB6] text-[#2B2B2B]';
  return 'bg-gray-700 text-white';
};

const Dot: React.FC<{ prov: FieldProvenance | undefined }> = ({ prov }) =>
  prov === 'llm' ? (
    <span
      className="inline-block w-1.5 h-1.5 rounded-full bg-yellow-500 ml-1 align-middle"
      title="Auto-extracted — please verify"
    />
  ) : null;

const ListingPreviewCard: React.FC<Props> = ({ listing, provenance }) => {
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [showDescription, setShowDescription] = useState(false);

  // Defended locally as well as at the service boundary: this card also renders
  // listings loaded straight from agent_listings, where rows persisted before
  // the worker fix can still be missing these keys. A `.length` read on an
  // absent key throws in render, which takes out the whole page via the global
  // ErrorBoundary rather than degrading to a card with no photos.
  const images = Array.isArray(listing.images) ? listing.images : [];
  const keyFeatures = Array.isArray(listing.keyFeatures) ? listing.keyFeatures : [];

  return (
    <div className="border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden shadow-sm">
      {images.length > 0 && (
        <div className="relative">
          <img
            src={images[activeImageIdx]?.url}
            alt={images[activeImageIdx]?.caption || listing.address}
            className="w-full h-48 sm:h-64 object-cover"
          />
          <div className="absolute top-3 right-3 bg-black/70 text-white text-xs px-2 py-1 rounded-full">
            {activeImageIdx + 1} / {images.length}
          </div>
          <div className={`absolute top-3 left-3 text-xs font-bold px-2 py-1 rounded ${portalBg(listing)}`}>
            {portalLabel(listing)}
          </div>
        </div>
      )}

      {images.length > 1 && (
        <div className="flex gap-1 p-2 bg-gray-50 dark:bg-slate-800/50 overflow-x-auto">
          {images.map((img, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setActiveImageIdx(idx)}
              className={`flex-shrink-0 w-16 h-12 rounded overflow-hidden border-2 transition-colors ${
                idx === activeImageIdx ? 'border-green-500' : 'border-transparent hover:border-gray-300 dark:hover:border-slate-600'
              }`}
            >
              <img src={img.url} alt={img.caption} className="w-full h-full object-cover" />
            </button>
          ))}
          {safeExternalUrl(listing.floorplanUrl) && (
            <button
              type="button"
              onClick={() => window.open(safeExternalUrl(listing.floorplanUrl) ?? '', '_blank', 'noopener,noreferrer')}
              className="flex-shrink-0 w-16 h-12 rounded overflow-hidden border-2 border-transparent hover:border-gray-300 dark:hover:border-slate-600 relative"
            >
              <img src={listing.floorplanUrl ?? undefined} alt="Floorplan" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <span className="text-white text-[10px] font-bold">PLAN</span>
              </div>
            </button>
          )}
        </div>
      )}

      <div className="p-4">
        <div className="mb-3">
          <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {listing.price > 0 ? formatPrice(listing.price) : <span className="text-red-500">Price missing</span>}
            <Dot prov={provenance.price} />
            {listing.priceQualifier && (
              <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-2">{listing.priceQualifier}</span>
            )}
          </p>
          <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
            {listing.address || <span className="text-red-500">Address missing</span>}
            <Dot prov={provenance.address} />
          </p>
          {listing.postcode && (
            <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
              <MapPin className="w-3 h-3" /> {listing.postcode}
              <Dot prov={provenance.postcode} />
            </p>
          )}
        </div>

        <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-3 pb-3 border-b dark:border-slate-700">
          {listing.propertyType && (
            <span className="flex items-center gap-1">
              <Home className="w-4 h-4" /> {listing.propertyType}<Dot prov={provenance.propertyType} />
            </span>
          )}
          {listing.bedrooms > 0 && (
            <span className="flex items-center gap-1">
              <BedDouble className="w-4 h-4" /> {listing.bedrooms} bed<Dot prov={provenance.bedrooms} />
            </span>
          )}
          {listing.bathrooms > 0 && (
            <span className="flex items-center gap-1">
              <Bath className="w-4 h-4" /> {listing.bathrooms} bath<Dot prov={provenance.bathrooms} />
            </span>
          )}
          {listing.tenure !== 'unknown' && (
            <span className="flex items-center gap-1">
              <Building2 className="w-4 h-4" /> {listing.tenure}<Dot prov={provenance.tenure} />
            </span>
          )}
        </div>

        {keyFeatures.length > 0 && (
          <div className="mb-3">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Key Features</p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1">
              {keyFeatures.map((feature, idx) => (
                <li key={idx} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-1.5">
                  <span className="text-green-500 mt-0.5">&#x2022;</span>{feature}
                </li>
              ))}
            </ul>
          </div>
        )}

        {listing.description && (
          <div className="mb-3">
            <button
              type="button"
              onClick={() => setShowDescription(!showDescription)}
              className="flex items-center gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase hover:text-gray-700 dark:hover:text-gray-300"
            >
              Description
              {showDescription ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            {showDescription && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 whitespace-pre-line max-h-40 overflow-y-auto">
                {listing.description}
              </p>
            )}
          </div>
        )}

        {listing.agentName && (
          <div className="flex items-center gap-2 py-2 px-3 bg-gray-50 dark:bg-slate-800/50 rounded text-sm text-gray-600 dark:text-gray-400">
            {listing.agentLogoUrl && (
              <img src={listing.agentLogoUrl} alt={listing.agentName} className="h-6 object-contain" />
            )}
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-300">{listing.agentName}</span>
              {listing.agentBranch && <span className="text-gray-500 dark:text-gray-400"> — {listing.agentBranch}</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ListingPreviewCard;
