// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { useState } from 'react';
import { isNativeApp } from '../../lib/native';
import {
  driveErrorMessage,
  pickFromDrive,
  preloadDrivePicker,
  readDriveConfig,
} from '../../lib/googleDrivePicker';

interface GoogleDriveButtonProps {
  onFiles: (files: File[]) => void;
  multiple?: boolean;
  disabled?: boolean;
  className?: string;
}

function googleSignInWorksHere(): boolean {
  return !isNativeApp();
}

export default function GoogleDriveButton({
  onFiles,
  multiple = false,
  disabled = false,
  className = 'mt-3',
}: GoogleDriveButtonProps): JSX.Element | null {
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const config = readDriveConfig();

  if (!config || !googleSignInWorksHere()) return null;

  const handleClick = async (e: React.MouseEvent): Promise<void> => {
    e.preventDefault();
    e.stopPropagation();
    setError(null);
    setIsBusy(true);
    try {
      const files = await pickFromDrive(config, { multiple });
      if (files.length > 0) onFiles(files);
    } catch (err) {
      setError(driveErrorMessage(err));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleClick}
        onPointerEnter={() => preloadDrivePicker()}
        onFocus={() => preloadDrivePicker()}
        disabled={disabled || isBusy}
        className="inline-flex min-h-11 items-center justify-center rounded-lg border border-teal-600 px-4 text-sm font-medium text-teal-700 disabled:opacity-50"
      >
        {isBusy ? 'Getting files from Google Drive…' : 'Choose from Google Drive'}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
