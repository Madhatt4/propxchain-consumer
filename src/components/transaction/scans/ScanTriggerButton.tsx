// PropXchain - Open Source Blockchain Property Conveyancing Platform
// Copyright (C) 2026 PropXchain Contributors
// SPDX-License-Identifier: Proprietary

/**
 * Trigger for a scan. Two modes:
 *  - action mode (`onRun`): a plain button, e.g. the HMLR read.
 *  - file mode (`onFile`): opens a PDF picker and hands the chosen File back,
 *    e.g. the manually-uploaded search / survey PDF.
 */
import { useRef } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ScanTriggerButtonProps {
  label: string;
  isRunning: boolean;
  disabled?: boolean;
  onRun?: () => void;
  onFile?: (file: File) => void;
}

export function ScanTriggerButton({
  label,
  isRunning,
  disabled,
  onRun,
  onFile,
}: ScanTriggerButtonProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = (): void => {
    if (onFile) {
      inputRef.current?.click();
      return;
    }
    onRun?.();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (file && onFile) onFile(file);
  };

  return (
    <>
      <Button size="sm" onClick={handleClick} disabled={disabled || isRunning}>
        {isRunning ? (
          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="mr-1.5 h-4 w-4" />
        )}
        {isRunning ? 'Scanning…' : label}
      </Button>
      {onFile && (
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={handleChange}
        />
      )}
    </>
  );
}
