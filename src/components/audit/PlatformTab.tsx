/**
 * Platform Tab — payments, skill executions, consent trail, notifications
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import { useThemeClasses } from '../../hooks/useThemeClasses';
import type { AuditReport, PaymentRecord } from '../../services/transactionAudit';

interface PlatformTabProps {
  report: AuditReport;
}

interface CollapsibleProps {
  title: string;
  errorKey?: string;
  errors: Record<string, string>;
  children: React.ReactNode;
}

const PlatformSection: React.FC<CollapsibleProps> = ({
  title,
  errorKey,
  errors,
  children,
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const theme = useThemeClasses();
  const hasError = errorKey ? Boolean(errors[errorKey]) : false;

  return (
    <div className={`rounded-lg border border-gray-200 dark:border-[#1E293B] ${theme.cardBg} overflow-hidden`}>
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className={`flex items-center gap-2 w-full p-4 text-left ${theme.textPrimary}`}
      >
        {isOpen ? <ChevronDown className="w-4 h-4" style={{ color: '#84A98C' }} /> : <ChevronRight className="w-4 h-4" style={{ color: '#84A98C' }} />}
        <h3 className="font-fraunces font-semibold text-base">{title}</h3>
        {hasError && (
          <span className="ml-auto flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
            <AlertTriangle className="w-3 h-3" />
            Unavailable
          </span>
        )}
      </button>
      {isOpen && (
        <div className="px-4 pb-4">
          {hasError ? (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              Platform data unavailable
            </p>
          ) : (
            children
          )}
        </div>
      )}
    </div>
  );
};

const PaymentsTable: React.FC<{ payments: PaymentRecord[] }> = ({ payments }) => {
  const theme = useThemeClasses();

  if (payments.length === 0) {
    return <p className={`text-sm ${theme.textTertiary}`}>No payments recorded</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className={theme.textTertiary}>
            <th className="text-left py-1 pr-4">Amount</th>
            <th className="text-left py-1 pr-4">Status</th>
            <th className="text-left py-1">Date</th>
          </tr>
        </thead>
        <tbody>
          {payments.map(p => (
            <tr key={p.id} className={theme.textSecondary}>
              <td className="py-1 pr-4 font-geist-mono">
                &pound;{p.amount.toLocaleString()} {p.currency}
              </td>
              <td className="py-1 pr-4 capitalize">{p.status}</td>
              <td className="py-1">
                {new Date(p.createdAt).toLocaleDateString('en-GB')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const PlatformTab: React.FC<PlatformTabProps> = ({ report }) => {
  const theme = useThemeClasses();

  return (
    <div className="space-y-4">
      <PlatformSection title="Payments" errorKey="supabase_payments" errors={report.errors}>
        <PaymentsTable payments={report.payments} />
      </PlatformSection>

      <PlatformSection title="Skill Executions" errorKey="supabase_skills" errors={report.errors}>
        {report.skillExecutions.length === 0 ? (
          <p className={`text-sm ${theme.textTertiary}`}>No skill executions</p>
        ) : (
          <ul className="space-y-2">
            {report.skillExecutions.map((s, i) => (
              <li key={i} className={`text-sm ${theme.textSecondary}`}>
                {String(s.skill_name ?? 'Unknown')} &mdash; {String(s.status ?? '')}
              </li>
            ))}
          </ul>
        )}
      </PlatformSection>

      <PlatformSection title="Consent Trail" errorKey="supabase_consent" errors={report.errors}>
        {report.consentTrail.length === 0 ? (
          <p className={`text-sm ${theme.textTertiary}`}>No consent records</p>
        ) : (
          <ul className="space-y-2">
            {report.consentTrail.map((c, i) => (
              <li key={i} className={`text-sm ${theme.textSecondary}`}>
                {String(c.consent_type ?? 'Consent')} &mdash; {String(c.status ?? '')}
              </li>
            ))}
          </ul>
        )}
      </PlatformSection>

      <PlatformSection title="Notifications" errorKey="supabase_notifications" errors={report.errors}>
        {report.notifications.length === 0 ? (
          <p className={`text-sm ${theme.textTertiary}`}>No notifications sent</p>
        ) : (
          <ul className="space-y-2">
            {report.notifications.map((n, i) => (
              <li key={i} className={`text-sm ${theme.textSecondary}`}>
                {String(n.event_type ?? 'Notification')} &mdash;{' '}
                {String(n.channel ?? '')}
              </li>
            ))}
          </ul>
        )}
      </PlatformSection>
    </div>
  );
};

export default PlatformTab;
