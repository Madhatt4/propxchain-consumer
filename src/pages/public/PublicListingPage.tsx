// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Public listing view — /property/:slug (spec §5.4). Anonymous, indexable
 * (the SPA shell controls robots meta — this page adds none). Reads only
 * the `public_agent_listings` view via `getPublicBySlug`, which excludes
 * `transaction_id` and `organisation_id` — this page must never fetch or
 * render anything beyond that record.
 */
import { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { estateAgentListingsService } from '@/services/estateAgentListings.service';
import { MaterialInfoPanel } from '@/components/public/MaterialInfoPanel';
import {
  StatusRibbon,
  PhotoStrip,
  KeyFactChips,
  DescriptionAndFeatures,
  AgencyCard,
  PropXchainReadyBadge,
  formatGbp,
} from '@/components/public/PublicListingSections';
import type { PublicListingRecord } from '@/services/estateAgentListings.service';

function CenteredMessage({ children }: { children: React.ReactNode }): JSX.Element {
  return <div className="mx-auto max-w-3xl px-6 py-12 text-center">{children}</div>;
}

function NotAvailable(): JSX.Element {
  return (
    <CenteredMessage>
      <p className="font-[DM_Sans] text-sm text-[#6B7280]">This property isn&apos;t available.</p>
      <Link to="/" className="mt-4 inline-block font-[DM_Sans] text-sm font-medium text-[#0D9488] underline">
        Back to PropXchain
      </Link>
    </CenteredMessage>
  );
}

/**
 * `JSON.stringify` a JSON-LD payload for injection into a `<script>` via
 * `dangerouslySetInnerHTML`. Listing fields (address, image URLs) come from
 * scraped/agent-entered data on an anonymous public page, so a literal
 * `</script>` inside a string value would close the tag early and let the
 * remainder parse as HTML — escape `<` to `<` to prevent that.
 */
function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

/** JSON-LD `<script>` describing this listing as a schema.org RealEstateListing. */
function ListingJsonLd({ record }: { record: PublicListingRecord }): JSX.Element {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    name: record.listing.address,
    url: window.location.href,
    offers: { '@type': 'Offer', price: record.listing.price, priceCurrency: 'GBP' },
    image: (record.listing.images ?? []).map((image) => image.url),
  };
  return (
    // eslint-disable-next-line react/no-danger
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
  );
}

/** Renders one published listing: photos, headline facts, material info,
 *  description, and the agency contact card. */
function ListingBody({ record }: { record: PublicListingRecord }): JSX.Element {
  const { listing } = record;

  useEffect(() => {
    document.title = `${listing.address} — ${record.agency_name}`;
  }, [listing.address, record.agency_name]);

  return (
    <article className="mx-auto max-w-2xl pb-10">
      <ListingJsonLd record={record} />
      <StatusRibbon status={record.status} />
      <PhotoStrip images={listing.images} />
      <div className="space-y-4 px-4 pt-4">
        <div>
          <h1 className="font-[Fraunces] text-2xl font-semibold text-[#1A1A1A]">{listing.address}</h1>
          <p className="mt-1 font-[DM_Sans] text-xl font-semibold text-[#0D9488]">{formatGbp(listing.price)}</p>
        </div>
        <KeyFactChips
          bedrooms={listing.bedrooms}
          bathrooms={listing.bathrooms}
          tenure={listing.tenure}
          propertyType={listing.propertyType}
        />
      </div>
      <div className="mt-6">
        <h2 className="mb-2 px-4 font-[DM_Sans] text-lg font-semibold text-[#1A1A1A]">Material information</h2>
        <div className="px-4">
          <MaterialInfoPanel info={record.material_info} tenure={listing.tenure} />
        </div>
      </div>
      <div className="mt-6">
        <DescriptionAndFeatures description={listing.description} keyFeatures={listing.keyFeatures} />
      </div>
      <div className="mt-6 space-y-4">
        <AgencyCard agencyName={record.agency_name} agencyBranch={record.agency_branch} />
        <PropXchainReadyBadge />
      </div>
    </article>
  );
}

export default function PublicListingPage(): JSX.Element {
  const { slug } = useParams<{ slug: string }>();

  const { data: record, isLoading } = useQuery({
    queryKey: ['public-listing', slug],
    enabled: !!slug,
    queryFn: () => estateAgentListingsService.getPublicBySlug(slug!),
  });

  if (isLoading) return <CenteredMessage>Loading…</CenteredMessage>;
  if (!record) return <NotAvailable />;
  return <ListingBody record={record} />;
}
