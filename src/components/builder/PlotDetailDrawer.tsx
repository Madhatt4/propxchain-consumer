// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Slide-out drawer showing plot details and actions.
 * Opens when a kanban card is clicked.
 */

import { useState, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  X,
  AlertTriangle,
  Mail,
  Pencil,
  ShieldAlert,
  Unlock,
} from 'lucide-react';

import { plotsService, type Plot } from '@/services/plots.service';
import NextStepCard from '@/components/common/NextStepCard';

interface PlotDetailDrawerProps {
  isOpen: boolean;
  plot: Plot | null;
  plotTypeName: string | null;
  siteId: string;
  onClose: () => void;
  onPlotUpdated: () => void;
}

/** Format pence as GBP string. */
function formatPrice(pence: number | null): string {
  if (pence === null) return 'Price TBC';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(pence / 100);
}

/** Format ISO date string to readable UK format. */
function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function PlotDetailDrawer({
  isOpen,
  plot,
  plotTypeName,
  siteId,
  onClose,
  onPlotUpdated,
}: PlotDetailDrawerProps): JSX.Element {
  const [isToggling, setIsToggling] = useState(false);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose();
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleToggleAtRisk = useCallback(async (): Promise<void> => {
    if (!plot) return;
    setIsToggling(true);
    try {
      const newFlag = !plot.at_risk_flag;
      let reason: string | null = null;

      if (newFlag) {
        const input = window.prompt('Reason for marking at risk:');
        if (input === null) {
          setIsToggling(false);
          return;
        }
        reason = input.trim() || null;
      }

      await plotsService.update(plot.id, {
        at_risk_flag: newFlag,
        at_risk_reason: newFlag ? reason : null,
      });
      onPlotUpdated();
    } catch {
      // Silently fail — user sees no change
    } finally {
      setIsToggling(false);
    }
  }, [plot, onPlotUpdated]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={[
          'fixed inset-0 z-40 bg-black/30 transition-opacity duration-300',
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        ].join(' ')}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <aside
        className={[
          'fixed inset-y-0 right-0 z-50 w-full sm:w-[480px]',
          'bg-[var(--bg-card)] dark:bg-[#0F1729] border-l border-[var(--border-color)]',
          'transform transition-transform duration-300 ease-in-out',
          'flex flex-col overflow-y-auto shadow-xl',
          isOpen ? 'translate-x-0' : 'translate-x-full',
        ].join(' ')}
        role="dialog"
        aria-modal="true"
        aria-label="Plot details"
      >
        {plot && <DrawerContent
          plot={plot}
          plotTypeName={plotTypeName}
          siteId={siteId}
          isToggling={isToggling}
          onClose={onClose}
          onToggleAtRisk={handleToggleAtRisk}
        />}
      </aside>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Inner content — extracted to stay under line limits                */
/* ------------------------------------------------------------------ */

interface DrawerContentProps {
  plot: Plot;
  plotTypeName: string | null;
  siteId: string;
  isToggling: boolean;
  onClose: () => void;
  onToggleAtRisk: () => void;
}

function DrawerContent({
  plot,
  plotTypeName,
  siteId,
  isToggling,
  onClose,
  onToggleAtRisk,
}: DrawerContentProps): JSX.Element {
  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header row */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-[Fraunces] text-2xl font-semibold text-[var(--text-main)]">
            Plot {plot.plot_number}
          </h2>
          <p className="mt-1 font-[DM_Sans] text-sm text-[var(--text-secondary)]">
            {plotTypeName ?? 'Untyped'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-2 text-[var(--text-muted)] hover:bg-[var(--bg-section)] hover:text-[var(--text-main)]"
          aria-label="Close drawer"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Price */}
      <div>
        <span className="font-[DM_Sans] text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
          Sale price
        </span>
        <p className="mt-0.5 font-[Geist_Mono] text-xl tabular-nums text-[var(--text-main)]">
          {formatPrice(plot.sale_price_pence)}
        </p>
      </div>

      {/* F.4 — Next-step recommendation for the plot's transaction. Renders
          only when a tx exists; pre-tx plots have nothing to recommend. */}
      {plot.transaction_id && (
        <NextStepCard txId={plot.transaction_id} variant="compact" />
      )}

      {/* Status badges */}
      <div className="flex flex-wrap gap-2">
        <StatusBadge
          label={plot.reservation_status === 'reserved' ? 'Reserved' : 'Available'}
          variant={plot.reservation_status === 'reserved' ? 'sage' : 'neutral'}
        />
        <StatusBadge
          label={plot.listing_status}
          variant={plot.listing_status === 'published' ? 'teal' : 'neutral'}
        />
      </div>

      {/* Reserved date */}
      {plot.reservation_status === 'reserved' && plot.reserved_at && (
        <p className="font-[DM_Sans] text-sm text-[var(--text-secondary)]">
          Reserved on {formatDate(plot.reserved_at)}
        </p>
      )}

      {/* At-risk flag */}
      {plot.at_risk_flag && (
        <div className="flex items-start gap-2 rounded-md bg-amber-50 p-3 dark:bg-amber-900/20">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="font-[DM_Sans] text-sm font-medium text-amber-800 dark:text-amber-300">
              At risk
            </p>
            {plot.at_risk_reason && (
              <p className="mt-0.5 font-[DM_Sans] text-xs text-amber-700 dark:text-amber-400">
                {plot.at_risk_reason}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Divider */}
      <hr className="border-[var(--border-color)]" />

      {/* Action buttons */}
      <div className="flex flex-col gap-2">
        <ActionButton
          icon={<Mail className="h-4 w-4" />}
          label="Ping buyer"
          disabled
          title="Coming in Phase 2"
        />
        <ActionButton
          icon={<Mail className="h-4 w-4" />}
          label="Ping conveyancer"
          disabled
          title="Coming in Phase 2"
        />
        <ActionButton
          icon={<ShieldAlert className="h-4 w-4" />}
          label={plot.at_risk_flag ? 'Clear at-risk flag' : 'Mark at risk'}
          disabled={isToggling}
          onClick={onToggleAtRisk}
        />
        <Link
          to={`/builder/sites/${siteId}/plots/${plot.id}/edit`}
          className="inline-flex items-center gap-2 rounded-md border border-[var(--border-color)] px-4 py-2 font-[DM_Sans] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-section)]"
        >
          <Pencil className="h-4 w-4" />
          Edit plot
        </Link>
        <ActionButton
          icon={<Unlock className="h-4 w-4" />}
          label="Release reservation"
          disabled
          title="Coming in 1c.6"
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Small helpers                                                      */
/* ------------------------------------------------------------------ */

interface StatusBadgeProps {
  label: string;
  variant: 'teal' | 'sage' | 'neutral';
}

function StatusBadge({ label, variant }: StatusBadgeProps): JSX.Element {
  const colours: Record<string, string> = {
    teal: 'bg-[#CCFBF1] text-[#0D9488] dark:bg-[#042F2E] dark:text-[#14B8A6]',
    sage: 'bg-[#DAE5DC] text-[#5F8A68] dark:bg-[#1a2e1f] dark:text-[#84A98C]',
    neutral: 'bg-[var(--bg-section)] text-[var(--text-secondary)]',
  };

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 font-[DM_Sans] text-xs font-medium capitalize ${colours[variant]}`}
    >
      {label}
    </span>
  );
}

interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
  title?: string;
  onClick?: () => void;
}

function ActionButton({
  icon,
  label,
  disabled = false,
  title,
  onClick,
}: ActionButtonProps): JSX.Element {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={[
        'inline-flex items-center gap-2 rounded-md border px-4 py-2',
        'font-[DM_Sans] text-sm font-medium',
        disabled
          ? 'cursor-not-allowed border-[var(--border-color)] text-[var(--text-muted)]'
          : 'border-[#0D9488] text-[#0D9488] hover:bg-[#CCFBF1] dark:border-[#14B8A6] dark:text-[#14B8A6] dark:hover:bg-[#042F2E]',
      ].join(' ')}
    >
      {icon}
      {label}
    </button>
  );
}
