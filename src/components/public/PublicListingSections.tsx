// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Small, prop-only presentational pieces for `PublicListingPage`, split out
 * to keep the page component and each function within the repo's size
 * limits. No hooks, no service calls.
 */

import type { ListingImage } from '@/types/listing.types';
import type { AgentListingStatus } from '@/types/estateAgentListing.types';
import { STATUS_LABELS } from '@/components/estate-agent/ListingStatusBadge';

const GBP_FORMATTER = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  maximumFractionDigits: 0,
});

/** Formats a price as e.g. "£250,000". */
export function formatGbp(value: number): string {
  return GBP_FORMATTER.format(value);
}

export interface StatusRibbonProps {
  status: AgentListingStatus;
}

/** Banner shown for any status other than `for_sale` (under offer, sold, etc). */
export function StatusRibbon({ status }: StatusRibbonProps): JSX.Element | null {
  if (status === 'for_sale') return null;
  return (
    <div className="bg-[#1A1A1A] px-4 py-2 text-center font-[DM_Sans] text-sm font-medium text-white">
      {STATUS_LABELS[status]}
    </div>
  );
}

export interface PhotoStripProps {
  images: ListingImage[];
}

/** Horizontally scrollable strip of the first few listing photos. */
export function PhotoStrip({ images }: PhotoStripProps): JSX.Element | null {
  const shown = images.slice(0, 6);
  if (shown.length === 0) return null;
  return (
    <div className="flex snap-x gap-2 overflow-x-auto px-4 py-3">
      {shown.map((image, index) => (
        <img
          key={image.url}
          src={image.url}
          alt={image.caption || `Property photo ${index + 1}`}
          className="h-48 w-64 flex-shrink-0 snap-start rounded-lg object-cover"
        />
      ))}
    </div>
  );
}

export interface KeyFactChipsProps {
  bedrooms: number;
  bathrooms: number;
  tenure: string;
  propertyType: string;
}

/** Row of small chips summarising bedrooms/bathrooms/tenure/property type. */
export function KeyFactChips({ bedrooms, bathrooms, tenure, propertyType }: KeyFactChipsProps): JSX.Element {
  const facts = [`${bedrooms} bed`, `${bathrooms} bath`, tenure, propertyType].filter(Boolean);
  return (
    <div className="flex flex-wrap gap-2 px-4">
      {facts.map((fact) => (
        <span
          key={fact}
          className="rounded-full bg-[#0D9488]/10 px-3 py-1 font-[DM_Sans] text-xs font-medium capitalize text-[#0D9488]"
        >
          {fact}
        </span>
      ))}
    </div>
  );
}

export interface DescriptionAndFeaturesProps {
  description: string;
  keyFeatures: string[];
}

/** Free-text description followed by a bullet list of key features. */
export function DescriptionAndFeatures({ description, keyFeatures }: DescriptionAndFeaturesProps): JSX.Element {
  return (
    <div className="space-y-3 px-4">
      <p className="font-[DM_Sans] text-sm leading-relaxed text-[#1A1A1A]">{description}</p>
      {keyFeatures.length > 0 && (
        <ul className="list-inside list-disc space-y-1 font-[DM_Sans] text-sm text-[#1A1A1A]">
          {keyFeatures.map((feature) => (
            <li key={feature}>{feature}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export interface AgencyCardProps {
  agencyName: string;
  agencyBranch: string | null;
}

/** "Contact <agency>" card. No email/mailto — the public view has no
 *  agency email column in v1. */
export function AgencyCard({ agencyName, agencyBranch }: AgencyCardProps): JSX.Element {
  return (
    <div className="mx-4 rounded-lg border border-[#E5E7EB] bg-white p-4">
      <p className="font-[DM_Sans] text-sm font-semibold text-[#1A1A1A]">
        Contact {agencyName}
        {agencyBranch ? `, ${agencyBranch}` : ''}
      </p>
    </div>
  );
}

/** Badge advertising that this listing published its material information up front. */
export function PropXchainReadyBadge(): JSX.Element {
  return (
    <div className="mx-4 rounded-lg border border-[#84A98C] bg-[#84A98C]/10 p-4">
      <p className="font-[DM_Sans] text-sm font-semibold text-[#5F8A68]">PropXchain-ready</p>
      <p className="mt-1 font-[DM_Sans] text-xs text-[#5F8A68]">
        This listing publishes its material information up front — the facts a buyer needs before offering.
      </p>
    </div>
  );
}
