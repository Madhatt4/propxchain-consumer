// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import type { ReactElement } from 'react';
import { Check, Lock, Eye, HelpCircle, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StageConfig, StageStatus } from '../../../types/stage.types';

/** Pseudo-tab id for the seller view's "Stage 4 · Buyer side" slot. The real
 *  seller-4 stage is hidden from the seller journey (mortgage/funding is
 *  buyer-controlled) — this tab keeps the stage count reading 1..7 and, when
 *  selected, the page renders a "handled on the buyer's side" note. */
export const BUYER_SIDE_TAB_ID = 'buyer-side-4';

/** Pseudo-tab id for "Stage 0 · Sales pack" — the upfront-information
 *  artefact sits before List Property rather than in the section drawer
 *  (decision amendment on Madhatt4/Propxchain#115, 2026-08-14). Selecting it
 *  renders the pack's readiness card in the main column. */
export const SALES_PACK_TAB_ID = 'sales-pack-0';

type TabStatus = StageStatus | 'buyer-side' | 'sales-pack';

interface StageTabItem {
  id: string;
  order: number;
  title: string;
  status: TabStatus;
  /** Badge text for the sales-pack pseudo tab ("6 of 9" / "Complete"). */
  badgeText?: string;
}

interface StageTabsProps {
  stages: StageConfig[];
  /** Seller view: insert a selectable "Buyer side" tab at this stage number. */
  buyerSideOrder?: number;
  /** When set, prepend the "Stage 0 · Sales pack" tab with this badge text. */
  salesPackSummary?: string | null;
  activeStageId: string | null;
  onSelect: (stageId: string) => void;
  onHelpClick?: (stageId: string) => void;
}

function buildItems(
  stages: StageConfig[],
  buyerSideOrder?: number,
  salesPackSummary?: string | null,
): StageTabItem[] {
  const items: StageTabItem[] = stages.map((s) => ({
    id: s.id,
    order: s.order,
    title: s.title,
    status: s.status,
  }));
  if (buyerSideOrder !== undefined) {
    const pseudo: StageTabItem = {
      id: BUYER_SIDE_TAB_ID,
      order: buyerSideOrder,
      title: 'Mortgage & Funding',
      status: 'buyer-side',
    };
    const at = items.findIndex((i) => i.order > buyerSideOrder);
    if (at === -1) items.push(pseudo);
    else items.splice(at, 0, pseudo);
  }
  if (salesPackSummary != null) {
    items.unshift({
      id: SALES_PACK_TAB_ID,
      order: 0,
      title: 'Sales pack',
      status: 'sales-pack',
      badgeText: salesPackSummary,
    });
  }
  return items;
}

function TabChip({ item }: { item: StageTabItem }): ReactElement {
  const base =
    'flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] text-[11px] font-extrabold';
  switch (item.status) {
    case 'completed':
      return (
        <span className={`${base} bg-green-500/12 text-green-600 dark:text-green-400`}>
          <Check className="h-3.5 w-3.5" />
        </span>
      );
    case 'active':
      return (
        <span className={`${base} bg-gradient-to-br from-teal-600 to-teal-500 text-white shadow-[0_0_16px_rgba(20,184,166,0.3)]`}>
          {item.order}
        </span>
      );
    case 'locked':
      return (
        <span className={`${base} bg-gray-200 text-gray-400 dark:bg-slate-700/20 dark:text-slate-600`}>
          <Lock className="h-3 w-3" />
        </span>
      );
    case 'watching':
      return (
        <span className={`${base} bg-gray-200 text-gray-500 dark:bg-slate-700/20 dark:text-slate-500`}>
          <Eye className="h-3.5 w-3.5" />
        </span>
      );
    case 'buyer-side':
      return (
        <span className={`${base} bg-[#DAE5DC] text-[#5F8A68] dark:bg-[#5F8A68]/25 dark:text-[#84A98C]`}>
          {item.order}
        </span>
      );
    case 'sales-pack':
      return (
        <span className={`${base} bg-teal-500/12 text-teal-600 dark:text-teal-400`}>
          <Package className="h-3.5 w-3.5" />
        </span>
      );
  }
}

function TabBadge({ status, text }: { status: TabStatus; text?: string }): ReactElement {
  const base =
    'inline-flex items-center gap-1 self-start rounded-2xl border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide';
  switch (status) {
    case 'active':
      return (
        <span className={`${base} border-amber-500/20 bg-amber-500/12 text-amber-600 dark:text-amber-400 animate-[badge-pulse_2s_ease-in-out_infinite]`}>
          Action Needed
        </span>
      );
    case 'completed':
      return (
        <span className={`${base} border-green-500/20 bg-green-500/12 text-green-600 dark:text-green-400`}>
          <Check className="h-2.5 w-2.5" />
          Completed
        </span>
      );
    case 'buyer-side':
      return (
        <span className={`${base} border-[#84A98C]/40 bg-[#DAE5DC] text-[#5F8A68] dark:border-[#5F8A68]/40 dark:bg-[#5F8A68]/25 dark:text-[#84A98C]`}>
          Buyer side
        </span>
      );
    case 'sales-pack':
      return (
        <span className={`${base} border-teal-500/20 bg-teal-500/12 text-teal-700 dark:text-teal-300`}>
          {text ?? 'Sales pack'}
        </span>
      );
    case 'locked':
      return (
        <span className={`${base} border-gray-200 bg-gray-100 text-gray-400 dark:border-slate-700/40 dark:bg-slate-800/60 dark:text-slate-500`}>
          Locked
        </span>
      );
    case 'watching':
      return (
        <span className={`${base} border-gray-200 bg-gray-100 text-gray-500 dark:border-slate-700/40 dark:bg-slate-800/60 dark:text-slate-400`}>
          Waiting
        </span>
      );
  }
}

/** Horizontal, scrollable row of stage tabs across the top of the flow page's
 *  main content area. Selecting a non-locked tab renders that stage's detail
 *  card below; locked tabs are disabled at 50% opacity. */
export function StageTabs({
  stages,
  buyerSideOrder,
  salesPackSummary,
  activeStageId,
  onSelect,
  onHelpClick,
}: StageTabsProps): ReactElement {
  const items = buildItems(stages, buyerSideOrder, salesPackSummary);

  return (
    <div className="mb-5 rounded-2xl border border-gray-200 bg-white p-2 shadow-sm dark:border-slate-700/40 dark:bg-white/[0.03]">
      <div
        role="tablist"
        aria-label="Transaction stages"
        className="flex gap-1.5 overflow-x-auto [scrollbar-width:thin]"
      >
        {items.map((item) => {
          const isActiveTab = item.id === activeStageId;
          const isLocked = item.status === 'locked';
          return (
            <button
              key={item.id}
              role="tab"
              type="button"
              aria-selected={isActiveTab}
              disabled={isLocked}
              onClick={() => onSelect(item.id)}
              className={cn(
                'flex min-w-[148px] flex-1 flex-col gap-2 rounded-xl border px-3.5 py-3 text-left transition-all duration-150',
                isActiveTab
                  ? 'glass border-teal-500/40 shadow-[0_4px_20px_rgba(20,184,166,0.12)]'
                  : 'border-transparent',
                isLocked
                  ? 'cursor-not-allowed opacity-50'
                  : !isActiveTab && 'hover:bg-teal-500/5',
              )}
            >
              <span className="flex items-center gap-2">
                <TabChip item={item} />
                <span className="text-[9px] font-semibold uppercase tracking-[1.5px] text-gray-400 dark:text-slate-500">
                  Stage {item.order}
                </span>
                {onHelpClick && !isLocked && item.status !== 'buyer-side' && item.status !== 'sales-pack' && (
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label={`Help for ${item.title}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onHelpClick(item.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        onHelpClick(item.id);
                      }
                    }}
                    className="ml-auto rounded-full p-0.5 text-gray-400 transition-colors hover:bg-teal-50 hover:text-teal-600 dark:text-slate-500 dark:hover:bg-teal-900/20 dark:hover:text-teal-400"
                    title={`About ${item.title}`}
                  >
                    <HelpCircle className="h-3.5 w-3.5" />
                  </span>
                )}
              </span>
              <span
                className={cn(
                  'text-[12.5px] font-bold leading-tight',
                  item.status === 'locked'
                    ? 'text-gray-400 dark:text-slate-600'
                    : item.status === 'completed' || item.status === 'buyer-side'
                      ? 'text-gray-600 dark:text-slate-300'
                      : 'text-gray-900 dark:text-slate-100',
                )}
              >
                {item.title}
              </span>
              <TabBadge status={item.status} text={item.badgeText} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
