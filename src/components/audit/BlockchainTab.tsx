/**
 * Blockchain Tab — transaction summary, events, documents, chain, efficiency
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, MapPin, Users, Hash } from 'lucide-react';
import { useThemeClasses } from '../../hooks/useThemeClasses';
import EventTimeline from './EventTimeline';
import DocumentInventory from './DocumentInventory';
import HmlrRegisterCard from './HmlrRegisterCard';
import ChainPositionCard from './ChainPositionCard';
import EfficiencyCard from './EfficiencyCard';
import type { AuditReport } from '../../services/transactionAudit';

interface BlockchainTabProps {
  report: AuditReport;
}

interface CollapsibleSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  defaultOpen = true,
  children,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const theme = useThemeClasses();

  return (
    <div className={`rounded-lg border border-gray-200 dark:border-[#1E293B] ${theme.cardBg} overflow-hidden`}>
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className={`flex items-center gap-2 w-full p-4 text-left ${theme.textPrimary}`}
      >
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-teal-500" />
        ) : (
          <ChevronRight className="w-4 h-4 text-teal-500" />
        )}
        <h3 className="font-fraunces font-semibold text-base">{title}</h3>
      </button>
      {isOpen && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
};

const TransactionSummary: React.FC<{ report: AuditReport }> = ({ report }) => {
  const theme = useThemeClasses();
  const tx = report.transaction;

  return (
    <div className="space-y-3">
      {tx && (
        <>
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-teal-500 mt-0.5" />
            <div>
              <p className={`text-sm font-medium ${theme.textPrimary}`}>
                {String(tx.propertyAddress ?? 'Address not available')}
              </p>
              <p className={`text-xs ${theme.textTertiary}`}>
                {String(tx.status ?? 'Unknown status')}
              </p>
            </div>
          </div>
          {tx.purchasePrice != null && (
            <p className={`text-sm ${theme.textSecondary}`}>
              Amount: <span className="font-semibold">&pound;{Number(tx.purchasePrice).toLocaleString()}</span>
            </p>
          )}
        </>
      )}
      {report.parties.length > 0 && (
        <div className="flex items-start gap-2">
          <Users className="w-4 h-4 text-teal-500 mt-0.5" />
          <div className="space-y-1">
            {report.parties.map((party, idx) => (
              <p key={idx} className={`text-sm ${theme.textSecondary}`}>
                <span className="capitalize">{String(party.role ?? 'Party')}</span>
                {' — '}
                <span className="font-geist-mono text-xs">
                  {String(party.principal ?? 'unknown')}
                </span>
              </p>
            ))}
          </div>
        </div>
      )}
      <div className="flex items-center gap-2">
        <Hash className="w-4 h-4 text-teal-500" />
        <span className="font-geist-mono text-xs text-gray-500 dark:text-slate-400 break-all">
          {report.transactionId}
        </span>
      </div>
    </div>
  );
};

const BlockchainTab: React.FC<BlockchainTabProps> = ({ report }) => {
  return (
    <div className="space-y-4">
      <CollapsibleSection title="Transaction Summary">
        <TransactionSummary report={report} />
      </CollapsibleSection>

      <CollapsibleSection title="Event Timeline">
        <EventTimeline events={report.blockchainEventLog} />
      </CollapsibleSection>

      <CollapsibleSection title="HMLR Title Register">
        <HmlrRegisterCard hmlrFetch={report.hmlrFetch} />
      </CollapsibleSection>

      <CollapsibleSection title="Document Inventory">
        <DocumentInventory documents={report.documents} />
      </CollapsibleSection>

      <CollapsibleSection title="Property Chain Position" defaultOpen={false}>
        <ChainPositionCard
          chainData={report.chainPosition as Array<{
            transactionId?: string;
            address?: string;
            status?: string;
            [key: string]: unknown;
          }> | null}
          currentTransactionId={report.transactionId}
        />
      </CollapsibleSection>

      <EfficiencyCard
        metrics={report.efficiencyMetrics as {
          blockchainDays?: number;
          traditionalDays?: number;
          blockchainCost?: number;
          traditionalCost?: number;
          [key: string]: unknown;
        } | null}
      />
    </div>
  );
};

export default BlockchainTab;
