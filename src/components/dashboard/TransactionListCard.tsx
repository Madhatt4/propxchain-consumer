/**
 * PropXchain - Transaction card (dashboard list view)
 *
 * One card per transaction. Everything that used to sit on the card face as a
 * chip — transaction ID, mode, transaction type, and the destructive
 * Delete/Leave action — now lives behind the overflow menu, leaving the face to
 * address, price, progress and a single meta line.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  Clock,
  DoorOpen,
  MoreVertical,
  SquarePen,
  Trash2,
} from 'lucide-react';
import type { PropertyListing } from '@/types/listing.types';
import { isTransactionStatus, type TransactionStatus } from '@/types/transactionStatus';

type StatusTone = 'active' | 'waiting' | 'complete' | 'neutral';

/**
 * Status → tone. Kept as a literal map (never an assembled class name) so
 * Tailwind can see every class at build time.
 */
const TONE_BY_STATUS: Record<TransactionStatus, StatusTone> = {
  active: 'active',
  exchanged: 'active',
  completion_initiated: 'waiting',
  blockchain_completed: 'complete',
  land_registry_registered: 'complete',
};

const getStatusTone = (status: string): StatusTone => (isTransactionStatus(status) ? TONE_BY_STATUS[status] : 'neutral');

const TONE_STYLES: Record<StatusTone, { pill: string; bar: string }> = {
  active: {
    pill: 'bg-teal-500/10 text-teal-700 dark:bg-teal-400/15 dark:text-teal-300',
    bar: 'bg-teal-600 dark:bg-teal-400',
  },
  waiting: {
    pill: 'bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300',
    bar: 'bg-amber-600 dark:bg-amber-400',
  },
  complete: {
    pill: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300',
    bar: 'bg-emerald-600 dark:bg-emerald-400',
  },
  neutral: {
    pill: 'bg-stone-200 text-stone-600 dark:bg-slate-700 dark:text-slate-300',
    bar: 'bg-stone-400 dark:bg-slate-500',
  },
};

const SOURCE_TAG_STYLES: Record<'purplebricks' | 'other', string> = {
  purplebricks: 'bg-[#550099] text-white',
  other: 'bg-[#00DEB6] text-[#2B2B2B]',
};

const ICON_BUTTON =
  'flex h-11 w-11 items-center justify-center rounded-lg border-none bg-transparent text-[var(--text-muted)] transition-colors duration-200 ease-out hover:bg-[var(--bg-section)] hover:text-[var(--text-main)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600';

const MICRO_LABEL = 'font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]';

interface TransactionListCardProps {
  id: string;
  address: string;
  amount: number;
  /** Raw canister status — drives the pill tone and the progress-bar colour. */
  status: string;
  statusLabel: string;
  progress: number;
  role: 'buyer' | 'seller';
  createdDate: string;
  modeLabel: string;
  typeLabel: string;
  listing: PropertyListing | null;
  onOpen: () => void;
  onEdit: () => void;
  /** Delete for the seller (creator), Leave for a buyer who joined by invite. */
  onRemove: () => void;
}

const StatusPill: React.FC<{ tone: StatusTone; label: string }> = ({ tone, label }) => (
  <span
    className={`inline-flex h-[22px] shrink-0 items-center gap-1.5 rounded-full px-2 text-[11px] font-semibold ${TONE_STYLES[tone].pill}`}
  >
    {tone === 'waiting' && <Clock size={11} strokeWidth={2.5} />}
    {tone === 'complete' && <Check size={11} strokeWidth={3} />}
    {(tone === 'active' || tone === 'neutral') && (
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
    )}
    {label}
  </span>
);

export const TransactionListCard: React.FC<TransactionListCardProps> = ({
  id,
  address,
  amount,
  status,
  statusLabel,
  progress,
  role,
  createdDate,
  modeLabel,
  typeLabel,
  listing,
  onOpen,
  onEdit,
  onRemove,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const tone = getStatusTone(status);
  const leadImage = listing?.images?.[0]?.url;
  const photoCount = listing?.images?.length ?? 0;

  useEffect(() => {
    if (!isMenuOpen) return undefined;
    const handlePointerDown = (event: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setIsMenuOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);

  const stop = (event: React.MouseEvent): void => event.stopPropagation();

  return (
    <article
      onClick={onOpen}
      className="flex cursor-pointer flex-col overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
    >
      <div className="flex min-w-0 flex-row sm:flex-col">
        {/* Lead image — a same-height placeholder keeps cards in a row aligned. */}
        <div className="relative w-[104px] shrink-0 self-stretch overflow-hidden bg-[var(--bg-section)] sm:h-[132px] sm:w-full sm:self-auto">
          {leadImage ? (
            <>
              <img src={leadImage} alt={address} className="h-full w-full object-cover" />
              <div
                className={`absolute left-2 top-2 rounded px-2 py-0.5 text-[10px] font-bold tracking-wide ${
                  listing?.source === 'purplebricks'
                    ? SOURCE_TAG_STYLES.purplebricks
                    : SOURCE_TAG_STYLES.other
                }`}
              >
                {listing?.source === 'purplebricks' ? 'purplebricks' : 'rightmove'}
              </div>
              {photoCount > 1 && (
                <div className="absolute bottom-2 right-2 hidden rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white sm:block">
                  {photoCount} photos
                </div>
              )}
            </>
          ) : (
            <div className="flex h-full w-full items-center justify-center p-2 text-center">
              <span className={MICRO_LABEL}>No listing photos</span>
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2.5 p-3.5 sm:gap-3.5 sm:p-4 sm:pb-0">
          <div className="flex items-start justify-between gap-2.5">
            <h3 className="m-0 text-sm font-semibold leading-[1.35] text-[var(--text-main)] sm:text-[15px]">
              {address || 'Property Address'}
            </h3>
            <StatusPill tone={tone} label={statusLabel} />
          </div>

          <div className="flex items-baseline gap-2">
            <span className="font-mono text-[17px] font-medium tabular-nums text-[var(--text-main)] sm:text-xl">
              £{amount.toLocaleString()}
            </span>
            {listing && listing.bedrooms > 0 && (
              <span className="text-xs text-[var(--text-muted)]">
                {listing.bedrooms} bed{listing.bathrooms > 0 ? ` · ${listing.bathrooms} bath` : ''}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between gap-2 font-mono text-[10px] text-[var(--text-muted)] sm:text-[11px]">
              <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
                {statusLabel}
              </span>
              <span className="shrink-0 text-[var(--text-secondary)]">{progress}%</span>
            </div>
            <div className="h-1 overflow-hidden rounded-sm bg-[var(--border-light)]">
              <div
                className={`h-full transition-[width] duration-300 ease-out ${TONE_STYLES[tone].bar}`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* The card's only divider. */}
      <div className="mx-3.5 mb-1 flex items-center justify-between gap-2 border-t border-[var(--border-light)] pt-1 sm:mx-4 sm:mb-2 sm:mt-3.5 sm:pt-3">
        <span className="flex min-w-0 gap-1.5 font-mono text-[10px] text-[var(--text-muted)] sm:text-[11px]">
          <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap capitalize">{role}</span>
          <span className="shrink-0">· {createdDate}</span>
        </span>

        <div className="flex shrink-0 gap-0.5">
          <button
            type="button"
            className={ICON_BUTTON}
            title="Edit property details"
            aria-label="Edit property details"
            onClick={(event) => {
              stop(event);
              onEdit();
            }}
          >
            <SquarePen size={16} strokeWidth={2} />
          </button>

          <div className="relative" ref={menuRef} onClick={stop}>
            <button
              type="button"
              className={ICON_BUTTON}
              title="More actions"
              aria-label="More actions"
              aria-haspopup="menu"
              aria-expanded={isMenuOpen}
              onClick={(event) => {
                stop(event);
                setIsMenuOpen((open) => !open);
              }}
            >
              <MoreVertical size={16} strokeWidth={2} />
            </button>

            {isMenuOpen && (
              <div
                role="menu"
                className="absolute bottom-full right-0 z-30 mb-1 w-56 overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
              >
                <div className="flex flex-col gap-1 px-4 py-3">
                  <span className="font-mono text-[11px] text-[var(--text-muted)]">
                    #{id.slice(0, 12)}…
                  </span>
                  <span className="text-xs text-[var(--text-secondary)]">
                    {modeLabel} · {typeLabel}
                  </span>
                </div>
                <div className="h-px bg-[var(--border-light)]" />
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-red-600 transition-colors duration-150 ease-out hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30"
                  onClick={(event) => {
                    stop(event);
                    setIsMenuOpen(false);
                    onRemove();
                  }}
                >
                  {role === 'seller' ? <Trash2 size={16} strokeWidth={2} /> : <DoorOpen size={16} strokeWidth={2} />}
                  <span>{role === 'seller' ? 'Delete transaction' : 'Leave transaction'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
};

export default TransactionListCard;
