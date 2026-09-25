// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Read-only summary of a listing's core facts, with an "Edit details" toggle
 * that swaps in the shared `ListingEditForm`.
 */

import { useState } from 'react';

import ListingEditForm from '@/components/forms/ListingEditForm';
import { safeExternalUrl } from '@/utils/externalUrl';
import type { PropertyListing, ProvenanceMap } from '@/types/listing.types';

const GBP_FORMATTER = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  maximumFractionDigits: 0,
});

function SummaryRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="font-[DM_Sans] text-sm text-gray-500 dark:text-gray-400">{label}</span>
      <span className="font-[DM_Sans] text-sm text-gray-900 dark:text-gray-50">{value}</span>
    </div>
  );
}

/** The agency's own listing page, as a link when set. Guarded rather than
 *  rendered straight from the row: the value is agent-entered, and an
 *  unchecked `href` is where a `javascript:` payload would land. */
function AgentUrlRow({ agentUrl }: { agentUrl: string | null }): JSX.Element {
  const href = safeExternalUrl(agentUrl);
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="font-[DM_Sans] text-sm text-gray-500 dark:text-gray-400">On your website</span>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="truncate font-[DM_Sans] text-sm font-medium text-[#0D9488] hover:underline"
        >
          {href}
        </a>
      ) : (
        <span className="font-[DM_Sans] text-sm italic text-gray-400 dark:text-gray-500">Not set</span>
      )}
    </div>
  );
}

function ListingSummary({ listing, agentUrl }: { listing: PropertyListing; agentUrl: string | null }): JSX.Element {
  return (
    <div className="divide-y divide-gray-200 dark:divide-gray-700">
      <SummaryRow label="Address" value={listing.address} />
      <SummaryRow label="Postcode" value={listing.postcode} />
      <SummaryRow label="Price" value={GBP_FORMATTER.format(listing.price)} />
      <SummaryRow label="Property type" value={listing.propertyType} />
      <SummaryRow label="Bedrooms" value={String(listing.bedrooms)} />
      <SummaryRow label="Bathrooms" value={String(listing.bathrooms)} />
      <SummaryRow label="Tenure" value={listing.tenure} />
      <AgentUrlRow agentUrl={agentUrl} />
    </div>
  );
}

export interface ListingDetailsSectionProps {
  listing: PropertyListing;
  agentUrl: string | null;
  onSave: (updated: PropertyListing, provenance: ProvenanceMap, agentUrl: string | null | undefined) => void;
}

/** Details section: read-only summary, or the editable form once "Edit
 *  details" is clicked. Saving returns the view to read-only. */
export function ListingDetailsSection({ listing, agentUrl, onSave }: ListingDetailsSectionProps): JSX.Element {
  const [isEditing, setIsEditing] = useState<boolean>(false);

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-[Fraunces] text-lg font-semibold text-gray-900 dark:text-gray-50">Details</h2>
        {!isEditing && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="font-[DM_Sans] text-sm font-medium text-[#0D9488] hover:underline"
          >
            Edit details
          </button>
        )}
      </div>
      {isEditing ? (
        <ListingEditForm
          listing={listing}
          agentUrl={agentUrl}
          onSave={(updated, provenance, nextAgentUrl) => {
            onSave(updated, provenance, nextAgentUrl);
            setIsEditing(false);
          }}
          onCancel={() => setIsEditing(false)}
        />
      ) : (
        <ListingSummary listing={listing} agentUrl={agentUrl} />
      )}
    </section>
  );
}

export default ListingDetailsSection;
