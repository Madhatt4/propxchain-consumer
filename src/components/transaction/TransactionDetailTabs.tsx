/**
 * PropXchain - Transaction Detail Tabs Component
 * Provides tabbed interface for Checklist, Documents, and Chain view
 * Now with multi-party support for N buyers and N sellers
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Transaction, Document } from '../../types/transaction.types';
import { icpService } from '../../services/icp.service';
import { recordOnBehalf } from '@/services/onBehalf';
import DocumentUpload from '../common/DocumentUpload';
import { DOCUMENT_TYPES, getRequiredDocumentsForRole, getPartyCountsForTransaction } from '../../constants/documentTypes';
import TA6Form from '../forms/TA6Form';
import { makeTa6Uploader } from '../forms/ta6/widgets/ta6Uploader';
import TA10Form from '../forms/TA10Form';
import TA7Form from '../forms/TA7Form';
import { TA6PropertyInformation } from '../../types/ta6.types';
import { TA10FittingsAndContents } from '../../types/ta10.types';
import { TA7LeaseholdInformation } from '../../types/ta7.types';
import { logger } from '@/utils/logger';
import { cleanupDocumentState } from '@/utils/documentCleanup';
import { sessionManager } from '@/utils/sessionManager';
import { getStorePrincipalId } from '@/stores/authStore';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import LegalTab from './LegalTab';
import type { SolicitorRecord } from '../../types/solicitor.types';

interface TransactionDetailTabsProps {
  transaction: Transaction;
  onDocumentUploaded?: (doc: Document) => void;
}

interface PartyInfo {
  principal: string;
  name?: string;
  email?: string;
  role: string;
}

type TabType = 'checklist' | 'documents' | 'ta6' | 'ta10' | 'ta7' | 'chain' | 'legal' | 'activity';

interface ChecklistItem {
  id: string;
  label: string;
  completed: boolean;
  category: 'seller' | 'buyer' | 'shared';
  documentType?: string;
}

interface BlockchainActivity {
  id: string;
  action: string;
  timestamp: string;
  actor: string;
  hash?: string;
  metadata?: string;
}

const TransactionDetailTabs: React.FC<TransactionDetailTabsProps> = ({
  transaction,
  onDocumentUploaded
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('checklist');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [blockchainActivity, setBlockchainActivity] = useState<BlockchainActivity[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<'seller' | 'buyer' | null>(null);
  const [sellerInfo, setSellerInfo] = useState<PartyInfo | null>(null);
  const [buyerInfo, setBuyerInfo] = useState<PartyInfo | null>(null);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  // TA6 official-wording acknowledgment for the seller. undefined never blocks;
  // false blocks the editable form via TA6Form's gate.
  const [ta6Acknowledged, setTa6Acknowledged] = useState<boolean | undefined>(undefined);
  const { toast } = useToast();
  const lastToastTime = React.useRef<number>(0);

  const ta6TxId = transaction.id?.toString() || '';
  const ta6Uploader = useMemo(() => makeTa6Uploader(ta6TxId), [ta6TxId]);
  const handleAcknowledgeTA6 = useCallback(async (): Promise<void> => {
    await icpService.acknowledgeTA6Wording(ta6TxId);
    setTa6Acknowledged(true);
  }, [ta6TxId]);

  // Load CSRF token for secure uploads
  useEffect(() => {
    const token = sessionManager.getCsrfToken();
    setCsrfToken(token);
    if (!token) {
      logger.warn('⚠️ CSRF token not available - uploads may fail');
    }
  }, []);

  // Determine user role based on transaction
  useEffect(() => {
    const principalId = getStorePrincipalId() || '';
    if (transaction.seller === principalId || transaction.createdBy === principalId) {
      setCurrentUserRole('seller');
    } else {
      setCurrentUserRole('buyer');
    }
  }, [transaction]);

  // Fetch the seller's TA6 official-wording acknowledgment when the TA6 tab is
  // opened. Only the seller edits the form, so only they see the gate.
  useEffect(() => {
    if (activeTab !== 'ta6' || currentUserRole !== 'seller' || !ta6TxId) return;
    let cancelled = false;
    void icpService
      .hasAcknowledgedTA6Wording(ta6TxId)
      .then((ack) => { if (!cancelled) setTa6Acknowledged(ack); })
      .catch((err: unknown) => {
        logger.warn('TA6 acknowledgment check failed:', err);
        if (!cancelled) setTa6Acknowledged(undefined);
      });
    return () => { cancelled = true; };
  }, [activeTab, currentUserRole, ta6TxId]);

  // Load party information
  useEffect(() => {
    const loadPartyInfo = async () => {
      try {
        await icpService.initialize();

        // Get seller info
        if (transaction.seller || transaction.createdBy) {
          const sellerPrincipal = transaction.seller || transaction.createdBy;
          // Check if we have party info from transaction.parties
          const sellerParty = transaction.parties?.find(p => p.role === 'seller' || p.userId === sellerPrincipal);
          setSellerInfo({
            principal: sellerPrincipal,
            name: sellerParty?.name,
            email: sellerParty?.email,
            role: 'Seller'
          });
        }

        // Get buyer info
        if (transaction.buyer) {
          const buyerParty = transaction.parties?.find(p => p.role === 'buyer' || p.userId === transaction.buyer);
          setBuyerInfo({
            principal: transaction.buyer,
            name: buyerParty?.name,
            email: buyerParty?.email,
            role: 'Buyer'
          });
        }
      } catch (error) {
        logger.error('Error loading party info:', error);
      }
    };

    loadPartyInfo();
  }, [transaction]);

  // Load documents for this transaction
  useEffect(() => {
    const loadDocuments = async () => {
      try {
        setLoading(true);
        await icpService.initialize();
        const txDocs = await icpService.getDocumentsByTransaction(transaction.id);
        setDocuments(txDocs || []);
      } catch (error) {
        logger.error('Error loading documents:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDocuments();
  }, [transaction.id]);

  // Load blockchain activity
  useEffect(() => {
    const loadActivity = async () => {
      try {
        // Get audit logs for documents in this transaction (using rate-limited service method)
        const activity: BlockchainActivity[] = [];

        for (const doc of documents) {
          if (doc.storageDocumentId) {
            try {
              const logs = await icpService.getAuditLogs(doc.storageDocumentId);
              if (logs && Array.isArray(logs)) {
                logs.forEach((log: any) => {
                  activity.push({
                    id: `${log.id}`,
                    action: log.action,
                    timestamp: new Date(Number(log.timestamp) / 1000000).toISOString(),
                    actor: log.actorPrincipal?.toString()?.slice(0, 12) + '...' || 'Unknown',
                    hash: log.metadata?.match(/Hash: ([a-f0-9]+)/)?.[1]?.slice(0, 16) + '...',
                    metadata: log.metadata
                  });
                });
              }
            } catch (e) {
              logger.warn('Could not load audit logs for doc:', doc.id);
            }
          }
        }

        // Sort by timestamp descending
        activity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setBlockchainActivity(activity.slice(0, 20)); // Limit to 20 most recent
      } catch (error) {
        logger.error('Error loading blockchain activity:', error);
      }
    };

    if (documents.length > 0 && activeTab === 'activity') {
      loadActivity();
    }
  }, [documents, activeTab]);

  // Define checklist items based on transaction type
  // Uses DOCUMENT_TYPES storageKeys to match what DocumentUpload uses
  const getChecklistItems = (): ChecklistItem[] => {
    const items: ChecklistItem[] = [];

    // Seller documents - using storageKeys from DOCUMENT_TYPES
    // NOTE: AML documents (Proof of Identity / Proof of Address) are intentionally
    // NOT listed at launch. PropXchain does not collect AML from individual parties —
    // the estate agent and/or conveyancer perform their own AML/KYC. An AML provider
    // panel is a future addition; re-introduce these items when that ships.
    // Property documents
    items.push({
      id: DOCUMENT_TYPES.TITLE_DEEDS.storageKey,
      label: DOCUMENT_TYPES.TITLE_DEEDS.displayName,
      completed: documents.some(d => d.type === DOCUMENT_TYPES.TITLE_DEEDS.storageKey),
      category: 'seller',
      documentType: DOCUMENT_TYPES.TITLE_DEEDS.storageKey
    });
    items.push({
      id: DOCUMENT_TYPES.ENERGY_PERFORMANCE_CERTIFICATE.storageKey,
      label: DOCUMENT_TYPES.ENERGY_PERFORMANCE_CERTIFICATE.displayName,
      completed: documents.some(d => d.type === DOCUMENT_TYPES.ENERGY_PERFORMANCE_CERTIFICATE.storageKey),
      category: 'seller',
      documentType: DOCUMENT_TYPES.ENERGY_PERFORMANCE_CERTIFICATE.storageKey
    });
    items.push({
      id: DOCUMENT_TYPES.TA6_PROPERTY_INFORMATION_FORM.storageKey,
      label: DOCUMENT_TYPES.TA6_PROPERTY_INFORMATION_FORM.displayName,
      completed: documents.some(d => d.type === DOCUMENT_TYPES.TA6_PROPERTY_INFORMATION_FORM.storageKey),
      category: 'seller',
      documentType: DOCUMENT_TYPES.TA6_PROPERTY_INFORMATION_FORM.storageKey
    });
    items.push({
      id: DOCUMENT_TYPES.TA10_FITTINGS_CONTENTS.storageKey,
      label: DOCUMENT_TYPES.TA10_FITTINGS_CONTENTS.displayName,
      completed: documents.some(d => d.type === DOCUMENT_TYPES.TA10_FITTINGS_CONTENTS.storageKey),
      category: 'seller',
      documentType: DOCUMENT_TYPES.TA10_FITTINGS_CONTENTS.storageKey
    });

    // Buyer documents
    // NOTE: AML documents (Proof of Identity / Proof of Address) intentionally omitted
    // at launch — see the seller note above. AML is handled off-platform by the agent /
    // conveyancer until the AML provider panel ships.
    // Financial documents
    items.push({
      id: DOCUMENT_TYPES.PROOF_OF_FUNDS.storageKey,
      label: DOCUMENT_TYPES.PROOF_OF_FUNDS.displayName,
      completed: documents.some(d => d.type === DOCUMENT_TYPES.PROOF_OF_FUNDS.storageKey),
      category: 'buyer',
      documentType: DOCUMENT_TYPES.PROOF_OF_FUNDS.storageKey
    });
    items.push({
      id: DOCUMENT_TYPES.MORTGAGE_AGREEMENT.storageKey,
      label: DOCUMENT_TYPES.MORTGAGE_AGREEMENT.displayName,
      completed: documents.some(d => d.type === DOCUMENT_TYPES.MORTGAGE_AGREEMENT.storageKey),
      category: 'buyer',
      documentType: DOCUMENT_TYPES.MORTGAGE_AGREEMENT.storageKey
    });

    // Shared documents
    items.push({
      id: DOCUMENT_TYPES.SURVEY_REPORT.storageKey,
      label: DOCUMENT_TYPES.SURVEY_REPORT.displayName,
      completed: documents.some(d => d.type === DOCUMENT_TYPES.SURVEY_REPORT.storageKey),
      category: 'shared',
      documentType: DOCUMENT_TYPES.SURVEY_REPORT.storageKey
    });
    items.push({
      id: DOCUMENT_TYPES.LAND_REGISTRY_CONFIRMATION.storageKey,
      label: DOCUMENT_TYPES.LAND_REGISTRY_CONFIRMATION.displayName,
      completed: documents.some(d => d.type === DOCUMENT_TYPES.LAND_REGISTRY_CONFIRMATION.storageKey),
      category: 'shared',
      documentType: DOCUMENT_TYPES.LAND_REGISTRY_CONFIRMATION.storageKey
    });

    return items;
  };

  const handleDocumentUpload = async (doc: Document) => {
    setDocuments(prev => [...prev, doc]);
    onDocumentUploaded?.(doc);

    // Reload documents from blockchain to get updated list with storage IDs and hashes
    // This triggers the blockchain activity log to refresh (via useEffect dependency)
    try {
      await icpService.initialize();
      const txDocs = await icpService.getDocumentsByTransaction(transaction.id);
      setDocuments(txDocs || []);
      logger.info('✅ Documents reloaded from blockchain after upload - activity log will update');
    } catch (error) {
      logger.error('Error reloading documents after upload:', error);
    }
  };

  const handleDeleteDocument = async (doc: Document) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete "${doc.fileName}"?\n\nThis will remove the document from the blockchain. This action cannot be undone.`
    );

    if (!confirmDelete) return;

    try {
      await icpService.initialize();
      await icpService.ensureDocumentStorageActor();

      // Delete from document_storage canister
      if (doc.storageDocumentId) {
        await icpService.deleteStorageDocument(doc.storageDocumentId);
      }

      // Delete from document_verification canister
      // Fallback: if verificationDocumentId is missing (e.g. page was refreshed and
      // localStorage mapping was cleared), try to reconstruct from mapping key
      let verificationId = doc.verificationDocumentId;
      if (!verificationId && doc.storageDocumentId) {
        try {
          const mapped = localStorage.getItem(`doc_id_mapping_${doc.storageDocumentId}`);
          if (mapped) {
            verificationId = Number(mapped);
            logger.info(`[Delete] Recovered verificationDocumentId ${verificationId} from localStorage mapping`);
          }
        } catch {
          // localStorage unavailable
        }
      }
      if (verificationId) {
        await icpService.deleteVerificationDocument(verificationId);
      } else {
        logger.warn(`[Delete] No verificationDocumentId for document ${doc.id} — verification record may be orphaned`);
      }

      // Clean up localStorage (Oscar results, ID mappings) and IndexedDB registry
      cleanupDocumentState(doc);

      // Update local state immediately (instant UI feedback)
      setDocuments(prev => prev.filter(d => d.id !== doc.id));

      toast({ title: 'Document deleted successfully' });

      // Reload from blockchain to ensure consistency
      try {
        const txDocs = await icpService.getDocumentsByTransaction(transaction.id);
        setDocuments(txDocs || []);
      } catch (reloadError) {
        logger.error('Error reloading documents after delete:', reloadError);
      }
    } catch (error) {
      logger.error('Error deleting document:', error);
      toast({ title: 'Failed to delete document. Please try again.', variant: 'destructive' });
    }
  };

  const getCategoryProgress = (category: 'seller' | 'buyer' | 'shared') => {
    const items = getChecklistItems().filter(item => item.category === category);
    const completed = items.filter(item => item.completed).length;
    return { completed, total: items.length, percentage: items.length > 0 ? Math.round((completed / items.length) * 100) : 0 };
  };

  // Role-aware tabs: sellers get edit-focused tabs, buyers get streamlined review tabs
  const isSeller = currentUserRole === 'seller';
  const tabs: { id: TabType; label: string; icon: string }[] = isSeller
    ? [
        { id: 'checklist', label: 'Checklist', icon: '✓' },
        { id: 'documents', label: 'Documents', icon: '📄' },
        { id: 'ta6', label: 'TA6 Property Info', icon: '🏠' },
        { id: 'ta10', label: 'TA10 Fittings', icon: '🛋️' },
        ...(transaction.propertyType === 'leasehold' ? [{ id: 'ta7' as TabType, label: 'TA7 Leasehold', icon: '📋' }] : []),
        { id: 'chain', label: 'Chain', icon: '🔗' },
        { id: 'legal', label: 'Legal', icon: '⚖️' },
        { id: 'activity', label: 'Activity', icon: '📜' }
      ]
    : [
        { id: 'checklist', label: 'Overview', icon: '✓' },
        { id: 'documents', label: 'My Documents', icon: '📄' },
        { id: 'ta6', label: 'Property Info', icon: '🏠' },
        { id: 'ta10', label: 'Fittings', icon: '🛋️' },
        { id: 'chain', label: 'Chain', icon: '🔗' },
        { id: 'legal', label: 'Legal', icon: '⚖️' },
        { id: 'activity', label: 'Activity', icon: '📜' }
      ];

  return (
    <div className="transaction-detail-tabs" style={{ background: 'var(--bg-main)', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
      {/* Tab Navigation - horizontally scrollable on mobile */}
      <div
        className="flex overflow-x-auto scrollbar-hide snap-x snap-mandatory md:overflow-x-visible"
        style={{ borderBottom: '1px solid var(--border-color)', WebkitOverflowScrolling: 'touch' }}
      >
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="snap-start shrink-0 md:shrink md:flex-1"
            style={{
              minHeight: '44px',
              padding: '12px 16px',
              background: activeTab === tab.id ? 'var(--bg-section)' : 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
              color: activeTab === tab.id ? 'var(--text-main)' : 'var(--text-secondary)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              whiteSpace: 'nowrap'
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-3 sm:p-4 md:p-5" style={{ background: 'var(--bg-main)' }}>
        {/* CHECKLIST TAB - Role-aware */}
        {activeTab === 'checklist' && (
          <div>
            {isSeller ? (
              <>
                {/* SELLER CHECKLIST - Full view with all categories */}
                <div style={{ marginBottom: '20px' }}>
                  <h3 style={{ color: 'var(--text-main)', fontSize: '16px', marginBottom: '8px' }}>Seller Document Checklist</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Upload all required documents to progress your sale</p>
                </div>

                {/* Seller Documents - Primary focus */}
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ color: '#A78BFA', fontSize: '14px', fontWeight: 600 }}>Your Documents (Seller)</span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                      {getCategoryProgress('seller').completed}/{getCategoryProgress('seller').total}
                    </span>
                  </div>
                  <div style={{ background: 'var(--bg-section)', borderRadius: '8px', padding: '12px' }}>
                    {getChecklistItems().filter(item => item.category === 'seller').map(item => (
                      <div key={item.id} style={{
                        display: 'flex', alignItems: 'center', padding: '10px 0', minHeight: '44px',
                        borderBottom: '1px solid var(--border-light)'
                      }}>
                        <div style={{
                          width: '24px', height: '24px', borderRadius: '50%',
                          background: item.completed ? '#10B981' : 'var(--border-light)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          marginRight: '12px', flexShrink: 0
                        }}>
                          {item.completed && <span style={{ color: 'white', fontSize: '12px' }}>✓</span>}
                        </div>
                        <span style={{ color: item.completed ? '#10B981' : 'var(--text-main)', fontSize: '14px' }}>
                          {item.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Buyer Documents - Secondary (seller can track buyer progress) */}
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ color: '#34D399', fontSize: '14px', fontWeight: 600 }}>Buyer's Documents</span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                      {getCategoryProgress('buyer').completed}/{getCategoryProgress('buyer').total}
                    </span>
                  </div>
                  <div style={{ background: 'var(--bg-section)', borderRadius: '8px', padding: '12px' }}>
                    {getChecklistItems().filter(item => item.category === 'buyer').map(item => (
                      <div key={item.id} style={{
                        display: 'flex', alignItems: 'center', padding: '10px 0', minHeight: '44px',
                        borderBottom: '1px solid var(--border-light)'
                      }}>
                        <div style={{
                          width: '24px', height: '24px', borderRadius: '50%',
                          background: item.completed ? '#10B981' : 'var(--border-light)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          marginRight: '12px', flexShrink: 0
                        }}>
                          {item.completed && <span style={{ color: 'white', fontSize: '12px' }}>✓</span>}
                        </div>
                        <span style={{ color: item.completed ? '#10B981' : 'var(--text-main)', fontSize: '14px' }}>
                          {item.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Shared Documents */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 600 }}>Shared Documents</span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                      {getCategoryProgress('shared').completed}/{getCategoryProgress('shared').total}
                    </span>
                  </div>
                  <div style={{ background: 'var(--bg-section)', borderRadius: '8px', padding: '12px' }}>
                    {getChecklistItems().filter(item => item.category === 'shared').map(item => (
                      <div key={item.id} style={{
                        display: 'flex', alignItems: 'center', padding: '10px 0', minHeight: '44px',
                        borderBottom: '1px solid var(--border-light)'
                      }}>
                        <div style={{
                          width: '24px', height: '24px', borderRadius: '50%',
                          background: item.completed ? '#10B981' : 'var(--border-light)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          marginRight: '12px', flexShrink: 0
                        }}>
                          {item.completed && <span style={{ color: 'white', fontSize: '12px' }}>✓</span>}
                        </div>
                        <span style={{ color: item.completed ? '#10B981' : 'var(--text-main)', fontSize: '14px' }}>
                          {item.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* BUYER CHECKLIST - Streamlined overview */}
                <div style={{ marginBottom: '20px' }}>
                  <h3 style={{ color: 'var(--text-main)', fontSize: '16px', marginBottom: '8px' }}>Transaction Overview</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Track the overall progress of your purchase</p>
                </div>

                {/* Your Documents (Buyer) - Primary focus */}
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ color: '#34D399', fontSize: '14px', fontWeight: 600 }}>Your Documents (Buyer)</span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                      {getCategoryProgress('buyer').completed}/{getCategoryProgress('buyer').total}
                    </span>
                  </div>
                  <div style={{ background: 'var(--bg-section)', borderRadius: '8px', padding: '12px' }}>
                    {getChecklistItems().filter(item => item.category === 'buyer').map(item => (
                      <div key={item.id} style={{
                        display: 'flex', alignItems: 'center', padding: '10px 0', minHeight: '44px',
                        borderBottom: '1px solid var(--border-light)'
                      }}>
                        <div style={{
                          width: '24px', height: '24px', borderRadius: '50%',
                          background: item.completed ? '#10B981' : 'var(--border-light)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          marginRight: '12px', flexShrink: 0
                        }}>
                          {item.completed && <span style={{ color: 'white', fontSize: '12px' }}>✓</span>}
                        </div>
                        <span style={{ color: item.completed ? '#10B981' : 'var(--text-main)', fontSize: '14px' }}>
                          {item.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Seller's Documents - Read-only status view */}
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ color: '#A78BFA', fontSize: '14px', fontWeight: 600 }}>Seller's Documents</span>
                    <span style={{
                      background: getCategoryProgress('seller').percentage === 100 ? '#10B98120' : '#F59E0B20',
                      color: getCategoryProgress('seller').percentage === 100 ? '#10B981' : '#F59E0B',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 600
                    }}>
                      {getCategoryProgress('seller').percentage === 100 ? 'Complete' : `${getCategoryProgress('seller').completed}/${getCategoryProgress('seller').total} uploaded`}
                    </span>
                  </div>
                  <div style={{ background: 'var(--bg-section)', borderRadius: '8px', padding: '12px' }}>
                    {getChecklistItems().filter(item => item.category === 'seller').map(item => (
                      <div key={item.id} style={{
                        display: 'flex', alignItems: 'center', padding: '10px 0',
                        minHeight: '44px',
                        borderBottom: '1px solid var(--border-light)'
                      }}>
                        <div style={{
                          width: '20px', height: '20px', borderRadius: '50%',
                          background: item.completed ? '#A78BFA' : 'var(--border-light)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          marginRight: '10px', flexShrink: 0
                        }}>
                          {item.completed && <span style={{ color: 'white', fontSize: '10px' }}>✓</span>}
                        </div>
                        <span style={{ color: item.completed ? '#A78BFA' : 'var(--text-muted)', fontSize: '13px' }}>
                          {item.label}
                        </span>
                        <span style={{
                          marginLeft: 'auto',
                          fontSize: '11px',
                          color: item.completed ? '#A78BFA' : 'var(--text-muted)'
                        }}>
                          {item.completed ? 'Done' : 'Pending'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Shared Documents */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 600 }}>Shared Documents</span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                      {getCategoryProgress('shared').completed}/{getCategoryProgress('shared').total}
                    </span>
                  </div>
                  <div style={{ background: 'var(--bg-section)', borderRadius: '8px', padding: '12px' }}>
                    {getChecklistItems().filter(item => item.category === 'shared').map(item => (
                      <div key={item.id} style={{
                        display: 'flex', alignItems: 'center', padding: '10px 0', minHeight: '44px',
                        borderBottom: '1px solid var(--border-light)'
                      }}>
                        <div style={{
                          width: '24px', height: '24px', borderRadius: '50%',
                          background: item.completed ? '#10B981' : 'var(--border-light)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          marginRight: '12px', flexShrink: 0
                        }}>
                          {item.completed && <span style={{ color: 'white', fontSize: '12px' }}>✓</span>}
                        </div>
                        <span style={{ color: item.completed ? '#10B981' : 'var(--text-main)', fontSize: '14px' }}>
                          {item.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* DOCUMENTS TAB */}
        {activeTab === 'documents' && (
          <div>
            {/* Party Information Section - Collapsible Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
              {/* Seller Card - Collapsible */}
              <Collapsible defaultOpen={false}>
                <div style={{ background: 'var(--bg-section)', borderRadius: '12px', borderLeft: '4px solid #A78BFA', overflow: 'hidden' }}>
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="w-full text-left group"
                      style={{
                        padding: '12px 16px',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: '#7C3AED20',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#A78BFA',
                          fontWeight: 600,
                          fontSize: '14px'
                        }}>
                          {sellerInfo?.name?.[0]?.toUpperCase() || 'S'}
                        </div>
                        <div style={{ textAlign: 'left' }}>
                          <span style={{ color: '#A78BFA', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', display: 'block' }}>Seller</span>
                          <span style={{ color: 'var(--text-main)', fontSize: '13px' }}>{sellerInfo?.name || 'Not assigned'}</span>
                        </div>
                      </div>
                      <ChevronDown className="h-4 w-4 text-gray-400 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div style={{ padding: '0 16px 16px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '12px', width: '60px' }}>ID:</span>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '12px', fontFamily: 'monospace' }}>
                          {sellerInfo?.principal ? `${sellerInfo.principal.slice(0, 8)}...${sellerInfo.principal.slice(-4)}` : 'N/A'}
                        </span>
                      </div>
                      {sellerInfo?.email && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ color: 'var(--text-muted)', fontSize: '12px', width: '60px' }}>Email:</span>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{sellerInfo.email}</span>
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '12px', width: '60px' }}>Address:</span>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{transaction.propertyAddress || 'N/A'}</span>
                      </div>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>

              {/* Buyer Card - Collapsible */}
              <Collapsible defaultOpen={false}>
                <div style={{ background: 'var(--bg-section)', borderRadius: '12px', borderLeft: '4px solid #34D399', overflow: 'hidden' }}>
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="w-full text-left group"
                      style={{
                        padding: '12px 16px',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: '#10B98120',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#34D399',
                          fontWeight: 600,
                          fontSize: '14px'
                        }}>
                          {buyerInfo?.name?.[0]?.toUpperCase() || 'B'}
                        </div>
                        <div style={{ textAlign: 'left' }}>
                          <span style={{ color: '#34D399', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', display: 'block' }}>Buyer</span>
                          <span style={{ color: 'var(--text-main)', fontSize: '13px' }}>{buyerInfo?.name || 'Not assigned'}</span>
                        </div>
                      </div>
                      <ChevronDown className="h-4 w-4 text-gray-400 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div style={{ padding: '0 16px 16px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '12px', width: '60px' }}>ID:</span>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '12px', fontFamily: 'monospace' }}>
                          {buyerInfo?.principal ? `${buyerInfo.principal.slice(0, 8)}...${buyerInfo.principal.slice(-4)}` : 'N/A'}
                        </span>
                      </div>
                      {buyerInfo?.email && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ color: 'var(--text-muted)', fontSize: '12px', width: '60px' }}>Email:</span>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{buyerInfo.email}</span>
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '12px', width: '60px' }}>AIP:</span>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                          {transaction.financialTerms?.hasMortgage ? 'Mortgage' : 'Cash Buyer'}
                        </span>
                      </div>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            </div>

            {/* Required Documents Section - Role-aware */}
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ color: 'var(--text-main)', fontSize: '18px', marginBottom: '8px', fontWeight: 600 }}>
                {isSeller ? 'Required Documents' : 'Your Required Documents'}
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '16px' }}>
                {isSeller
                  ? 'Upload and manage all required documents for your sale. Files are hash-verified on blockchain.'
                  : 'Upload your buyer documents below. The seller is responsible for their own document uploads.'}
              </p>

              {/* Show ALL required documents based on user role (multi-party aware) */}
              {(() => {
                const userRole = currentUserRole || 'buyer';
                const { sellerCount, buyerCount } = getPartyCountsForTransaction(transaction.id);
                const partyCount = userRole === 'seller' ? sellerCount : buyerCount;
                const requiredDocs = getRequiredDocumentsForRole(userRole, transaction, partyCount);

                // Filter documents to current user's role to prevent cross-party matching
                // (e.g. buyer's proofOfIdentity showing in seller's slot after delete + re-fetch)
                const currentPrincipal = getStorePrincipalId() || '';
                const isDocForCurrentRole = (d: Document): boolean => {
                  if (d.category === userRole) return true;
                  // Ambiguous docs (category === 'shared') — match by uploader principal
                  if (d.category === 'shared' && d.uploadedBy === currentPrincipal) return true;
                  return false;
                };

                return (
                  <div style={{ display: 'grid', gap: '12px' }}>
                    {requiredDocs.map((docType) => {
                      // For person-variant keys (proofOfIdentity_person1), also match base type by count
                      const baseKey = docType.storageKey.replace(/_person[12]$/, '');
                      const isPersonVariant = docType.storageKey !== baseKey;
                      let existingDoc: typeof documents[number] | undefined;
                      if (isPersonVariant) {
                        // First try exact match on the person-specific key
                        existingDoc = documents.find(d => d.type === docType.storageKey && isDocForCurrentRole(d));
                        if (!existingDoc) {
                          // Fall back to counting base-type matches
                          const baseMatches = documents.filter(d => d.type === baseKey && isDocForCurrentRole(d));
                          const personNum = docType.storageKey.endsWith('_person2') ? 2 : 1;
                          if (baseMatches.length >= personNum) {
                            existingDoc = baseMatches[personNum - 1];
                          }
                        }
                      } else {
                        existingDoc = documents.find(d => d.type === docType.storageKey && isDocForCurrentRole(d));
                      }

                      return (
                        <div key={docType.storageKey} style={{
                          background: 'var(--bg-section)',
                          borderRadius: '8px',
                          padding: '16px',
                          border: existingDoc ? '2px solid #10B981' : '2px dashed var(--border-light)'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                            <div style={{ flex: 1 }}>
                              <h4 style={{ color: 'var(--text-main)', fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>
                                {docType.displayName}
                              </h4>
                              <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '8px' }}>
                                {docType.description}
                              </p>
                              {existingDoc && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <div style={{
                                    background: '#10B98120',
                                    color: '#10B981',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    display: 'inline-block'
                                  }}>
                                    ✓ Uploaded
                                  </div>
                                  {existingDoc.storageDocumentId && (
                                    <button
                                      onClick={() => window.location.href = `/oscar?docId=${existingDoc.storageDocumentId}&txId=${transaction.id}`}
                                      style={{
                                        background: '#0D9488',
                                        color: '#fff',
                                        padding: '4px 10px',
                                        borderRadius: '4px',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        border: 'none',
                                        cursor: 'pointer',
                                      }}
                                    >
                                      Ask Oscar
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                          <DocumentUpload
                            transactionId={transaction.id}
                            propertyId={(transaction as any).blockchainPropertyId || Number(transaction.propertyId) || 0}
                            documentType={docType.storageKey}
                            documentName={docType.displayName}
                            category={userRole === 'seller' ? 'seller' : 'buyer'}
                            required={true}
                            csrfToken={csrfToken}
                            onUpload={handleDocumentUpload}
                            onDelete={handleDeleteDocument}
                            existingDocument={existingDoc}
                          />
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Optional Documents Section */}
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ color: 'var(--text-main)', fontSize: '18px', marginBottom: '8px', fontWeight: 600 }}>Optional Documents</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '16px' }}>
                Additional documents that may be helpful for this transaction
              </p>

              <div style={{ display: 'grid', gap: '12px' }}>
                {[DOCUMENT_TYPES.SURVEY_REPORT, DOCUMENT_TYPES.LAND_REGISTRY_CONFIRMATION].map((docType) => {
                  const existingDoc = documents.find(d => d.type === docType.storageKey);

                  return (
                    <div key={docType.storageKey} style={{
                      background: 'var(--bg-section)',
                      borderRadius: '8px',
                      padding: '16px',
                      border: existingDoc ? '2px solid #10B981' : '2px dashed var(--border-light)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                        <div style={{ flex: 1 }}>
                          <h4 style={{ color: 'var(--text-main)', fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>
                            {docType.displayName}
                          </h4>
                          <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '8px' }}>
                            {docType.description}
                          </p>
                          {existingDoc && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{
                                background: '#10B98120',
                                color: '#10B981',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 600,
                                display: 'inline-block'
                              }}>
                                ✓ Uploaded
                              </div>
                              {existingDoc.storageDocumentId && (
                                <button
                                  onClick={() => window.location.href = `/oscar?docId=${existingDoc.storageDocumentId}&txId=${transaction.id}`}
                                  style={{
                                    background: '#0D9488',
                                    color: '#fff',
                                    padding: '4px 10px',
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    border: 'none',
                                    cursor: 'pointer',
                                  }}
                                >
                                  Ask Oscar
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <DocumentUpload
                        transactionId={transaction.id}
                        propertyId={(transaction as any).blockchainPropertyId || Number(transaction.propertyId) || 0}
                        documentType={docType.storageKey}
                        documentName={docType.displayName}
                        category="shared"
                        required={false}
                        csrfToken={csrfToken}
                        onUpload={handleDocumentUpload}
                        onDelete={handleDeleteDocument}
                        existingDocument={existingDoc}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Document List */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ color: 'var(--text-main)', fontSize: '16px', margin: 0 }}>Uploaded Documents ({documents.length})</h3>
              </div>

              {loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                  <div style={{ marginBottom: '12px' }}>⏳</div>
                  Loading documents...
                </div>
              ) : documents.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)', background: 'var(--bg-section)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '32px', marginBottom: '12px' }}>📄</div>
                  <p style={{ margin: '0 0 8px 0' }}>No documents uploaded yet</p>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                    Upload documents above to register their hash on the blockchain
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {documents.map(doc => (
                    <div key={doc.id} className="flex items-start gap-2 sm:gap-3" style={{
                      background: 'var(--bg-section)',
                      borderRadius: '8px',
                      padding: '12px',
                    }}>
                      <div className="hidden sm:flex shrink-0" style={{
                        width: '48px',
                        height: '48px',
                        background: doc.category === 'seller' ? '#7C3AED20' : doc.category === 'buyer' ? '#10B98120' : '#47556920',
                        borderRadius: '8px',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '20px'
                      }}>
                        {doc.mimeType?.includes('pdf') ? '📑' : doc.mimeType?.includes('image') ? '🖼️' : '📄'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="flex flex-wrap justify-between items-start gap-1 mb-1">
                          <h4 style={{ color: 'var(--text-main)', fontSize: '14px', margin: 0 }} className="break-words min-w-0">
                            {doc.name || doc.fileName}
                          </h4>
                          <span className="shrink-0" style={{
                            background: doc.status === 'verified' ? '#10B98120' : doc.status === 'uploaded' ? '#F59E0B20' : '#6B728020',
                            color: doc.status === 'verified' ? '#10B981' : doc.status === 'uploaded' ? '#F59E0B' : 'var(--text-secondary)',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: 600,
                            textTransform: 'uppercase'
                          }}>
                            {doc.status === 'verified' ? '✓ Verified' : doc.status === 'uploaded' ? 'Pending' : doc.status}
                          </span>
                        </div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: '0 0 8px 0' }}>
                          {doc.fileName}
                        </p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{
                            background: doc.category === 'seller' ? '#7C3AED20' : doc.category === 'buyer' ? '#10B98120' : '#6B728020',
                            color: doc.category === 'seller' ? '#A78BFA' : doc.category === 'buyer' ? '#34D399' : 'var(--text-secondary)',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            textTransform: 'capitalize'
                          }}>
                            {doc.category || 'shared'}
                          </span>
                          <span style={{
                            background: '#47556920',
                            color: 'var(--text-secondary)',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '11px'
                          }}>
                            {doc.type?.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Document'}
                          </span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                            {doc.fileSize ? `${(doc.fileSize / 1024).toFixed(1)} KB` : ''}
                          </span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                            {new Date(doc.uploadedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                        <div style={{ background: 'var(--bg-card)', padding: '10px', borderRadius: '6px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Blockchain Hash:</span>
                            <span style={{ color: 'var(--primary)', fontSize: '10px' }}>⛓️ On-chain</span>
                          </div>
                          <div style={{ color: 'var(--text-secondary)', fontSize: '11px', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                            {(doc as any).fileHash || 'Hash not available'}
                          </div>
                          <p style={{ color: 'var(--text-muted)', fontSize: '10px', margin: '6px 0 0 0' }}>
                            To verify: compare this hash with your locally stored file's SHA-256 hash
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* CHAIN TAB */}
        {activeTab === 'chain' && (
          <div>
            <h3 style={{ color: 'var(--text-main)', fontSize: '16px', marginBottom: '8px' }}>Property Chain</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '20px' }}>
              Track linked transactions in your property chain
            </p>

            {/* Current Transaction */}
            <div style={{ position: 'relative', paddingLeft: '30px' }}>
              {/* Vertical line */}
              <div style={{
                position: 'absolute',
                left: '10px',
                top: '20px',
                bottom: '20px',
                width: '2px',
                background: 'var(--border-light)'
              }} />

              {/* Chain items */}
              <div style={{ marginBottom: '24px' }}>
                <div style={{
                  position: 'absolute',
                  left: '4px',
                  width: '14px',
                  height: '14px',
                  background: 'var(--primary)',
                  borderRadius: '50%',
                  border: '2px solid var(--bg-card)'
                }} />
                <div style={{ background: 'var(--bg-section)', borderRadius: '8px', padding: '16px', borderLeft: '3px solid var(--primary)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                    <div>
                      <h4 style={{ color: 'var(--text-main)', fontSize: '14px', margin: 0 }}>
                        {transaction.propertyAddress}
                      </h4>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: '4px 0 0' }}>
                        Current Transaction • {transaction.transactionType || 'Sale'}
                      </p>
                    </div>
                    <span style={{
                      background: '#6366F120',
                      color: '#818CF8',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '11px'
                    }}>
                      Active
                    </span>
                  </div>
                  <div style={{ color: 'var(--text-main)', fontSize: '16px', fontWeight: 600 }}>
                    £{(transaction.amount || 0).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Placeholder for linked transactions */}
              <div style={{ marginBottom: '24px' }}>
                <div style={{
                  position: 'absolute',
                  left: '4px',
                  width: '14px',
                  height: '14px',
                  background: 'var(--border-light)',
                  borderRadius: '50%',
                  border: '2px solid var(--bg-card)'
                }} />
                <div style={{
                  background: 'var(--bg-section)',
                  borderRadius: '8px',
                  padding: '16px',
                  border: '2px dashed var(--border-light)',
                  textAlign: 'center'
                }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>
                    🔗 No linked transactions in chain
                  </p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: '8px 0 0' }}>
                    Invite buyers/sellers to link transactions
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ACTIVITY TAB - Blockchain Log */}
        {activeTab === 'activity' && (
          <div>
            <h3 style={{ color: 'var(--text-main)', fontSize: '16px', marginBottom: '8px' }}>Blockchain Activity</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '20px' }}>
              On-chain verification and audit trail
            </p>

            {blockchainActivity.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)', background: 'var(--bg-section)', borderRadius: '8px' }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>⛓️</div>
                No blockchain activity yet
                <p style={{ fontSize: '12px', marginTop: '8px', color: 'var(--text-muted)' }}>
                  Activity will appear when documents are registered on-chain
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {blockchainActivity.map((activity, index) => (
                  <div key={activity.id || index} style={{
                    background: 'var(--bg-section)',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}>
                    <div style={{
                      width: '8px',
                      height: '8px',
                      background: activity.action === 'REGISTER' ? '#10B981' : activity.action === 'VERIFY' ? '#6366F1' : '#F59E0B',
                      borderRadius: '50%',
                      flexShrink: 0
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                        <span style={{ color: 'var(--text-main)', fontSize: '13px' }}>
                          <strong>{activity.action}</strong> by {activity.actor}
                        </span>
                        <span className="shrink-0" style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                          {new Date(activity.timestamp).toLocaleDateString('en-GB')} {new Date(activity.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      {activity.hash && (
                        <div style={{ marginTop: '4px' }}>
                          <span style={{
                            background: 'var(--bg-card)',
                            color: 'var(--primary)',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontFamily: 'monospace'
                          }}>
                            ⛓️ {activity.hash}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TA6 TAB - Property Information Form */}
        {activeTab === 'ta6' && (
          <div>
            {!isSeller && (
              <div style={{
                background: '#6366F115',
                border: '1px solid #6366F140',
                borderRadius: '8px',
                padding: '12px 16px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <span style={{ fontSize: '16px' }}>👁️</span>
                <div>
                  <p style={{ color: 'var(--text-main)', fontSize: '13px', fontWeight: 600, margin: 0 }}>Read-only view</p>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: 0 }}>This form is completed by the seller. Review the property information they have declared.</p>
                </div>
              </div>
            )}
            <TA6Form
              transactionId={transaction.id?.toString() || ''}
              postcode={(transaction as unknown as { postcode?: string }).postcode ?? null}
              initialData={(() => {
                // Try to load from localStorage first, fall back to transaction data
                const stored = localStorage.getItem(`ta6_${transaction.id}`);
                if (stored) {
                  try { return JSON.parse(stored) as TA6PropertyInformation; } catch { /* ignore */ }
                }
                return transaction.ta6Data as TA6PropertyInformation | undefined;
              })()}
              onSave={async (data) => {
                try {
                  await icpService.updateTA6(transaction.id?.toString() || '', data);
                  logger.info('TA6 data saved to canister');
                  void recordOnBehalf(transaction.id?.toString() || '', 'seller', 'fill_pack_form', 'ta6');
                } catch (canisterErr) {
                  logger.error('TA6 canister save failed, falling back to localStorage:', canisterErr);
                  localStorage.setItem(`ta6_${transaction.id}`, JSON.stringify(data));
                }
                // Show toast with debounce (max once every 5 seconds)
                const now = Date.now();
                if (now - lastToastTime.current > 5000) {
                  lastToastTime.current = now;
                  toast({
                    title: 'TA6 Form Saved',
                    description: 'Your property information has been saved.',
                  });
                }
              }}
              readOnly={currentUserRole !== 'seller'} // Only seller can edit
              hasAcknowledged={ta6Acknowledged}
              onAcknowledge={handleAcknowledgeTA6}
              uploadFile={ta6Uploader}
            />
          </div>
        )}

        {/* TA10 TAB - Fittings & Contents Form */}
        {activeTab === 'ta10' && (
          <div>
            {!isSeller && (
              <div style={{
                background: '#6366F115',
                border: '1px solid #6366F140',
                borderRadius: '8px',
                padding: '12px 16px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <span style={{ fontSize: '16px' }}>👁️</span>
                <div>
                  <p style={{ color: 'var(--text-main)', fontSize: '13px', fontWeight: 600, margin: 0 }}>Read-only view</p>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: 0 }}>Review what the seller has included in the sale - fixtures, fittings, and contents.</p>
                </div>
              </div>
            )}
            <TA10Form
              transactionId={transaction.id?.toString() || ''}
              initialData={(() => {
                // Try to load from localStorage first, fall back to transaction data
                const stored = localStorage.getItem(`ta10_${transaction.id}`);
                if (stored) {
                  try { return JSON.parse(stored) as TA10FittingsAndContents; } catch { /* ignore */ }
                }
                return transaction.ta10Data as TA10FittingsAndContents | undefined;
              })()}
              onSave={async (data) => {
                try {
                  await icpService.updateTA10(transaction.id?.toString() || '', data);
                  logger.info('TA10 data saved to canister');
                  void recordOnBehalf(transaction.id?.toString() || '', 'seller', 'fill_pack_form', 'ta10');
                } catch (canisterErr) {
                  logger.error('TA10 canister save failed, falling back to localStorage:', canisterErr);
                  localStorage.setItem(`ta10_${transaction.id}`, JSON.stringify(data));
                }
                // Show toast with debounce (max once every 5 seconds)
                const now = Date.now();
                if (now - lastToastTime.current > 5000) {
                  lastToastTime.current = now;
                  toast({
                    title: 'TA10 Form Saved',
                    description: 'Your fittings & contents form has been saved.',
                  });
                }
              }}
              readOnly={currentUserRole !== 'seller'} // Only seller can edit
            />
          </div>
        )}

        {/* LEGAL TAB - Solicitor profiles, restricted tasks, fee summary */}
        {activeTab === 'legal' && (
          <LegalTab
            buyerSolicitor={(transaction as unknown as Record<string, unknown>)['buyerSolicitor'] as SolicitorRecord ?? null}
            sellerSolicitor={(transaction as unknown as Record<string, unknown>)['sellerSolicitor'] as SolicitorRecord ?? null}
          />
        )}

        {/* TA7 TAB - Leasehold Information Form (only for leasehold properties) */}
        {activeTab === 'ta7' && transaction.propertyType === 'leasehold' && (
          <div>
            <TA7Form
              transactionId={transaction.id?.toString() || ''}
              postcode={(transaction as unknown as { postcode?: string }).postcode ?? null}
              initialData={(() => {
                // Try to load from localStorage first, fall back to transaction data
                const stored = localStorage.getItem(`ta7_${transaction.id}`);
                if (stored) {
                  try { return JSON.parse(stored) as TA7LeaseholdInformation; } catch { /* ignore */ }
                }
                return transaction.ta7Data as TA7LeaseholdInformation | undefined;
              })()}
              onSave={async (data) => {
                try {
                  await icpService.updateTA7(transaction.id?.toString() || '', data);
                  logger.info('TA7 data saved to canister');
                  void recordOnBehalf(transaction.id?.toString() || '', 'seller', 'fill_pack_form', 'ta7');
                } catch (canisterErr) {
                  logger.error('TA7 canister save failed, falling back to localStorage:', canisterErr);
                  localStorage.setItem(`ta7_${transaction.id}`, JSON.stringify(data));
                }
                // Show toast with debounce (max once every 5 seconds)
                const now = Date.now();
                if (now - lastToastTime.current > 5000) {
                  lastToastTime.current = now;
                  toast({
                    title: 'TA7 Form Saved',
                    description: 'Your leasehold information has been saved.',
                  });
                }
              }}
              readOnly={currentUserRole !== 'seller'} // Only seller can edit
              isLeasehold={transaction.propertyType === 'leasehold'}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default TransactionDetailTabs;
