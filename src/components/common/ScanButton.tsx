// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { useState } from 'react';
import { Camera } from 'lucide-react';
import { isNativeApp } from '../../lib/native';
import { scanDocument } from '../../lib/nativeScan';

interface ScanButtonProps {
  onFile: (file: File) => void;
  disabled?: boolean;
}

/** "Scan with camera" button. Renders only inside the native phone app. */
export default function ScanButton({ onFile, disabled = false }: ScanButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isNativeApp()) return null;

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setError(null);
    setBusy(true);
    try {
      const file = await scanDocument();
      if (file) onFile(file);
    } catch {
      setError(
        'We could not open the camera. Check that PropXchain is allowed to use the camera in your phone settings.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || busy}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-teal-600 px-4 text-sm font-medium text-teal-700 disabled:opacity-50"
      >
        <Camera className="h-4 w-4" aria-hidden="true" />
        {busy ? 'Opening camera…' : 'Scan with camera'}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
