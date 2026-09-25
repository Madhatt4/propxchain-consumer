import { useState, type ReactNode } from 'react';
import { Check, Banknote, Key, Award, Share2, Download, ExternalLink } from 'lucide-react';
import { jsPDF } from 'jspdf';
import type { StageConfig, JourneyRole } from '../../../../types/stage.types';

interface StageProps {
  stage: StageConfig;
  onComplete?: (stageId: string) => void;
  journeyRole?: JourneyRole;
  transactionId?: string;
}

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  icon: ReactNode;
  roles: JourneyRole[];
}

const CHECKLIST: ChecklistItem[] = [
  {
    id: 'funds-sent',
    label: 'Funds Sent',
    description: 'Confirm completion funds have been transferred.',
    icon: <Banknote className="h-5 w-5" />,
    roles: ['buyer'],
  },
  {
    id: 'funds-received',
    label: 'Funds Received',
    description: 'Confirm completion funds have been received.',
    icon: <Banknote className="h-5 w-5" />,
    roles: ['seller'],
  },
  {
    id: 'keys-handed',
    label: 'Keys Handed Over',
    description: 'Confirm physical keys have been transferred to the buyer.',
    icon: <Key className="h-5 w-5" />,
    roles: ['seller'],
  },
];

export function CompletionStage({ stage, onComplete, journeyRole = 'seller', transactionId }: StageProps): ReactNode {
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());
  // `showCertificate` was a local-optimistic flag; removed because it
  // caused the certificate to appear before the canister persisted the
  // completion. We now rely on stage.status flipping to 'completed'.

  const myItems = CHECKLIST.filter((item) => item.roles.includes(journeyRole));
  const allConfirmed = myItems.every((item) => confirmed.has(item.id));

  function toggleItem(itemId: string): void {
    setConfirmed((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }

  function handleComplete(): void {
    // Don't flip the certificate locally — let the parent's persist round
    // trip update stage.status, which is what gates the certificate view.
    // If persist fails, chainPersistError surfaces upstream and the user
    // stays on the checklist instead of seeing a "Recorded on ICP" cert
    // that never actually landed on chain.
    onComplete?.(stage.id);
  }

  // Share feedback — show "Copied!" for 2s so the user knows the click worked.
  const [shareLabel, setShareLabel] = useState<'idle' | 'copied'>('idle');

  function handleShare(): void {
    const url = `${window.location.origin}/certificate/${transactionId ?? ''}`;
    void navigator.clipboard.writeText(url).then(() => {
      setShareLabel('copied');
      setTimeout(() => setShareLabel('idle'), 2000);
    });
  }

  function handleDownloadPdf(): void {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const now = new Date();
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('PropXchain Completion Certificate', 20, 30);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(
      journeyRole === 'buyer' ? 'Property purchase complete.' : 'Property sale complete.',
      20,
      40,
    );
    doc.setFontSize(10);
    doc.text(
      `Transaction: ${transactionId ? `#PXC-${transactionId.slice(0, 8).toUpperCase()}` : '#PXC-...'}`,
      20,
      60,
    );
    doc.text(`Completed: ${now.toLocaleString('en-GB')}`, 20, 68);
    doc.text('Recorded on: Internet Computer Blockchain', 20, 76);
    doc.setTextColor(120);
    doc.setFontSize(8);
    doc.text('Legal title transfers when HM Land Registry processes the AP1 registration.', 20, 280);
    doc.text('This certificate confirms the transaction was recorded on PropXchain.', 20, 285);
    doc.save(`propxchain-certificate-${transactionId ?? 'transaction'}.pdf`);
  }

  function handleVerify(): void {
    // Route to the on-chain audit page so verifiers see the immutable event trail.
    if (transactionId) {
      window.location.assign(`/transaction/${transactionId}/audit`);
    }
  }

  // Certificate view (full celebration). Key gate: only show once the
  // canister has actually persisted the completion (stage.status flips to
  // 'completed' after the on-chain write). If the user clicks "Complete"
  // but the persist errors, the certificate must NOT appear — otherwise
  // they see "Recorded on Internet Computer Blockchain" when nothing was
  // written. Before this fix, showCertificate flipped immediately on click.
  if (stage.status === 'completed') {
    return (
      <div className="flex flex-col gap-4">
        {/* Certificate */}
        <div className="rounded-xl border-2 border-teal-200 dark:border-teal-800 bg-white dark:bg-[#0F1729] p-6">
          <div className="text-center mb-6">
            <div className="mx-auto w-16 h-16 rounded-full bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center mb-4">
              <Award className="h-8 w-8 text-teal-600 dark:text-teal-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white font-['Fraunces',serif]">
              {journeyRole === 'buyer' ? 'Congratulations!' : 'Sale Complete'}
            </h2>
            <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
              {journeyRole === 'buyer'
                ? 'Your property purchase is complete.'
                : 'Your property sale is complete.'}
            </p>
          </div>

          <div className="border-t border-gray-200 dark:border-slate-700 pt-4 space-y-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400 dark:text-slate-500 font-medium">Transaction</p>
              <p className="text-sm font-mono text-gray-700 dark:text-slate-300">
                {transactionId ? `#PXC-${transactionId.slice(0, 8).toUpperCase()}` : '#PXC-...'}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400 dark:text-slate-500 font-medium">Completed</p>
              <p className="text-sm text-gray-700 dark:text-slate-300">
                {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} at {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
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
              onClick={handleDownloadPdf}
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

        {journeyRole === 'buyer' && (
          <p className="text-xs text-gray-400 dark:text-slate-500 text-center">
            Legal title transfers when HM Land Registry processes the AP1 registration.
            This certificate confirms the transaction was completed on PropXchain.
          </p>
        )}
      </div>
    );
  }

  // Checklist view
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-gray-600 dark:text-slate-300">
        Confirm each item to complete the transaction.
      </p>

      {myItems.map((item) => {
        const isChecked = confirmed.has(item.id);
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => toggleItem(item.id)}
            className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
              isChecked
                ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20'
                : 'border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 hover:border-teal-400'
            }`}
          >
            <div className={`mt-0.5 shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
              isChecked
                ? 'border-emerald-500 bg-emerald-500'
                : 'border-gray-300 dark:border-slate-600'
            }`}>
              {isChecked && <Check className="h-3 w-3 text-white" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={isChecked ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-slate-500'}>
                  {item.icon}
                </span>
                <p className={`text-sm font-medium ${
                  isChecked ? 'text-emerald-700 dark:text-emerald-300' : 'text-gray-700 dark:text-gray-300'
                }`}>
                  {item.label}
                </p>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 ml-7">{item.description}</p>
            </div>
          </button>
        );
      })}

      <button
        type="button"
        onClick={handleComplete}
        disabled={!allConfirmed}
        className="w-full px-4 py-3 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
      >
        {allConfirmed ? 'Confirm Completion' : `${confirmed.size} of ${myItems.length} confirmed`}
      </button>
    </div>
  );
}
