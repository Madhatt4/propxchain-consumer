/**
 * CanistersTableDialogs
 *
 * Extracted from CanistersTable to keep the primary file under 300 lines.
 * Contains the Top-Up and Freezing-Threshold dialogs that were previously
 * in CanisterHealthPanel. Relocated verbatim — only the prop/export shape changed.
 */
import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Copy, Terminal } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

// Clamp and build helpers ────────────────────────────────────────────────────

const TOP_UP_MIN_T = 0.1;
const TOP_UP_MAX_T = 10;
const TOP_UP_CHIPS = [0.5, 1, 2, 5];

function clampTopUpT(value: number): number {
  if (isNaN(value) || value <= 0) return 1;
  if (value < TOP_UP_MIN_T) return TOP_UP_MIN_T;
  if (value > TOP_UP_MAX_T) return TOP_UP_MAX_T;
  return value;
}

function buildTopUpCommand(canisterId: string, topUpAmount: string): string {
  const tCycles = clampTopUpT(parseFloat(topUpAmount));
  const cycles = Math.round(tCycles * 1_000_000_000_000);
  return `dfx canister --network ic deposit-cycles ${cycles} ${canisterId} --identity Propxchain`;
}

export function formatCanisterName(name: string): string {
  return name
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function formatFreezingThreshold(seconds: number): string {
  const days = seconds / 86_400;
  if (days >= 365) return `${(days / 365).toFixed(1)} years`;
  if (days >= 30) return `${Math.round(days / 30)} months`;
  if (days >= 7) return `${Math.round(days / 7)} weeks`;
  return `${Math.round(days)} days`;
}

// ── TopUpDialog ──────────────────────────────────────────────────────────────

export interface TopUpDialogState {
  name: string;
  canisterId: string;
}

interface TopUpDialogProps {
  dialog: TopUpDialogState | null;
  topUpAmount: string;
  onAmountChange: (v: string) => void;
  onClose: () => void;
}

export const TopUpDialog: React.FC<TopUpDialogProps> = ({
  dialog,
  topUpAmount,
  onAmountChange,
  onClose,
}) => {
  const copyTopUpCommand = (): void => {
    if (!dialog) return;
    const cmd = buildTopUpCommand(dialog.canisterId, topUpAmount);
    navigator.clipboard.writeText(cmd);
    toast({ description: 'dfx command copied — paste into your terminal' });
  };

  return (
    <Dialog open={dialog !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Top Up Canister</DialogTitle>
          <DialogDescription>
            {dialog && formatCanisterName(dialog.name)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Amount (in trillions of cycles)</label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={TOP_UP_MIN_T}
                max={TOP_UP_MAX_T}
                step="0.1"
                value={topUpAmount}
                onChange={(e) => onAmountChange(e.target.value)}
                placeholder="e.g. 1.0"
              />
              <span className="text-sm text-muted-foreground shrink-0">T cycles</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {TOP_UP_CHIPS.map((t) => (
                <Button
                  key={t}
                  type="button"
                  variant={parseFloat(topUpAmount) === t ? 'default' : 'outline'}
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => onAmountChange(String(t))}
                >
                  {t}T
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Browsers can&apos;t attach cycles to a call. Run this from a terminal where dfx is configured with a controller identity.
            </p>
          </div>
          {dialog && (
            <div className="rounded-md bg-muted/50 border border-border p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Terminal className="h-3.5 w-3.5" />
                <span>Copy and run:</span>
              </div>
              <code className="block text-xs font-mono break-all whitespace-pre-wrap leading-relaxed">
                {buildTopUpCommand(dialog.canisterId, topUpAmount)}
              </code>
            </div>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
          <Button variant="default" className="gap-1" onClick={copyTopUpCommand}>
            <Copy className="h-3.5 w-3.5" />
            Copy command
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ── FreezingThresholdDialog ──────────────────────────────────────────────────

export interface FreezingThresholdDialogState {
  name: string;
  canisterId: string;
  currentSeconds: number;
}

interface FreezingThresholdDialogProps {
  dialog: FreezingThresholdDialogState | null;
  thresholdInput: string;
  isActing: boolean;
  onInputChange: (v: string) => void;
  onConfirm: (canisterId: string) => Promise<void>;
  onClose: () => void;
}

export const FreezingThresholdDialog: React.FC<FreezingThresholdDialogProps> = ({
  dialog,
  thresholdInput,
  isActing,
  onInputChange,
  onConfirm,
  onClose,
}) => (
  <Dialog open={dialog !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Edit Freezing Threshold</DialogTitle>
        <DialogDescription>
          {dialog && formatCanisterName(dialog.name)}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-2">
        <div className="space-y-2">
          <label className="text-sm font-medium">Threshold (in days)</label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min="1"
              step="1"
              value={thresholdInput}
              onChange={(e) => onInputChange(e.target.value)}
              placeholder="e.g. 90"
            />
            <span className="text-sm text-muted-foreground shrink-0">days</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Canister will freeze when it has fewer cycles than this many days of idle burn rate.
          </p>
        </div>
        {dialog && (
          <div className="rounded-md bg-muted/50 p-3 space-y-1">
            <p className="text-xs text-muted-foreground">
              Current: {formatFreezingThreshold(dialog.currentSeconds)}
            </p>
            <p className="text-xs text-muted-foreground">
              New: {thresholdInput
                ? `${thresholdInput} days (${(parseInt(thresholdInput || '0', 10) * 86_400).toLocaleString()} seconds)`
                : '—'}
            </p>
          </div>
        )}
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline" disabled={isActing}>Cancel</Button>
        </DialogClose>
        <Button
          variant="default"
          disabled={isActing}
          onClick={() => { if (dialog) void onConfirm(dialog.canisterId); }}
        >
          {isActing ? 'Updating...' : 'Confirm'}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
