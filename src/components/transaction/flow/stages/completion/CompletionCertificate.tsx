// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { useState } from 'react';
import { jsPDF } from 'jspdf';
import { sideConfirmationText } from '@/lib/completionText';
import type { ReactNode } from 'react';
import type { CompletionStatus } from '@/services/completionStatus';
import type { JourneyRole } from '../../../../../types/stage.types';

interface CompletionCertificateProps {
  journeyRole: JourneyRole;
  transactionId?: string;
  status: CompletionStatus;
}

const LABEL = 'text-xs uppercase tracking-wide text-gray-400 dark:text-slate-500 font-medium';
const VALUE = 'text-sm text-gray-700 dark:text-slate-300';
const SECONDARY_BUTTON =
  'px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors';

function reference(transactionId: string | undefined): string {
  return transactionId ? `#PXC-${transactionId.slice(0, 8).toUpperCase()}` : '#PXC-...';
}

// Each side says how it was confirmed, so a client-confirmed side is never
// presented as if a conveyancer had verified it.
function sideLines(status: CompletionStatus): [string, string] {
  return [
    `Buyer's side: ${sideConfirmationText('buyer', status.buyer)}`,
    `Seller's side: ${sideConfirmationText('seller', status.seller)}`,
  ];
}

function downloadPdf(journeyRole: JourneyRole, transactionId: string | undefined, status: CompletionStatus, at: Date): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Completion record', 20, 30);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(journeyRole === 'buyer' ? 'Property purchase complete.' : 'Property sale complete.', 20, 40);
  doc.setFontSize(10);
  doc.text(`Transaction: ${reference(transactionId)}`, 20, 56);
  doc.text(`Completed: ${at.toLocaleString('en-GB')}`, 20, 64);
  sideLines(status).forEach((line, i) => doc.text(line, 20, 72 + i * 8));
  doc.text('Recorded on: Internet Computer Blockchain', 20, 88);
  doc.setTextColor(120);
  doc.setFontSize(8);
  doc.text('Legal title transfers when HM Land Registry processes the AP1 registration.', 20, 280);
  doc.text('This record confirms the completion was recorded on PropXchain.', 20, 285);
  doc.save(`propxchain-completion-${transactionId ?? 'transaction'}.pdf`);
}

/** Shown only once transaction_manager reports completion. */
export function CompletionCertificate({ journeyRole, transactionId, status }: CompletionCertificateProps): ReactNode {
  const [shareLabel, setShareLabel] = useState<'idle' | 'copied'>('idle');
  // Completion happens on the seller side's confirmation.
  const at = status.seller?.at ?? new Date();

  function handleShare(): void {
    const url = `${window.location.origin}/certificate/${transactionId ?? ''}`;
    void navigator.clipboard.writeText(url).then(() => {
      setShareLabel('copied');
      setTimeout(() => setShareLabel('idle'), 2000);
    });
  }

  function handleVerify(): void {
    // The on-chain audit page shows verifiers the event trail.
    if (transactionId) window.location.assign(`/transaction/${transactionId}/audit`);
  }

  return (
    <section className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-[#0F1729] p-5">
      <h3 className="text-base font-semibold text-gray-900 dark:text-white">Completion record</h3>
      <p className="text-sm text-gray-600 dark:text-slate-400 mt-0.5">
        {journeyRole === 'buyer' ? 'Your property purchase is complete.' : 'Your property sale is complete.'}
      </p>
      <dl className="mt-4 space-y-3">
        <div><dt className={LABEL}>Transaction</dt><dd className={`${VALUE} font-mono`}>{reference(transactionId)}</dd></div>
        <div>
          <dt className={LABEL}>Completed</dt>
          <dd className={VALUE}>
            {at.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} at{' '}
            {at.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </dd>
        </div>
        <div>
          <dt className={LABEL}>How each side confirmed</dt>
          {sideLines(status).map((line) => <dd key={line} className={VALUE}>{line}</dd>)}
        </div>
        <div><dt className={LABEL}>Recorded on</dt><dd className={VALUE}>Internet Computer Blockchain</dd></div>
      </dl>
      <div className="flex gap-2 mt-5 pt-4 border-t border-gray-200 dark:border-slate-700">
        <button type="button" onClick={handleShare} className="flex-1 px-3 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold transition-colors">
          {shareLabel === 'copied' ? 'Copied!' : 'Share record'}
        </button>
        <button type="button" onClick={() => downloadPdf(journeyRole, transactionId, status, at)} className={SECONDARY_BUTTON}>PDF</button>
        <button type="button" onClick={handleVerify} className={SECONDARY_BUTTON}>Verify</button>
      </div>
    </section>
  );
}
