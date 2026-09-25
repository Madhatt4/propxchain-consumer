// Blocking notice shown before an editable TA6 form: PropXchain paraphrases the
// questions, but the official Law Society wording is what legally governs the
// seller's answers. Confirming records the acknowledgment on-chain (via the
// shell's onAcknowledge prop) so the form unblocks.

import { useState } from 'react';
import type { ReactElement } from 'react';
import { ShieldAlert } from 'lucide-react';

import { TA6_OFFICIAL_FORM_URL } from '../../../lib/ta6-prompts/types';

export interface AcknowledgmentGateProps {
  onAcknowledge: () => Promise<void>;
}

export function AcknowledgmentGate({ onAcknowledge }: AcknowledgmentGateProps): ReactElement {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await onAcknowledge();
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      // The canister rejects acknowledgments from anyone who isn't the seller
      // side. Surface that as guidance, not a raw canister error — a buyer
      // reaching this gate via the journey toggle can never get past it.
      const friendly = /only the seller/i.test(raw)
        ? "You're signed in as a different party on this transaction. Only the seller (or their solicitor) can complete the TA6 — you'll be able to view their answers once they've saved them."
        : raw || 'Could not record your acknowledgment';
      setError(friendly);
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-start gap-3">
        <ShieldAlert className="h-6 w-6 flex-shrink-0 text-amber-600" aria-hidden="true" />
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">Before you start</h2>
          <p className="text-sm text-gray-700">
            PropXchain shows plain-English summaries to help you answer each question.
            The official Law Society TA6 wording is what legally governs your answers —
            read it if anything is unclear.
          </p>
          <a
            href={TA6_OFFICIAL_FORM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-sm font-medium text-blue-600 hover:underline"
          >
            View the official Law Society TA6 form
          </a>
          <div>
            <button
              type="button"
              onClick={() => void handleClick()}
              disabled={busy}
              className="px-5 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'I understand'}
            </button>
          </div>
          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default AcknowledgmentGate;
