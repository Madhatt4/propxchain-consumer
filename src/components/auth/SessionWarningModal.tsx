// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import React from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Clock, LogOut, RefreshCw } from 'lucide-react';

interface SessionWarningModalProps {
  isOpen: boolean;
  timeRemaining: number;
  onExtendSession: () => void;
  onLogout: () => void;
}

/**
 * Formats milliseconds into MM:SS format
 */
const formatTime = (ms: number): string => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

const SessionWarningModal: React.FC<SessionWarningModalProps> = ({
  isOpen,
  timeRemaining,
  onExtendSession,
  onLogout,
}) => {
  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
              <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <AlertDialogTitle className="text-xl">Session Expiring Soon</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-base">
            Your session will expire due to inactivity. You will be automatically logged out for security purposes.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="my-4 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
          <p className="text-center text-sm text-amber-700 dark:text-amber-300 mb-2">
            Time remaining:
          </p>
          <p className="text-center text-4xl font-mono font-bold text-amber-600 dark:text-amber-400">
            {formatTime(timeRemaining)}
          </p>
        </div>

        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={onLogout}
            className="w-full sm:w-auto"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Log Out
          </Button>
          <Button
            onClick={onExtendSession}
            className="w-full sm:w-auto bg-gray-800 hover:bg-gray-700 text-white"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Extend Session
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default SessionWarningModal;
