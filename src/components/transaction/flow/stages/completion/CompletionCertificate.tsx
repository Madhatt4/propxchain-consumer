// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { useState, type ReactNode } from 'react';
import { Award, Share2, Download, ExternalLink } from 'lucide-react';
import { jsPDF } from 'jspdf';
import type { JourneyRole } from '../../../../../types/stage.types';

interface CompletionCertificateProps {
  journeyRole: JourneyRole;
  transactionId?: string;
  /** When the canister recorded completion (the second side's confirmation). */
  completedAt: Date | null;
}

function reference(transactionId: string | undefined): string {
  return transactionId ? `#PXC-${transactionId.slice(0, 8).toUpperCase()}` : '#PXC-...';
}

function downloadPdf(journeyRole: JourneyRole, transactionId: string | undefined, completedAt: Date): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('PropXchain Completion Certificate', 20, 30);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(journeyRole === 'buyer' ? 'Property purchase complete.' : 'Property sale complete.', 20, 40);
  doc.setFontSize(10);
  doc.text(`Transaction: ${reference(transactionId)}`, 20, 60);
  doc.text(`Completed: ${completedAt.toLocaleString('en-GB')}`, 20, 68);
  doc.text('Recorded on: Internet Computer Blockchain', 20, 76);
  doc.setTextColor(120);
  doc.setFontSize(8);
  doc.text('Legal title transfers when HM Land Registry processes the AP1 registration.', 20, 280);
  doc.text('This certificate confirms the transaction was recorded on PropXchain.', 20, 285);
  doc.save(`propxchain-certificate-${transactionId ?? 'transaction'}.pdf`);
}

/** Shown only once transaction_manager reports completion. */
export function CompletionCertificate({ journeyRole, transactionId, completedAt }: CompletionCertificateProps): ReactNode {
  const [shareLabel, setShareLabel] = useState<'idle' | 'copied'>('idle');
  const at = completedAt ?? new Date();

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
    <div className="rounded-xl border-2 border-teal-200 dark:border-teal-800 bg-white dark:bg-[#0F1729] p-6">
      <div className="text-center mb-6">
        <div className="mx-auto w-16 h-16 rounded-full bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center mb-4">
          <Award className="h-8 w-8 text-teal-600 dark:text-teal-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white font-['Fraunces',serif]">
          {journeyRole === 'buyer' ? 'Congratulations!' : 'Sale Complete'}
        </h2>
        <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
          {journeyRole === 'buyer' ? 'Your property purchase is complete.' : 'Your property sale is complete.'}
        </p>
      </div>

      <div className="border-t border-gray-200 dark:border-slate-700 pt-4 space-y-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-400 dark:text-slate-500 font-medium">Transaction</p>
          <p className="text-sm font-mono text-gray-700 dark:text-slate-300">{reference(transactionId)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-400 dark:text-slate-500 font-medium">Completed</p>
          <p className="text-sm text-gray-700 dark:text-slate-300">
            {at.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} at{' '}
            {at.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-400 dark:text-slate-500 font-medium">Recorded on</p>
          <p className="text-sm text-gray-700 dark:text-slate-300">Internet Computer Blockchain</p>
        </div>
      </div>

      <div className="flex gap-2 mt-5 pt-4 border-t border-gray-200 dark:border-slate-700">
        <button
          type="button"
          onClick={handleShare}
          className="flex-1 px-3 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
        >
          <Share2 className="h-4 w-4" />
          {shareLabel === 'copied' ? 'Copied!' : 'Share Certificate'}
        </button>
        <button
          type="button"
          onClick={() => downloadPdf(journeyRole, transactionId, at)}
          className="px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-2"
        >
          <Download className="h-4 w-4" />
          PDF
        </button>
        <button
          type="button"
          onClick={handleVerify}
          className="px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-2"
        >
          <ExternalLink className="h-4 w-4" />
          Verify
        </button>
      </div>
    </div>
  );
}
