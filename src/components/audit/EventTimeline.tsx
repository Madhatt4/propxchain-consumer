/**
 * Event Timeline — groups audit events into collapsible milestones
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Clock } from 'lucide-react';
import { useThemeClasses } from '../../hooks/useThemeClasses';
import type { AuditEvent, Milestone } from '../../services/transactionAudit';
import { groupEventsIntoMilestones } from '../../services/transactionAudit';

interface EventTimelineProps {
  events: AuditEvent[];
}

function formatTimestamp(ns: number): string {
  const ms = ns > 1e15 ? ns / 1_000_000 : ns;
  return new Date(ms).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface MilestoneRowProps {
  milestone: Milestone;
  theme: ReturnType<typeof useThemeClasses>;
}

const MilestoneRow: React.FC<MilestoneRowProps> = ({ milestone, theme }) => {
  const [isOpen, setIsOpen] = useState(false);
  const statusColor =
    milestone.status === 'completed'
      ? 'bg-green-600'
      : milestone.status === 'active'
        ? 'bg-teal-500'
        : 'bg-gray-400';

  return (
    <div className="relative pl-6">
      {/* Timeline dot */}
      <div
        className={`absolute left-0 top-3 w-3 h-3 rounded-full ${statusColor}`}
      />
      {/* Connector line */}
      <div className="absolute left-[5px] top-6 bottom-0 w-0.5 bg-gray-200 dark:bg-[#1E293B]" />

      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className="flex items-center gap-2 w-full text-left py-2"
      >
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-teal-500" />
        ) : (
          <ChevronRight className="w-4 h-4 text-teal-500" />
        )}
        <span className={`font-fraunces font-semibold ${theme.textPrimary}`}>
          {milestone.name}
        </span>
        <span className={`text-xs ${theme.textTertiary}`}>
          ({milestone.events.length} event{milestone.events.length !== 1 ? 's' : ''})
        </span>
      </button>

      {isOpen && (
        <div className="ml-6 mb-4 space-y-2">
          {milestone.events.map(event => (
            <div
              key={event.eventId}
              className={`p-3 rounded-md ${theme.cardSecondary}`}
            >
              <div className="flex items-center gap-2 text-xs mb-1">
                <Clock className="w-3 h-3 text-teal-500" />
                <span className={theme.textTertiary}>
                  {formatTimestamp(event.timestamp)}
                </span>
              </div>
              <p className={`text-sm ${theme.textPrimary}`}>
                {event.details}
              </p>
              {event.metadata && (
                <p className="text-xs font-geist-mono text-teal-600 dark:text-teal-400 mt-1 break-all">
                  {event.metadata}
                </p>
              )}
              <p className="text-xs font-geist-mono mt-1 text-gray-500 dark:text-slate-400 truncate">
                Caller: {event.caller}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const EventTimeline: React.FC<EventTimelineProps> = ({ events }) => {
  const theme = useThemeClasses();

  if (events.length === 0) {
    return (
      <div className={`text-center py-8 ${theme.textTertiary}`}>
        No events recorded yet
      </div>
    );
  }

  const milestones = groupEventsIntoMilestones(events);

  return (
    <div className="space-y-1">
      {milestones.map(milestone => (
        <MilestoneRow
          key={milestone.name}
          milestone={milestone}
          theme={theme}
        />
      ))}
    </div>
  );
};

export default EventTimeline;
