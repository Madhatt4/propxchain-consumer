/**
 * Transaction Audit Page — blockchain-verified audit report
 * Route: /transaction/:id/audit
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Download, FileText, Database, Loader2 } from 'lucide-react';
import { useThemeClasses } from '../hooks/useThemeClasses';
import { logger } from '@/utils/logger';
import type { AuditReport } from '../services/transactionAudit';
import { fetchAuditReport } from '../services/transactionAudit';
import IntegrityPanel from '../components/audit/IntegrityPanel';
import BlockchainTab from '../components/audit/BlockchainTab';
import PlatformTab from '../components/audit/PlatformTab';
import AuditPdfRenderer, { exportAuditPdf } from '../components/audit/AuditPdfRenderer';
import AppTopBar from '@/components/navigation/AppTopBar';

type TabKey = 'blockchain' | 'platform';

const TABS: { key: TabKey; label: string; icon: React.FC<{ className?: string }> }[] = [
  { key: 'blockchain', label: 'Blockchain Record', icon: FileText },
  { key: 'platform', label: 'Platform Activity', icon: Database },
];

function LoadingSkeleton(): React.ReactElement {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-16 rounded-lg bg-gray-200 dark:bg-gray-700" />
      <div className="h-8 rounded bg-gray-200 dark:bg-gray-700 w-1/3" />
      <div className="h-40 rounded-lg bg-gray-200 dark:bg-gray-700" />
      <div className="h-32 rounded-lg bg-gray-200 dark:bg-gray-700" />
      <div className="h-24 rounded-lg bg-gray-200 dark:bg-gray-700" />
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }): React.ReactElement {
  const theme = useThemeClasses();
  return (
    <div className={`rounded-lg p-8 text-center ${theme.cardBg}`}>
      <p className="text-red-500 mb-4">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="px-4 py-2 rounded-md bg-teal-600 text-white hover:bg-teal-700 transition-colors"
      >
        Retry
      </button>
    </div>
  );
}

const TransactionAuditPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const pdfRef = useRef<HTMLDivElement>(null);

  const [report, setReport] = useState<AuditReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('blockchain');
  const [isExporting, setIsExporting] = useState(false);

  const loadReport = useCallback(async (): Promise<void> => {
    if (!id) {
      setError('No transaction ID provided');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await fetchAuditReport(id);
      setReport(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load audit report';
      logger.error('Audit report fetch failed', { transactionId: id, error: err });
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const handleExportPdf = useCallback(async (): Promise<void> => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      await exportAuditPdf(pdfRef);
    } catch {
      logger.error('PDF export failed');
    } finally {
      setIsExporting(false);
    }
  }, [isExporting]);

  return (
    <div className="min-h-screen bg-[var(--bg-main)]">
      <AppTopBar
        title="Audit report"
        subtitle={id}
        backTo={id ? `/transaction/${id}/flow` : undefined}
        backLabel="Back to transaction"
      />

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {/* Page action — the top bar carries navigation only. */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={!report || isExporting}
            className={`flex h-11 items-center gap-1.5 rounded-lg px-4 text-sm font-medium transition-colors duration-200 ease-out ${
              !report || isExporting
                ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                : 'bg-teal-600 text-white hover:bg-teal-700'
            }`}
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Download PDF
          </button>
        </div>

        {isLoading && <LoadingSkeleton />}

        {!isLoading && error && (
          <ErrorState message={error} onRetry={loadReport} />
        )}

        {!isLoading && report && (
          <>
            {/* Integrity panel */}
            <IntegrityPanel integrity={report.integrityVerification} />

            {/* Tab bar */}
            <div className="flex overflow-x-auto gap-1 border-b border-gray-200 dark:border-gray-700">
              {TABS.map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                      isActive
                        ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Tab content — cached, no re-query on switch */}
            {activeTab === 'blockchain' && <BlockchainTab report={report} />}
            {activeTab === 'platform' && <PlatformTab report={report} />}

            {/* Error badges for individual sections */}
            {Object.keys(report.errors).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {Object.entries(report.errors).map(([key, msg]) => (
                  <span
                    key={key}
                    className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                  >
                    {key}: {msg}
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* Hidden PDF renderer */}
      {report && <AuditPdfRenderer ref={pdfRef} report={report} />}
    </div>
  );
};

export default TransactionAuditPage;
