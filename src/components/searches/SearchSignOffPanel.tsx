// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import React, { useState } from 'react';
import { SearchesProgress } from '../../types/searches';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { logger } from '@/utils/logger';
import ActionError, { actionErrorMessage } from '@/components/common/ActionError';

interface SearchSignOffPanelProps {
  progress: SearchesProgress;
  canSignOff: boolean; // Only solicitors/conveyancers can sign off
  onSignOff: (notes?: string) => Promise<void>;
  onRevoke: (reason: string) => Promise<void>;
  isProcessing?: boolean;
}

const SearchSignOffPanel: React.FC<SearchSignOffPanelProps> = ({
  progress,
  canSignOff,
  onSignOff,
  onRevoke,
  isProcessing = false,
}) => {
  const [showSignOffDialog, setShowSignOffDialog] = useState(false);
  const [showRevokeDialog, setShowRevokeDialog] = useState(false);
  const [signOffNotes, setSignOffNotes] = useState('');
  const [revokeReason, setRevokeReason] = useState('');
  const [confirmChecked, setConfirmChecked] = useState(false);
  // Sign-off is a legal act recorded in the audit trail. On failure the dialog
  // simply stayed open with no explanation, which reads as an unresponsive
  // button on the one control where the user most needs to know it did not
  // happen.
  const [signOffError, setSignOffError] = useState<string | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  const { isSignedOff, signOff, uploadedCount } = progress;

  const handleSignOff = async () => {
    setSignOffError(null);
    try {
      await onSignOff(signOffNotes || undefined);
      setShowSignOffDialog(false);
      setSignOffNotes('');
      setConfirmChecked(false);
    } catch (error) {
      logger.error('Sign-off failed:', error);
      // Deliberately leaves the dialog open with the notes intact — closing it
      // would discard what they typed and imply the sign-off went through.
      setSignOffError(
        actionErrorMessage(
          error,
          'Couldn’t record the sign-off. Nothing has been signed off — please try again.',
        ),
      );
    }
  };

  const handleRevoke = async () => {
    if (!revokeReason.trim()) {
      return;
    }
    setRevokeError(null);
    try {
      await onRevoke(revokeReason);
      setShowRevokeDialog(false);
      setRevokeReason('');
    } catch (error) {
      logger.error('Revocation failed:', error);
      setRevokeError(
        actionErrorMessage(
          error,
          'Couldn’t revoke the sign-off. It is still signed off — please try again.',
        ),
      );
    }
  };

  // If signed off - show sign-off details
  if (isSignedOff && signOff) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Searches Sign-Off
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Sign-off info */}
            <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700/50 rounded-lg">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                    Signed off by: {signOff.signedOffByName || 'Unknown'} ({signOff.signedOffByRole})
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    Date: {new Date(signOff.signedOffAt).toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Searches at sign-off: {signOff.searchCount}
                  </p>
                  {signOff.notes && (
                    <p className="text-xs text-gray-700 dark:text-gray-300 mt-2 italic">
                      "{signOff.notes}"
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Revoke button (only for authorized users) */}
            {canSignOff && (
              <Button
                variant="outline"
                size="sm"
                className="w-full border-amber-600 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                onClick={() => setShowRevokeDialog(true)}
                disabled={isProcessing}
              >
                Revoke Sign-Off
              </Button>
            )}
          </div>

          {/* Revoke Dialog */}
          <Dialog open={showRevokeDialog} onOpenChange={setShowRevokeDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Revoke Sign-Off</DialogTitle>
                <DialogDescription>
                  Please provide a reason for revoking the sign-off. This action will be recorded in the audit trail.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <textarea
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  placeholder="Reason for revocation (required)"
                  rows={3}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                />
              </div>
              <ActionError message={revokeError} />
              <DialogFooter className="gap-2">
                <Button
                  variant="secondary"
                  onClick={() => setShowRevokeDialog(false)}
                  disabled={isProcessing}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleRevoke}
                  disabled={isProcessing || !revokeReason.trim()}
                >
                  {isProcessing ? 'Revoking...' : 'Revoke Sign-Off'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    );
  }

  // Not signed off - show sign-off form (if authorized) or waiting message
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Searches Sign-Off
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Status */}
          <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-lg">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-medium">Awaiting sign-off from solicitor/conveyancer</span>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
              Currently uploaded: {uploadedCount} search{uploadedCount !== 1 ? 'es' : ''}
            </p>
          </div>

          {/* Sign-off form (only for authorized users) */}
          {canSignOff ? (
            <>
              <div className="space-y-3">
                {/* Confirmation checkbox */}
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmChecked}
                    onChange={(e) => setConfirmChecked(e.target.checked)}
                    className="mt-1 w-4 h-4 rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 focus:ring-gray-500 dark:focus:ring-offset-gray-800"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    I confirm all necessary searches for this transaction have been completed and reviewed.
                  </span>
                </label>

                {/* Notes textarea */}
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                    Notes (optional)
                  </label>
                  <textarea
                    value={signOffNotes}
                    onChange={(e) => setSignOffNotes(e.target.value)}
                    placeholder="Any caveats or explanations..."
                    rows={2}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500 resize-none text-sm"
                  />
                </div>

                {/* Sign-off button */}
                <Button
                  className="w-full bg-green-600 hover:bg-green-700"
                  onClick={() => setShowSignOffDialog(true)}
                  disabled={!confirmChecked || isProcessing || uploadedCount === 0}
                >
                  Sign Off Searches
                </Button>
              </div>

              {/* Confirmation Dialog */}
              <Dialog open={showSignOffDialog} onOpenChange={setShowSignOffDialog}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Confirm Sign-Off</DialogTitle>
                    <DialogDescription>
                      You are about to sign off on {uploadedCount} search{uploadedCount !== 1 ? 'es' : ''} for this transaction.
                      This confirms that all necessary searches have been completed.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4">
                    <div className="p-3 bg-gray-100 dark:bg-gray-700/50 rounded-md">
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        This action will be recorded on-chain with your identity and timestamp.
                      </p>
                    </div>
                    {signOffNotes && (
                      <div className="mt-3">
                        <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Your notes:</p>
                        <p className="text-sm text-gray-700 dark:text-gray-300 italic">"{signOffNotes}"</p>
                      </div>
                    )}
                  </div>
                  <ActionError message={signOffError} />
                  <DialogFooter className="gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => setShowSignOffDialog(false)}
                      disabled={isProcessing}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="bg-green-600 hover:bg-green-700"
                      onClick={handleSignOff}
                      disabled={isProcessing}
                    >
                      {isProcessing ? 'Processing...' : 'Confirm Sign-Off'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          ) : (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Only solicitors and conveyancers can sign off on property searches.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default SearchSignOffPanel;
