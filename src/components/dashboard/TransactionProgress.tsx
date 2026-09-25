import React from 'react';
import { cn } from '@/lib/utils';
import { Check, Clock } from 'lucide-react';

interface Milestone {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed' | 'skipped';
  completedAt?: string;
  order: number;
}

interface TransactionProgressProps {
  milestones: Milestone[];
  className?: string;
}

const TransactionProgress: React.FC<TransactionProgressProps> = ({ milestones, className }) => {
  // Sort milestones by order
  const sortedMilestones = [...milestones].sort((a, b) => a.order - b.order);
  
  // Find current active step index
  const currentStepIndex = sortedMilestones.findIndex(m => m.status === 'in-progress') !== -1
    ? sortedMilestones.findIndex(m => m.status === 'in-progress')
    : sortedMilestones.filter(m => m.status === 'completed').length;

  return (
    <div className={cn("w-full py-6", className)}>
      <div className="relative">
        {/* Progress Bar Background Line */}
        <div className="absolute top-5 left-0 w-full h-1 bg-gray-700 rounded-full -z-10" />
        
        {/* Active Progress Line */}
        <div 
          className="absolute top-5 left-0 h-1 bg-gray-600 rounded-full transition-all duration-500 ease-in-out -z-10"
          style={{ width: `${(currentStepIndex / (sortedMilestones.length - 1)) * 100}%` }}
        />

        {/* Steps */}
        <div className="flex justify-between items-start w-full">
          {sortedMilestones.map((milestone, index) => {
            const isCompleted = milestone.status === 'completed';
            const isCurrent = milestone.status === 'in-progress';
            const isPending = milestone.status === 'pending';
            
            return (
              <div key={milestone.id} className="flex flex-col items-center group relative">
                {/* Step Circle */}
                <div 
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center border-4 transition-all duration-300 z-10 bg-gray-800",
                    isCompleted && "border-green-500 bg-green-500 text-white scale-100",
                    isCurrent && "border-gray-500 text-gray-500 scale-125 shadow-[0_0_15px_rgba(59,130,246,0.5)]",
                    isPending && "border-gray-600 text-gray-500"
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-5 h-5 stroke-[3]" />
                  ) : isCurrent ? (
                    <div className="w-3 h-3 bg-gray-600 rounded-full animate-pulse" />
                  ) : (
                    <span className="text-xs font-medium">{index + 1}</span>
                  )}
                </div>

                {/* Label & Description (Always visible) */}
                <div className="absolute top-14 w-32 text-center">
                  <p className={cn(
                    "text-[10px] font-bold mb-1 transition-colors duration-300",
                    isCompleted ? "text-green-400" : isCurrent ? "text-gray-500" : "text-gray-500"
                  )}>
                    {milestone.name}
                  </p>
                  {/* Description only on hover/active to save space */}
                  <div className={cn(
                    "transition-all duration-300",
                    isCurrent ? "opacity-100 h-auto" : "opacity-0 h-0 group-hover:opacity-100 group-hover:h-auto overflow-hidden"
                  )}>
                    <p className="text-[9px] text-gray-500 leading-tight hidden md:block">
                      {milestone.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Mobile Current Step Display (Only visible on small screens) */}
      <div className="mt-16 md:hidden bg-gray-800 rounded-lg p-4 border border-gray-700 flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-gray-600/20 flex items-center justify-center text-gray-500">
          <Clock className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wider">Current Stage</p>
          <p className="font-bold text-white">{sortedMilestones[currentStepIndex]?.name || 'Completed'}</p>
          <p className="text-xs text-gray-400">{sortedMilestones[currentStepIndex]?.description}</p>
        </div>
      </div>
    </div>
  );
};

export default TransactionProgress;
