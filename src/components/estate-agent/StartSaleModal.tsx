// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Start-sale progress modal shell — seller-details form then the 4-step
 * saga checklist. All state/orchestration lives in useStartSaleSaga; this
 * component is just the modal chrome + phase switch.
 */

import type { AgentListingRow } from '@/types/estateAgentListing.types';
import type { StartSaleResult } from '@/services/startSale.service';
import { useStartSaleSaga } from '@/hooks/useStartSaleSaga';
import StartSaleForm from '@/components/estate-agent/StartSaleForm';
import StartSaleProgressPanel from '@/components/estate-agent/StartSaleProgressPanel';

interface StartSaleModalProps {
  isOpen: boolean;
  listing: AgentListingRow;
  agentPrincipal: string;
  onClose: () => void;
  onComplete: (result: StartSaleResult) => void;
}

export default function StartSaleModal({
  isOpen,
  listing,
  agentPrincipal,
  onClose,
  onComplete,
}: StartSaleModalProps): JSX.Element | null {
  const saga = useStartSaleSaga({ listing, agentPrincipal, onComplete, onClose });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={saga.phase === 'form' ? saga.handleClose : undefined}
        role="presentation"
      />
      <div className="relative mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800">
        <h2 className="font-[Fraunces] text-xl font-semibold text-gray-900 dark:text-gray-50">Start sale</h2>
        <p className="mt-1 font-[DM_Sans] text-sm text-gray-500 dark:text-gray-400">
          {saga.phase === 'form' ? 'Enter the seller’s details to begin.' : 'Processing…'}
        </p>
        <div className="mt-5">
          {saga.phase === 'form' ? (
            <StartSaleForm isSubmitting={saga.isSubmitting} onSubmit={saga.runSaga} onCancel={saga.handleClose} />
          ) : (
            <StartSaleProgressPanel
              phase={saga.phase}
              steps={saga.steps}
              result={saga.result}
              sellerEmail={saga.sellerEmail}
              resendStatus={saga.resendStatus}
              onResend={saga.handleResend}
              onRetry={saga.handleRetry}
              onClose={saga.handleClose}
              onDone={saga.handleDone}
            />
          )}
        </div>
      </div>
    </div>
  );
}
