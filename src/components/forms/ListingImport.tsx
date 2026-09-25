import React, { useState, useCallback } from 'react';
import { Link2, X, Home, Loader2, Pencil } from 'lucide-react';
import { scrapeListing, isValidListingUrl } from '@/services/listing.service';
import type { PropertyListing, ProvenanceMap } from '@/types/listing.types';
import { REQUIRED_FIELDS } from '@/types/listing.types';
import ListingPreviewCard from './ListingPreviewCard';
import ListingEditForm from './ListingEditForm';

interface Props {
  onImport: (listing: PropertyListing) => void;
}

const REQUIRED_LABELS: Record<string, string> = {
  address: 'address', postcode: 'postcode', price: 'price',
  propertyType: 'property type', bedrooms: 'bedrooms', tenure: 'tenure',
};

function missingRequired(listing: PropertyListing, prov: ProvenanceMap): string[] {
  return REQUIRED_FIELDS.filter((f) => {
    if (prov[f] === 'missing') return true;
    const v = listing[f as keyof PropertyListing];
    if (v === undefined || v === null) return true;
    if (typeof v === 'string') return v.trim().length === 0 || (f === 'tenure' && v === 'unknown');
    if (typeof v === 'number') return v <= 0;
    return false;
  }).map((f) => REQUIRED_LABELS[f] || f);
}

const ListingImport: React.FC<Props> = ({ onImport }) => {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listing, setListing] = useState<PropertyListing | null>(null);
  const [provenance, setProvenance] = useState<ProvenanceMap | null>(null);
  const [editing, setEditing] = useState(false);

  const runScrape = useCallback(async (target: string): Promise<void> => {
    setIsLoading(true);
    setError(null);
    setListing(null);
    setProvenance(null);
    try {
      const result = await scrapeListing(target);
      setListing(result.listing);
      setProvenance(result.provenance);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import listing');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleImport = useCallback((): void => {
    const trimmed = url.trim();
    if (!trimmed) { setError('Please paste a Rightmove listing URL'); return; }
    if (!isValidListingUrl(trimmed)) { setError('Please paste a rightmove.co.uk property URL'); return; }
    runScrape(trimmed);
  }, [url, runScrape]);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>): void => {
    const pasted = e.clipboardData.getData('text').trim();
    if (isValidListingUrl(pasted)) {
      setUrl(pasted);
      setTimeout(() => runScrape(pasted), 0);
    }
  }, [runScrape]);

  const handleClear = useCallback((): void => {
    setUrl(''); setListing(null); setProvenance(null); setError(null); setEditing(false);
  }, []);

  const handleSaveEdit = useCallback((updated: PropertyListing, newProv: ProvenanceMap): void => {
    setListing(updated);
    setProvenance(newProv);
    setEditing(false);
  }, []);

  const missing = listing && provenance ? missingRequired(listing, provenance) : [];
  const hasMissing = missing.length > 0;
  const canUse = listing !== null && provenance !== null && !hasMissing;

  return (
    <div className="mb-6">
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
        <label
          htmlFor="listing-import-url"
          className="flex items-center gap-2 text-sm font-medium text-green-900 mb-2"
        >
          <Link2 className="w-4 h-4" /> Import from a Rightmove listing URL
        </label>
        <div className="flex gap-2">
          <input
            id="listing-import-url"
            name="rightmoveUrl"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onPaste={handlePaste}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleImport())}
            disabled={isLoading}
            className="flex-1 h-11 px-3 py-2 border border-green-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 bg-white text-gray-900"
            placeholder="Paste a Rightmove property URL..."
          />
          {listing ? (
            <button type="button" onClick={handleClear}
              className="h-11 px-3 border border-gray-300 text-gray-600 rounded-md hover:bg-gray-50 flex items-center gap-1">
              <X className="w-4 h-4" /> Clear
            </button>
          ) : (
            <button type="button" onClick={handleImport} disabled={isLoading || !url.trim()}
              className="h-11 px-4 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center gap-2">
              {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Importing...</> : 'Import'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {listing && provenance && (
        <div className="mt-4 space-y-3">
          {hasMissing && (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-md flex items-start justify-between gap-3">
              <p className="text-sm text-amber-900">
                We couldn&apos;t find: <span className="font-semibold">{missing.join(', ')}</span>.
                Edit to add these before importing.
              </p>
              <button type="button" onClick={() => setEditing(true)}
                className="flex-shrink-0 h-9 px-3 text-sm bg-amber-600 text-white rounded-md hover:bg-amber-700 flex items-center gap-1">
                <Pencil className="w-4 h-4" /> Edit details
              </button>
            </div>
          )}

          {editing ? (
            <ListingEditForm listing={listing} onSave={handleSaveEdit} onCancel={() => setEditing(false)} />
          ) : (
            <>
              <ListingPreviewCard listing={listing} provenance={provenance} />
              <div className="flex gap-2">
                {!hasMissing && (
                  <button type="button" onClick={() => setEditing(true)}
                    className="h-11 px-4 border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-1">
                    <Pencil className="w-4 h-4" /> Edit details
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => listing && onImport(listing)}
                  disabled={!canUse}
                  className="flex-1 h-11 bg-green-600 text-white font-medium rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Home className="w-4 h-4" />
                  {canUse ? 'Use This Property' : 'Complete required fields'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ListingImport;
