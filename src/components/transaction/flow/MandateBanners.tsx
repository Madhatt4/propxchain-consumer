// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The two mandate banners on the transaction flow page (spec
 * docs/plans/2026-09-06-agent-crm-spec.md, R2.1, R2.5): an agent acting for a
 * client sees whom they act for and that everything is recorded; a client who
 * granted a mandate sees who can act for them and the way to withdraw it.
 */
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, UserCheck } from 'lucide-react';
import { useMandate } from '@/hooks/useMandate';
import { revokeDelegation } from '@/services/delegation.service';
import { forgetActingFor } from '@/services/onBehalf';
import { sidesPhrase } from './mandateCopy';
import type { DealSide } from '@/services/shareParty.service';

interface MandateBannersProps {
  transactionId: string;
  myRole: DealSide;
  className?: string;
}

const BANNER = 'flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#0D9488]/40 bg-[#CCFBF1]/30 px-4 py-3';
const TEXT = 'flex items-start gap-2 font-[DM_Sans] text-sm text-[#0F766E]';
const ACTION = 'font-[DM_Sans] text-sm text-[#0F766E] underline-offset-2 hover:underline disabled:opacity-60';

export function MandateBanners({ transactionId, myRole, className = '' }: MandateBannersProps): JSX.Element | null {
  const mandate = useMandate(transactionId, myRole);
  const queryClient = useQueryClient();
  const withdraw = useMutation({
    mutationFn: async () => {
      const id = mandate.grantedByMe?.id;
      if (!id) throw new Error('No mandate to withdraw');
      return revokeDelegation(id);
    },
    onSuccess: () => {
      forgetActingFor(transactionId);
      void queryClient.invalidateQueries({ queryKey: ['tx-delegations', transactionId] });
    },
  });

  if (mandate.actingFor.length > 0) {
    return (
      <div data-testid="acting-for-banner" data-side={mandate.actingFor.join(',')} className={`${BANNER} ${className}`}>
        <p className={TEXT}>
          <UserCheck size={18} aria-hidden className="mt-0.5 shrink-0" />
          <span>
            <strong>Acting for {sidesPhrase(mandate.actingFor)} on this deal.</strong> Everything you do here is recorded in their name.
            Anything with legal weight still goes to them to confirm.
          </span>
        </p>
        <Link to="/estate-agent/pipeline" className={ACTION}>
          Back to your pipeline
        </Link>
      </div>
    );
  }

  if (mandate.grantedByMe) {
    return (
      <div data-testid="client-mandate-banner" className={`${BANNER} ${className}`}>
        <p className={TEXT}>
          <ShieldCheck size={18} aria-hidden className="mt-0.5 shrink-0" />
          <span>
            <strong>{mandate.agencyName ?? 'Your estate agent'} can act for you on this deal.</strong> Anything with legal weight still comes
            to you to confirm, and everything they do is on the audit trail.
          </span>
        </p>
        <button type="button" disabled={withdraw.isPending} onClick={() => withdraw.mutate()} className={ACTION}>
          {withdraw.isPending ? 'Withdrawing…' : 'Withdraw this'}
        </button>
        {withdraw.isError && (
          <p role="alert" className="w-full font-[DM_Sans] text-sm text-[#9A3412] dark:text-[#FDBA74]">
            Could not withdraw just now. Try again in a moment.
          </p>
        )}
      </div>
    );
  }

  return null;
}
