import { Check, Clock, Users } from 'lucide-react';
import type { StageConfig } from '../../../types/stage.types';
import { StallLine } from './StallLine';

interface OtherPartyProgressCardProps {
  stages: StageConfig[];
  otherPartyRole: 'buyer' | 'seller';
  isLoading?: boolean;
  /**
   * With a transaction id the card also says what the other side is waiting
   * on and for how long (stall attribution, surface 2): their side's stalls
   * only, by role, so a seller reads "waiting on the buyer's conveyancer"
   * and never a name.
   */
  transactionId?: string;
}

export function OtherPartyProgressCard({
  stages,
  otherPartyRole,
  isLoading = false,
  transactionId,
}: OtherPartyProgressCardProps): JSX.Element {
  const roleLabel = otherPartyRole === 'buyer' ? 'Buyer' : 'Seller';
  const completedCount = stages.filter((s) => s.status === 'completed').length;
  const hasOtherParty = stages.length > 0;

  if (isLoading) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-[#0F1729] p-4">
        <div className="h-5 w-32 bg-gray-200 dark:bg-slate-700 rounded animate-pulse mb-3" />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-7 bg-gray-100 dark:bg-slate-800 rounded-full animate-pulse mb-2" />
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-[#0F1729] p-4">
      <h3 className="text-sm font-medium text-gray-900 dark:text-slate-100 mb-3 font-['DM_Sans']">
        {roleLabel} Progress
      </h3>

      {!hasOtherParty ? (
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 py-2">
          <Clock size={16} className="text-teal-500 dark:text-teal-400 shrink-0" />
          <span>Waiting for {otherPartyRole} to join</span>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 mb-3">
            {stages.map((stage) => {
              const isComplete = stage.status === 'completed';
              return (
                <span
                  key={stage.id}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                    isComplete
                      ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                      : 'bg-[#DAE5DC] dark:bg-[#1A2A1E] text-gray-600 dark:text-slate-400'
                  }`}
                >
                  {isComplete ? <Check size={12} /> : <Clock size={12} />}
                  {stage.title}
                </span>
              );
            })}
          </div>

          {transactionId && (
            <StallLine transactionId={transactionId} side={otherPartyRole} variant="compact" className="mb-3" />
          )}

          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400 pt-1 border-t border-gray-100 dark:border-slate-800">
            <Users size={14} className="text-teal-500 dark:text-teal-400" />
            <span>{completedCount} of {stages.length} stages complete</span>
          </div>
        </>
      )}
    </div>
  );
}
