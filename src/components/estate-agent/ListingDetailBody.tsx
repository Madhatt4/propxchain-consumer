// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The listing detail page's layout — header, details, material info,
 * parties section, and the start-sale modal — extracted from
 * ListingDetailPage so that page's own body stays under the 50-line
 * declaration-to-close budget.
 */

import { ListingDetailHeader } from '@/components/estate-agent/ListingDetailHeader';
import { ListingDetailsSection } from '@/components/estate-agent/ListingDetailsSection';
import { ListingMaterialInfoSection } from '@/components/estate-agent/ListingMaterialInfoSection';
import StartSaleModal from '@/components/estate-agent/StartSaleModal';
import ListingPartiesSection from '@/components/estate-agent/ListingPartiesSection';
import { StallLine } from '@/components/transaction/flow/StallLine';
import ClientPanel from '@/components/estate-agent/ClientPanel';
import ChaseLogPanel from '@/components/estate-agent/ChaseLogPanel';
import type { AgentListingRow, AgentListingStatus } from '@/types/estateAgentListing.types';
import type { MaterialInfo, MaterialInfoOverrides } from '@/types/materialInfo.types';
import type { PropertyListing, ProvenanceMap } from '@/types/listing.types';
import type { UseListingStartSaleResult } from '@/hooks/useListingStartSale';

export interface ListingDetailBodyProps {
  row: AgentListingRow;
  info: MaterialInfo;
  overrides: MaterialInfoOverrides;
  onOverridesChange: (next: MaterialInfoOverrides) => void;
  canPublish: boolean;
  onStatusChange: (status: AgentListingStatus) => void;
  onPublish: () => void;
  onDetailsSave: (
    updated: PropertyListing,
    provenance: ProvenanceMap,
    agentUrl: string | null | undefined,
  ) => void;
  onMaterialInfoSave: () => void;
  isMaterialInfoSaving: boolean;
  statusError: string | null;
  publishError: string | null;
  inviteCode: string | null;
  agentPrincipal: string | null;
  startSale: UseListingStartSaleResult;
}

interface ListingDetailExtrasProps {
  row: AgentListingRow;
  inviteCode: string | null;
  agentPrincipal: string | null;
  startSale: UseListingStartSaleResult;
}

/** The parties section (once linked to a transaction) + the start-sale
 *  modal (once we know who the agent is). */
function ListingDetailExtras({ row, inviteCode, agentPrincipal, startSale }: ListingDetailExtrasProps): JSX.Element {
  return (
    <>
      {row.transaction_id && (
        <>
          {/* Who the sale is waiting on, the same line the chase list shows. */}
          <StallLine transactionId={row.transaction_id} className="mb-4" />
          <ClientPanel
            transactionId={row.transaction_id}
            inviteCode={inviteCode}
            listingId={row.id}
            propertyAddress={row.listing.address}
          />
          <ListingPartiesSection
            transactionId={row.transaction_id}
            inviteCode={inviteCode}
            listingId={row.id}
            propertyAddress={row.listing.address}
          />
          <ChaseLogPanel transactionId={row.transaction_id} listingId={row.id} organisationId={row.organisation_id} />
        </>
      )}
      {agentPrincipal && (
        <StartSaleModal
          isOpen={startSale.isModalOpen}
          listing={row}
          agentPrincipal={agentPrincipal}
          onClose={startSale.closeModal}
          onComplete={startSale.handleComplete}
        />
      )}
    </>
  );
}

export function ListingDetailBody({
  row,
  info,
  overrides,
  onOverridesChange,
  canPublish,
  onStatusChange,
  onPublish,
  onDetailsSave,
  onMaterialInfoSave,
  isMaterialInfoSaving,
  statusError,
  publishError,
  inviteCode,
  agentPrincipal,
  startSale,
}: ListingDetailBodyProps): JSX.Element {
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <ListingDetailHeader
        row={row}
        canPublish={canPublish}
        onStatusChange={onStatusChange}
        onPublish={onPublish}
        onStartSale={startSale.openModal}
        agentPrincipal={agentPrincipal}
        statusError={statusError}
        publishError={publishError}
      />
      <ListingDetailsSection listing={row.listing} agentUrl={row.agent_url} onSave={onDetailsSave} />
      <ListingMaterialInfoSection
        info={info}
        tenure={row.listing.tenure}
        overrides={overrides}
        onOverridesChange={onOverridesChange}
        onSave={onMaterialInfoSave}
        isSaving={isMaterialInfoSaving}
      />
      <ListingDetailExtras row={row} inviteCode={inviteCode} agentPrincipal={agentPrincipal} startSale={startSale} />
    </div>
  );
}

export default ListingDetailBody;
