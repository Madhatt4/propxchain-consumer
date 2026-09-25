import { useState } from 'react';
import type { ReactElement } from 'react';
import { Home, Camera, BedDouble, ShowerHead, Check } from 'lucide-react';
import type { RightmovePropertyListing } from '../../../types/rightmove.types';
import { GlassCard } from '../../ui/GlassCard';
import { safeExternalUrl } from '@/utils/externalUrl';

interface PropertyListingCardProps {
  listing: RightmovePropertyListing | null;
  /** @deprecated Invite code is now surfaced by BuyerInviteCard. Prop kept
   *  for backward compat with existing call sites; value is ignored. */
  inviteCode?: string;
}

function formatPrice(price: number): string {
  return `£${price.toLocaleString('en-GB')}`;
}

function capitalise(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function PropertyListingCard({ listing }: PropertyListingCardProps): ReactElement | null {
  const [activeImage, setActiveImage] = useState(0);

  if (!listing) return null;

  // Manual entries shouldn't claim Rightmove provenance. Show a neutral
  // "Manual entry" label for those, and skip the trailing "View on ..." link
  // (no URL). Imports keep "via Rightmove" / "via Purplebricks" etc.
  // Listings pre-dating the manual source flag may carry source='rightmove'
  // with an empty URL — treat those as manual too (a real scrape always
  // has a URL).
  const hasSourceUrl = !!listing.url;
  const isManual = !listing.source || listing.source === 'manual' || !hasSourceUrl;
  const sourceLabel = isManual ? 'Manual entry' : capitalise(listing.source);
  const images = listing.images ?? [];
  const heroImage = images[activeImage]?.url;
  const thumbnails = images.slice(0, 5);
  const extraCount = images.length > 5 ? images.length - 5 : 0;

  return (
    <GlassCard variant="default" className="p-4 lg:p-5 relative overflow-hidden">
      {/* Ambient accent — sage tint matches DESIGN.md (no purple). */}
      <div className="absolute -top-16 -right-16 w-40 h-40 bg-[#84A98C]/[0.06] rounded-full blur-3xl pointer-events-none" />

      {/* Invite code surfaced by BuyerInviteCard at the top of the right
          rail; removed from here 2026-04-21 to avoid duplicate display on
          the seller dashboard (dbccf6a added the dedicated card without
          removing the inline copy). */}

      {/* Header */}
      <div className="flex justify-between items-center mb-3 relative">
        <span className="text-[11px] text-[#5F8A68] dark:text-[#9CB8A4] font-bold uppercase tracking-[2px]">Listing</span>
        <span className="text-[9px] text-[#5F8A68] dark:text-[#9CB8A4] bg-[#84A98C]/10 border border-[#84A98C]/20 px-2.5 py-1 rounded-[10px] font-semibold">
          {isManual ? sourceLabel : `via ${sourceLabel}`}
        </span>
      </div>

      {/* Hero Image */}
      <div className="w-full h-48 lg:h-64 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-[#131a2e] dark:to-[#0f1628] rounded-xl mb-2 flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/20 dark:to-[rgba(6,11,24,0.6)]" />
        {heroImage ? (
          <img
            src={heroImage}
            alt={listing.address}
            className="absolute inset-0 w-full h-full object-cover z-10"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <Home className="h-16 w-16 relative z-10 drop-shadow-lg text-gray-400 dark:text-slate-500" aria-hidden />
        )}
        {images.length > 0 && (
          <span className="absolute bottom-2.5 right-3 z-20 bg-black/60 backdrop-blur-lg px-2.5 py-1 rounded-lg text-[10px] text-slate-200 font-semibold inline-flex items-center gap-1">
            <Camera className="h-3 w-3" aria-hidden /> {activeImage + 1} / {images.length}
          </span>
        )}
      </div>

      {/* Thumbnails */}
      {thumbnails.length > 1 && (
        <div className="flex gap-1 mb-4">
          {thumbnails.map((img, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActiveImage(i)}
              className={`flex-1 h-12 lg:h-14 rounded-[10px] border transition-colors cursor-pointer overflow-hidden ${
                i === activeImage
                  ? 'border-teal-500/40 bg-teal-50 dark:bg-slate-700/10'
                  : 'border-gray-200 dark:border-slate-700/10 bg-gray-50 dark:bg-slate-700/5 hover:border-gray-300 dark:hover:border-slate-600/20'
              }`}
            >
              <img
                src={img.url}
                alt={img.caption || `Image ${i + 1}`}
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </button>
          ))}
          {extraCount > 0 && (
            <div className="flex-1 h-12 lg:h-14 rounded-[10px] border border-gray-200 dark:border-slate-700/8 bg-gray-50 dark:bg-slate-700/5 flex items-center justify-center text-xs text-gray-500 dark:text-slate-500 font-semibold">
              +{extraCount}
            </div>
          )}
        </div>
      )}

      {/* Details */}
      <p className="text-lg font-extrabold text-gray-900 dark:text-slate-100 tracking-tight">{listing.address}</p>
      <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{listing.postcode}</p>
      {listing.uprn && (
        <p
          className="text-[10px] text-gray-500 dark:text-slate-400 mt-1"
          title="UPRN — a free, unique ID for the property, like a barcode for the address. It identifies the property, not the owner."
        >
          UPRN <span className="font-mono text-gray-700 dark:text-slate-300">{listing.uprn}</span>
        </p>
      )}

      <p className="text-2xl font-black mt-3 text-teal-700 dark:text-teal-300">
        {listing.priceQualifier ? `${listing.priceQualifier} ` : ''}{formatPrice(listing.price)}
      </p>

      {/* Specs */}
      <div className="flex gap-3 mt-3 flex-wrap">
        {listing.bedrooms > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-slate-300 glass rounded-lg px-2.5 py-1.5">
            <BedDouble className="h-3.5 w-3.5" aria-hidden /> {listing.bedrooms} bed
          </div>
        )}
        {listing.bathrooms > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-slate-300 glass rounded-lg px-2.5 py-1.5">
            <ShowerHead className="h-3.5 w-3.5" aria-hidden /> {listing.bathrooms} bath
          </div>
        )}
        {listing.propertyType && listing.propertyType !== 'unknown' && (
          <div className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-slate-300 glass rounded-lg px-2.5 py-1.5">
            <Home className="h-3.5 w-3.5" aria-hidden /> {capitalise(listing.propertyType)}
          </div>
        )}
      </div>

      {/* Key Features */}
      {listing.keyFeatures && listing.keyFeatures.length > 0 && (
        <div className="mt-3">
          <ul className="grid grid-cols-2 gap-1">
            {listing.keyFeatures.slice(0, 6).map((f, i) => (
              <li key={i} className="text-[10px] text-gray-500 dark:text-slate-400 flex items-center gap-1">
                <Check className="h-3 w-3 shrink-0 text-green-600 dark:text-green-400" aria-hidden /> {f}
              </li>
            ))}
          </ul>
        </div>
      )}

      <hr className="border-gray-200 dark:border-slate-700/8 my-4" />

      {/* Description */}
      <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed line-clamp-4">{listing.description}</p>

      {/* Tags */}
      <div className="flex gap-2 mt-3 flex-wrap">
        {listing.epcRating && (
          <span className="px-3 py-1 rounded-lg text-[10px] font-semibold bg-green-500/8 border border-green-500/18 text-green-600 dark:text-green-400">
            EPC: {listing.epcRating}
          </span>
        )}
        {listing.tenure && listing.tenure !== 'unknown' && (
          <span className="px-3 py-1 rounded-lg text-[10px] font-semibold bg-gray-100 dark:bg-slate-500/5 border border-gray-200 dark:border-slate-500/10 text-gray-600 dark:text-slate-400">
            {capitalise(listing.tenure)}
          </span>
        )}
      </div>

      {/* Agent */}
      {listing.agentName && (
        <p className="text-[10px] text-gray-500 dark:text-slate-500 mt-3">
          Agent: {listing.agentName}{listing.agentBranch ? ` — ${listing.agentBranch}` : ''}
        </p>
      )}

      {/* Footer */}
      <div className="flex justify-between items-center mt-4 pt-3 border-t border-gray-200 dark:border-slate-700/8">
        <span className="text-[10px] text-gray-500 dark:text-slate-500">
          {isManual ? sourceLabel : `via ${sourceLabel}`}
        </span>
        {!isManual && safeExternalUrl(listing.url) && (
          <a
            href={safeExternalUrl(listing.url) ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-teal-700 dark:text-teal-400 font-semibold hover:text-teal-600 dark:hover:text-teal-300 transition-colors"
          >
            View on {sourceLabel} →
          </a>
        )}
      </div>
    </GlassCard>
  );
}
