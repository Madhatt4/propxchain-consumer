import type { ReactNode } from 'react';
import { Check, Lock, Eye, ChevronDown, HelpCircle, Pencil } from 'lucide-react';
import type { StageConfig, StageStatus } from '../../../types/stage.types';

interface StageCardProps {
  stage: StageConfig;
  isExpanded: boolean;
  onToggle: (stageId: string) => void;
  onHelpClick?: (stageId: string) => void;
  /** Whether this card is currently in edit mode (re-opened after completion). */
  isEditing?: boolean;
  /** Click handler for the Edit button. Only rendered for completed stages
   *  whose content components support editing — pass undefined to hide. */
  onEditClick?: (stageId: string) => void;
  children?: ReactNode;
  costDisplay?: string;
  staggerIndex?: number;
}

interface StatusStyles {
  card: string;
  iconBg: string;
  iconColor: string;
}

function getStatusStyles(status: StageStatus): StatusStyles {
  // Side-stripe accents (`border-l-4`) are on the impeccable absolute-ban
  // list. The status icon already carries the signal — we use a full border
  // tint + a soft ring on the active stage to give it weight without the
  // stripe.
  switch (status) {
    case 'completed':
      return {
        card: 'glass border border-emerald-500/20',
        iconBg: 'bg-green-500/12',
        iconColor: 'text-green-600 dark:text-green-400',
      };
    case 'active':
      return {
        card: 'glass border border-teal-500/40 ring-1 ring-teal-500/15 shadow-[0_4px_24px_rgba(20,184,166,0.10)]',
        iconBg: 'bg-teal-600 dark:bg-teal-500',
        iconColor: 'text-white',
      };
    case 'locked':
      return {
        card: 'border border-dashed border-gray-300 dark:border-slate-700/20 bg-gray-50/50 dark:bg-white/[0.02] opacity-50',
        iconBg: 'bg-gray-200 dark:bg-slate-700/10',
        iconColor: 'text-gray-400 dark:text-slate-600',
      };
    case 'watching':
      return {
        card: 'glass',
        iconBg: 'bg-gray-200 dark:bg-slate-700/10',
        iconColor: 'text-gray-500 dark:text-slate-500',
      };
  }
}

function StatusIcon({ stage }: { stage: StageConfig }): ReactNode {
  const styles = getStatusStyles(stage.status);
  const base = `w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 ${styles.iconBg} ${styles.iconColor}`;

  if (stage.status === 'completed') {
    return <div className={base}><Check className="w-4 h-4" data-testid="stage-check-icon" /></div>;
  }
  if (stage.status === 'locked') {
    return <div className={base}><Lock className="w-4 h-4" /></div>;
  }
  if (stage.status === 'watching') {
    return <div className={base}><Eye className="w-4 h-4" /></div>;
  }
  return (
    <div className={base}>
      <span className="text-sm font-extrabold">{stage.order}</span>
    </div>
  );
}

export function StageCard({ stage, isExpanded, onToggle, onHelpClick, isEditing, onEditClick, children, costDisplay, staggerIndex }: StageCardProps): ReactNode {
  const styles = getStatusStyles(stage.status);
  const isLocked = stage.status === 'locked';
  const staggerClass = staggerIndex !== undefined ? `animate-stagger-${staggerIndex + 1}` : '';

  const handleClick = (): void => {
    if (!isLocked) {
      onToggle(stage.id);
    }
  };

  return (
    <div className={`rounded-xl ${styles.card} ${staggerClass} transition-all duration-200 ${!isLocked ? 'hover:bg-gray-100/80 dark:hover:bg-white/[0.065] hover:-translate-y-0.5' : ''}`}>
      <button
        type="button"
        className="w-full text-left p-4 flex items-center gap-3"
        onClick={handleClick}
        aria-expanded={isExpanded}
      >
        <StatusIcon stage={stage} />

        <div className="flex-1 min-w-0">
          <p className="text-[9px] font-semibold uppercase tracking-[1.5px] text-gray-400 dark:text-slate-500">
            Stage {stage.order}
          </p>
          <div className="flex items-center gap-1.5">
            <p className={`font-bold text-sm ${stage.status === 'locked' ? 'text-gray-400 dark:text-slate-600' : stage.status === 'completed' ? 'text-gray-600 dark:text-slate-300' : 'text-gray-900 dark:text-slate-100'}`}>
              {stage.title}
            </p>
            {onHelpClick && !isLocked && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onHelpClick(stage.id); }}
                className="p-0.5 rounded-full text-gray-400 dark:text-slate-500 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors"
                aria-label={`Help for ${stage.title}`}
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {costDisplay && (
            <p className="text-[10px] text-slate-500 mt-0.5">{costDisplay}</p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {stage.status === 'active' && (
            <span className="px-2.5 py-1 rounded-2xl text-[9px] font-bold bg-amber-500/12 text-amber-400 border border-amber-500/20 uppercase tracking-wide animate-[badge-pulse_2s_ease-in-out_infinite]">
              Action Needed
            </span>
          )}
          {isEditing && (
            <span className="px-2.5 py-1 rounded-2xl text-[9px] font-bold bg-teal-500/12 text-teal-600 dark:text-teal-300 border border-teal-500/20 uppercase tracking-wide">
              Editing
            </span>
          )}
          {stage.status === 'completed' && !isEditing && onEditClick && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onEditClick(stage.id); }}
              className="p-1.5 rounded-md text-gray-400 dark:text-slate-500 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors"
              aria-label={`Edit ${stage.title}`}
              title="Edit this stage"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
          {isLocked && (
            <span className="text-[10px] text-gray-400 dark:text-slate-700">Locked</span>
          )}
          {stage.status === 'watching' && (
            <span className="text-[10px] text-gray-400 dark:text-slate-500">Waiting...</span>
          )}
          {!isLocked && (
            <ChevronDown
              className={`w-4 h-4 text-gray-400 dark:text-slate-600 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
            />
          )}
        </div>
      </button>

      {isExpanded && children && (
        <div className="px-4 pb-4 border-t border-gray-200 dark:border-slate-700/10 pt-3">
          {children}
        </div>
      )}
    </div>
  );
}
