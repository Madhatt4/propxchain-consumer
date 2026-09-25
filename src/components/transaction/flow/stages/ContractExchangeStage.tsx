import { useState, type ReactNode } from 'react';
import { PenTool, Upload, FileText, Check, Clock, ExternalLink, Calendar, X } from 'lucide-react';
import type { StageConfig, JourneyRole } from '../../../../types/stage.types';

interface StageProps {
  stage: StageConfig;
  onComplete?: (stageId: string) => void;
  journeyRole?: JourneyRole;
  transactionId?: string;
}

type SigningStatus = 'upload-contract' | 'review' | 'set-date' | 'sign' | 'waiting' | 'exchanged';

export function ContractExchangeStage({ stage, journeyRole = 'seller' }: StageProps): ReactNode {
  const [contractFile, setContractFile] = useState<File | null>(null);
  const [completionDate, setCompletionDate] = useState<string>('');
  const [hasSigned, setHasSigned] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  // The counterparty's signature is authoritative only from the canister.
  // Pre-completion (the only time this view renders — see the early return
  // below) the other side is, from this client's perspective, not yet signed.
  // We never fake it true locally; the real signal arrives via stage.status.
  const otherPartySigned = false;

  const isSeller = journeyRole === 'seller';
  const roleLabel = isSeller ? 'Seller' : 'Buyer';
  const otherRole = isSeller ? 'Buyer' : 'Seller';

  // Determine current step
  function getStatus(): SigningStatus {
    // 'exchanged' is reached ONLY from authoritative canister state. Local
    // signing intent moves the seller to the honest 'waiting' state — never
    // to 'exchanged'.
    if (stage.status === 'completed') return 'exchanged';
    if (hasSigned) return 'waiting';
    if (!contractFile && isSeller) return 'upload-contract';
    if (!completionDate) return 'set-date';
    return 'sign';
  }

  const status = getStatus();

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setFileError(`${file.name} is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 10 MB.`);
      return;
    }
    setFileError(null);
    setContractFile(file);
  }

  function handleSign(): void {
    setHasSigned(true);
    // TODO(phase-5-integration): call icpService.recordPartySignature with
    // signingRole derived from journeyRole so the canister captures this
    // side's signature on chain. When BOTH parties' signatures are recorded,
    // the canister flips stage.status to #completed (per the Feb 2026
    // signature-recording fix in MEMORY.md); that real status is what drives
    // the 'exchanged' branch above, via the flow-state poll.
    //
    // We deliberately do NOT fake the counterparty signing or call onComplete
    // here. Exchange is the highest-stakes moment in the sale: the UI must
    // never claim "Contracts Exchanged · recorded on blockchain" until the
    // canister actually says so. Until tmSign + recordPartySignature are
    // wired, the seller correctly sits in the honest 'waiting' state.
  }

  if (status === 'exchanged') {
    return (
      <div className="flex flex-col gap-3">
        <div className="rounded-lg border-2 border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 p-5 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center mb-3">
            <Check className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-lg font-semibold text-emerald-800 dark:text-emerald-200 font-['Fraunces',serif]">
            Contracts Exchanged
          </p>
          {/* This card renders ONLY when stage.status === 'completed' (the
              authoritative canister state — see getStatus). At that point the
              exchange is genuinely recorded on chain, so the definitive copy
              is accurate. Local signing intent never reaches this branch; it
              shows the honest 'waiting' state instead. */}
          <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-1">
            Both parties have signed. Exchange recorded on the blockchain.
          </p>
          {completionDate && (
            <p className="text-xs text-emerald-500 dark:text-emerald-500 mt-2 font-mono">
              Completion date: {new Date(completionDate).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {fileError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-700 dark:text-red-300"
        >
          {fileError}
        </div>
      )}
      {/* Signing status header */}
      <div className="flex items-center gap-3">
        <PenTool className="h-5 w-5 text-teal-600 dark:text-teal-400" />
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
          Contract Exchange
        </h3>
      </div>

      {/* Dual-party status */}
      <div className="grid grid-cols-2 gap-3">
        <div className={`rounded-lg border p-3 text-center ${
          hasSigned
            ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20'
            : 'border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50'
        }`}>
          <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">{roleLabel} (You)</p>
          {hasSigned ? (
            <div className="flex items-center justify-center gap-1 text-emerald-600 dark:text-emerald-400">
              <Check className="h-4 w-4" />
              <span className="text-sm font-medium">Signed</span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-1 text-gray-400 dark:text-slate-500">
              <Clock className="h-4 w-4" />
              <span className="text-sm">Pending</span>
            </div>
          )}
        </div>
        <div className={`rounded-lg border p-3 text-center ${
          otherPartySigned
            ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20'
            : 'border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50'
        }`}>
          <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">{otherRole}</p>
          {otherPartySigned ? (
            <div className="flex items-center justify-center gap-1 text-emerald-600 dark:text-emerald-400">
              <Check className="h-4 w-4" />
              <span className="text-sm font-medium">Signed</span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-1 text-gray-400 dark:text-slate-500">
              <Clock className="h-4 w-4" />
              <span className="text-sm">Waiting...</span>
            </div>
          )}
        </div>
      </div>

      {/* Step 1: Upload contract (seller only) */}
      {isSeller && !contractFile && (
        <div>
          <p className="text-xs font-medium text-gray-700 dark:text-slate-300 mb-1.5">Upload draft contract</p>
          <label className="flex flex-col items-center gap-1.5 rounded-lg border-2 border-dashed border-gray-300 dark:border-slate-600 p-4 cursor-pointer hover:border-teal-500 transition-colors">
            <Upload className="h-5 w-5 text-gray-400 dark:text-slate-500" />
            <span className="text-sm text-gray-500 dark:text-slate-400">Drop contract PDF here</span>
            <span className="text-xs text-gray-400 dark:text-slate-500">PDF only. Max 10MB</span>
            <input type="file" accept=".pdf" onChange={handleFileChange} className="hidden" />
          </label>
        </div>
      )}

      {/* Contract uploaded indicator */}
      {contractFile && (
        <div className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 px-3 py-2.5">
          <FileText className="h-5 w-5 text-teal-600 dark:text-teal-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{contractFile.name}</p>
            <p className="text-xs text-gray-500">{(contractFile.size / 1024).toFixed(0)} KB</p>
          </div>
          <button type="button" onClick={() => setContractFile(null)} className="p-1 text-gray-400 hover:text-red-500">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Buyer sees contract from seller */}
      {!isSeller && !contractFile && (
        <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 px-4 py-3">
          <p className="text-sm text-gray-600 dark:text-slate-300">Waiting for seller to upload the contract...</p>
        </div>
      )}

      {/* Step 2: Completion date */}
      {(contractFile || !isSeller) && !completionDate && !hasSigned && (
        <div>
          <p className="text-xs font-medium text-gray-700 dark:text-slate-300 mb-1.5 flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" /> Agree completion date
          </p>
          <div className="flex gap-2">
            <input
              type="date"
              value={completionDate}
              onChange={(e) => setCompletionDate(e.target.value)}
              min={new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]}
              className="flex-1 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>
      )}

      {completionDate && !hasSigned && (
        <p className="text-xs text-gray-500 dark:text-slate-400">
          Completion date: {new Date(completionDate).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      )}

      {/* Step 3: Sign */}
      {completionDate && !hasSigned && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-gray-500 dark:text-slate-400">
            In production, signing is handled securely via TMGroup tmSign (Qualified Electronic Signature).
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSign}
              className="flex-1 px-4 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <PenTool className="h-4 w-4" />
              Sign as {roleLabel}
            </button>
            {/* tmSign integration pending — button is disabled until the
                TMGroup QES redirect URL is wired through the backend. Before
                this fix the onClick opened `#` in a new tab, which showed a
                blank copy of the app and looked broken. */}
            <button
              type="button"
              disabled
              title="tmSign integration coming soon"
              className="px-4 py-2.5 rounded-lg border border-gray-300 dark:border-slate-600 text-gray-400 dark:text-slate-500 text-sm font-medium flex items-center gap-2 cursor-not-allowed opacity-60"
            >
              <ExternalLink className="h-4 w-4" />
              tmSign · soon
            </button>
          </div>
        </div>
      )}

      {/* Waiting for other party */}
      {status === 'waiting' && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3">
          <div className="animate-pulse h-2 w-2 rounded-full bg-amber-500 shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-300">
            You've signed. We'll notify you the moment the {otherRole.toLowerCase()} signs.
            There's nothing more for you to do right now.
          </p>
        </div>
      )}
    </div>
  );
}
