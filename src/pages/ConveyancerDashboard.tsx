/**
 * ConveyancerDashboard - Portal for conveyancers to manage transactions
 * Opened from the shared dashboard as /conveyancer?tx=<id>. Two views: the
 * matter detail, and the on-chain profile registration a new firm sees first.
 * Joining and listing transactions live on the shared dashboard.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AppTopBar from '@/components/navigation/AppTopBar';
import DocumentDetailModal from '../components/conveyancer/DocumentDetailModal';
import { SharedWithYouSection } from '../components/conveyancer/SharedWithYouSection';
import { ConveyancerEnquiriesSection } from '../components/conveyancer/ConveyancerEnquiriesSection';
import { ConveyancerBuyerPackSection } from '../components/conveyancer/ConveyancerBuyerPackSection';
import TR1Form from '../components/conveyancer/TR1Form';
import AP1Form from '../components/conveyancer/AP1Form';
import { StallLine } from '../components/transaction/flow/StallLine';
import { icpService } from '../services/icp.service';
import { logger } from '@/utils/logger';
import { isWaitingForOtherSide } from '@/utils/twoSidedSteps';
import { useAuthStore } from '../stores/authStore';
import { TRANSACTION_STATUS_LABEL, isTransactionStatus, type TransactionStatus } from '@/types/transactionStatus';

interface ConveyancerTransaction {
  id: string;
  propertyAddress: string;
  buyer: string;
  seller: string;
  status: string;
  amount: number;
  createdAt: string | number;
}

interface TransactionDocument {
  id: string;
  docType: string;
  fileName: string;
  fileHash: string;
  uploadedAt: string;
  verified: boolean;
}

interface ConveyancerDoc {
  storageDocId: number;
  docType: string;
  fileName: string;
  hash: string;
  createdAt: string;
}

type ViewState = 'detail' | 'register';

/** Extract a Candid variant's key (e.g. { active: null } -> 'active'); pass strings through unchanged. */
function variantToKey(value: unknown): string {
  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)[0] || '';
  }
  return String(value ?? '');
}

/** Load conveyancer's own documents for a transaction */
function getConveyancerDocs(txId: string): ConveyancerDoc[] {
  try {
    return JSON.parse(localStorage.getItem(`conveyancer_docs_${txId}`) || '[]');
  } catch {
    return [];
  }
}

const REQUIRED_DOCS = [
  { docType: 'tr1_transfer', label: 'TR1 Transfer Deed', canGenerate: true, phase: 'pre-exchange' },
  { docType: 'signed_contract', label: 'Signed Contract', canGenerate: false, phase: 'pre-exchange' },
  { docType: 'ap1_application', label: 'AP1 Application', canGenerate: true, phase: 'post-exchange' },
  { docType: 'completion_statement', label: 'Completion Statement', canGenerate: false, phase: 'post-exchange' },
] as const;

const ConveyancerDashboard: React.FC = () => {
  const navigate = useNavigate();
  // A matter is opened from the shared dashboard as /conveyancer?tx=<id>. There
  // is no list here any more: the shared dashboard is the only transaction list.
  const [searchParams] = useSearchParams();
  const txId = searchParams.get('tx');
  const [viewState, setViewState] = useState<ViewState>('detail');
  const [selectedTx, setSelectedTx] = useState<ConveyancerTransaction | null>(null);
  const [documents, setDocuments] = useState<TransactionDocument[]>([]);
  const [conveyancerDocs, setConveyancerDocs] = useState<ConveyancerDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [isRegistered, setIsRegistered] = useState(true);

  // Modal state
  const [selectedDoc, setSelectedDoc] = useState<TransactionDocument | null>(null);
  const [showTR1Form, setShowTR1Form] = useState(false);
  const [showAP1Form, setShowAP1Form] = useState(false);

  // File upload ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadDocType, setUploadDocType] = useState<string>('');
  const [uploadLoading, setUploadLoading] = useState(false);

  // Registration form state
  const [regForm, setRegForm] = useState({
    fullName: '',
    regNumber: '',
    email: '',
    piiConfirmed: false,
  });
  const [regError, setRegError] = useState<string | null>(null);
  const [regSubmitting, setRegSubmitting] = useState(false);

  const loadTransaction = useCallback(async (id: string): Promise<ConveyancerTransaction | null> => {
    try {
      const tx = await icpService.getTransaction(id);
      if (!tx) return null;
      return {
        id: String(tx.id),
        propertyAddress: String(tx.propertyAddress || ''),
        buyer: String(tx.buyer || ''),
        seller: String(tx.seller || ''),
        status: variantToKey(tx.status),
        amount: Number(tx.amount || 0),
        createdAt: Number(tx.createdAt),
      };
    } catch (error) {
      logger.error(`Failed to fetch transaction ${id}:`, error);
      return null;
    }
  }, []);

  const loadDocuments = useCallback(async (docTxId: string): Promise<void> => {
    try {
      const docs = await icpService.getDocumentsByTransaction(docTxId);
      setDocuments(docs.map((d: Record<string, unknown>) => ({
        id: String(d.storageDocumentId || d.id || ''),
        docType: String(d.docType || d.type || ''),
        fileName: String(d.fileName || d.name || ''),
        fileHash: String(d.hash || d.fileHash || ''),
        uploadedAt: String(d.uploadedAt || ''),
        verified: Boolean(d.verified),
      })));
    } catch (error) {
      logger.error('Failed to load documents:', error);
      setDocuments([]);
    }
  }, []);

  /** Open the matter named in ?tx=; no matter named (or not found) -> back to the dashboard. */
  const openMatter = useCallback(async (): Promise<void> => {
    if (!txId) {
      navigate('/dashboard', { replace: true });
      return;
    }
    const tx = await loadTransaction(txId);
    if (!tx) {
      navigate('/dashboard', { replace: true });
      return;
    }
    setSelectedTx(tx);
    setViewState('detail');
    setConveyancerDocs(getConveyancerDocs(tx.id));
    await loadDocuments(tx.id);
  }, [txId, navigate, loadTransaction, loadDocuments]);

  useEffect(() => {
    const init = async (): Promise<void> => {
      const authState = useAuthStore.getState();
      if (!authState.principalId || !authState.isAuthenticated) {
        navigate('/login');
        return;
      }

      try {
        await icpService.initialize();
        const profile = await icpService.getMyProfile();

        const userType = !profile
          ? ''
          : typeof profile.userType === 'object'
            ? Object.keys(profile.userType)[0] || ''
            : String(profile.userType || '');

        if (!userType.toLowerCase().includes('conveyancer')) {
          setIsRegistered(false);
          setViewState('register');
          return;
        }

        await openMatter();
      } catch (error) {
        logger.error('ConveyancerDashboard init error:', error);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [navigate, openMatter]);

  const handleAction = async (action: 'tr1' | 'exchange' | 'ap1'): Promise<void> => {
    if (!selectedTx) return;

    if (action === 'tr1') {
      setShowTR1Form(true);
      return;
    }
    if (action === 'ap1') {
      setShowAP1Form(true);
      return;
    }

    setActionLoading(action);
    try {
      if (action === 'exchange') {
        const principal = useAuthStore.getState().principalId || '';
        // Signs this conveyancer's own side only: exchange happens once the
        // other side has signed too (security scan H6), so say which it was.
        const result = await icpService.recordContractExchange(selectedTx.id, principal, principal);
        if (!result.success || isWaitingForOtherSide(result.message)) alert(result.message);
      }
      const fresh = await loadTransaction(selectedTx.id);
      if (fresh) setSelectedTx(fresh);
      await loadDocuments(selectedTx.id);
    } catch (error) {
      logger.error(`Action ${action} failed:`, error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleFormComplete = async (): Promise<void> => {
    setShowTR1Form(false);
    setShowAP1Form(false);
    if (selectedTx) {
      setConveyancerDocs(getConveyancerDocs(selectedTx.id));
      await loadDocuments(selectedTx.id);
    }
  };

  const handleUploadDoc = (docType: string): void => {
    setUploadDocType(docType);
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    if (!file || !selectedTx || !uploadDocType) return;

    setUploadLoading(true);
    try {
      const result = await icpService.registerDocumentProof(
        file, 0, uploadDocType, 'onchain', selectedTx.id,
      );

      const localDocs = getConveyancerDocs(selectedTx.id);
      localDocs.push({
        storageDocId: result.storageDocumentId,
        docType: uploadDocType,
        fileName: file.name,
        hash: result.documentHash,
        createdAt: new Date().toISOString(),
      });
      localStorage.setItem(`conveyancer_docs_${selectedTx.id}`, JSON.stringify(localDocs));
      setConveyancerDocs(localDocs);
      await loadDocuments(selectedTx.id);
    } catch (error) {
      logger.error('Document upload failed:', error);
    } finally {
      setUploadLoading(false);
      setUploadDocType('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRegister = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setRegError(null);

    if (!regForm.fullName || !regForm.regNumber || !regForm.email) {
      setRegError('Please complete all fields');
      return;
    }
    if (!regForm.piiConfirmed) {
      setRegError('Please confirm your PII insurance');
      return;
    }

    setRegSubmitting(true);
    try {
      await icpService.initAuth();
      await icpService.registerUser({
        name: regForm.fullName,
        email: regForm.email,
        mobile: '',
        userType: 'conveyancer_transparent',
      });
      setIsRegistered(true);
      await openMatter();
    } catch (error) {
      setRegError(error instanceof Error ? error.message : 'Registration failed');
    } finally {
      setRegSubmitting(false);
    }
  };

  const getStatusLabel = (status: string): string =>
    isTransactionStatus(status) ? TRANSACTION_STATUS_LABEL[status] : status;

  const getMilestoneLabel = (status: string): string => {
    const milestones: Partial<Record<TransactionStatus, string>> = {
      active: 'Awaiting documents',
      exchanged: 'Awaiting completion',
      completion_initiated: 'Awaiting AP1 submission',
    };
    return (isTransactionStatus(status) && milestones[status]) || 'Review needed';
  };

  const hasConveyancerDoc = (docType: string): boolean => {
    return conveyancerDocs.some((d) => d.docType === docType);
  };

  const isExchanged = selectedTx
    ? ['exchanged', 'exchange', 'completion_initiated', 'blockchain_completed', 'completed'].includes(selectedTx.status)
    : false;

  if (loading) {
    return (
      <div className="min-h-screen">
        <AppTopBar title="Conveyancer portal" />
        <div className="flex min-h-[60vh] items-center justify-center bg-[#FAFAF8] dark:bg-stone-900">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#E5E7EB] border-t-[#0D9488]" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <AppTopBar title="Conveyancer portal" />

      <main className="min-h-screen bg-[#FAFAF8] dark:bg-stone-900 px-6 py-10 sm:px-10 lg:px-14">
        {/* Hidden file input for conveyancer uploads */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileSelected}
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
        />

        {/* Registration Form */}
        {viewState === 'register' && !isRegistered && (
          <RegistrationView
            regForm={regForm}
            setRegForm={setRegForm}
            regError={regError}
            regSubmitting={regSubmitting}
            onSubmit={handleRegister}
          />
        )}

        {/* Transaction Detail */}
        {viewState === 'detail' && selectedTx && (
          <TransactionDetailView
            tx={selectedTx}
            documents={documents}
            conveyancerDocs={conveyancerDocs}
            actionLoading={actionLoading}
            uploadLoading={uploadLoading}
            isExchanged={isExchanged}
            hasConveyancerDoc={hasConveyancerDoc}
            getStatusLabel={getStatusLabel}
            getMilestoneLabel={getMilestoneLabel}
            onBack={() => navigate('/dashboard')}
            onDocClick={setSelectedDoc}
            onAction={handleAction}
            onUpload={handleUploadDoc}
          />
        )}
      </main>

      {/* Document Detail Modal */}
      {selectedDoc && (
        <DocumentDetailModal
          isOpen={!!selectedDoc}
          onClose={() => setSelectedDoc(null)}
          document={selectedDoc}
          sellerEmail=""
          propertyAddress={selectedTx?.propertyAddress}
        />
      )}

      {/* TR1 Form Modal */}
      {showTR1Form && selectedTx && (
        <TR1Form
          isOpen={showTR1Form}
          onClose={() => setShowTR1Form(false)}
          onComplete={() => handleFormComplete()}
          transaction={selectedTx}
        />
      )}

      {/* AP1 Form Modal */}
      {showAP1Form && selectedTx && (
        <AP1Form
          isOpen={showAP1Form}
          onClose={() => setShowAP1Form(false)}
          onComplete={() => handleFormComplete()}
          transaction={selectedTx}
        />
      )}
    </div>
  );
};

/* ─── Sub-views extracted for readability ─── */

interface RegistrationViewProps {
  regForm: { fullName: string; regNumber: string; email: string; piiConfirmed: boolean };
  setRegForm: React.Dispatch<React.SetStateAction<{ fullName: string; regNumber: string; email: string; piiConfirmed: boolean }>>;
  regError: string | null;
  regSubmitting: boolean;
  onSubmit: (e: React.FormEvent) => Promise<void>;
}
const RegistrationView: React.FC<RegistrationViewProps> = ({ regForm, setRegForm, regError, regSubmitting, onSubmit }) => (
  <div className="mx-auto max-w-xl">
    <h1 className="font-[Fraunces] text-[2rem] font-semibold leading-tight tracking-tight text-[#1A1A1A] dark:text-stone-100 sm:text-[2.5rem]">
      Finish your panel application.
    </h1>
    <p className="mt-3 max-w-md font-[DM_Sans] text-base text-[#6B7280] dark:text-stone-400">
      One last step before you can pick up transactions.
    </p>

    <form onSubmit={onSubmit} className="mt-10 space-y-6">
      <div>
        <label htmlFor="conv-reg-name" className="block font-[DM_Sans] text-sm font-medium text-[#1A1A1A] dark:text-stone-200">
          Full name
        </label>
        <input
          id="conv-reg-name"
          type="text"
          value={regForm.fullName}
          onChange={(e) => setRegForm((p) => ({ ...p, fullName: e.target.value }))}
          autoComplete="name"
          placeholder="Enter your full name"
          className="mt-2 w-full rounded-md border border-[#E5E7EB] bg-white px-4 py-3 font-[DM_Sans] text-base text-[#1A1A1A] focus:border-[#0D9488] focus:outline-none focus:ring-1 focus:ring-[#0D9488] dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
        />
      </div>
      <div>
        <label htmlFor="conv-reg-number" className="block font-[DM_Sans] text-sm font-medium text-[#1A1A1A] dark:text-stone-200">
          CLC or SRA number
        </label>
        <input
          id="conv-reg-number"
          type="text"
          value={regForm.regNumber}
          onChange={(e) => setRegForm((p) => ({ ...p, regNumber: e.target.value }))}
          placeholder="CLC12345 or SRA678910"
          className="mt-2 w-full rounded-md border border-[#E5E7EB] bg-white px-4 py-3 font-[DM_Sans] text-base text-[#1A1A1A] focus:border-[#0D9488] focus:outline-none focus:ring-1 focus:ring-[#0D9488] dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
        />
      </div>
      <div>
        <label htmlFor="conv-reg-email" className="block font-[DM_Sans] text-sm font-medium text-[#1A1A1A] dark:text-stone-200">
          Email
        </label>
        <input
          id="conv-reg-email"
          type="email"
          value={regForm.email}
          onChange={(e) => setRegForm((p) => ({ ...p, email: e.target.value }))}
          autoComplete="email"
          placeholder="you@firm.co.uk"
          className="mt-2 w-full rounded-md border border-[#E5E7EB] bg-white px-4 py-3 font-[DM_Sans] text-base text-[#1A1A1A] focus:border-[#0D9488] focus:outline-none focus:ring-1 focus:ring-[#0D9488] dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
        />
      </div>
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={regForm.piiConfirmed}
          onChange={(e) => setRegForm((p) => ({ ...p, piiConfirmed: e.target.checked }))}
          className="mt-0.5 h-4 w-4 rounded border-[#E5E7EB] text-[#0D9488] focus:ring-[#0D9488]"
        />
        <span className="font-[DM_Sans] text-sm text-[#1A1A1A] dark:text-stone-200">
          I confirm I hold valid Professional Indemnity Insurance.
        </span>
      </label>
      {regError && (
        <div className="rounded-md border border-[#DC2626]/30 bg-[#FEF2F2] p-3 font-[DM_Sans] text-sm text-[#DC2626]">
          {regError}
        </div>
      )}
      <button
        type="submit"
        disabled={regSubmitting}
        className="inline-flex min-h-12 w-full items-center justify-center rounded-md bg-[#0D9488] px-8 py-3 font-[DM_Sans] text-base font-medium text-white transition-colors hover:bg-[#0F766E] disabled:cursor-not-allowed disabled:bg-[#9CA3AF]"
      >
        {regSubmitting ? 'Registering…' : 'Register as Conveyancer'}
      </button>
    </form>
  </div>
);

interface TransactionDetailViewProps {
  tx: ConveyancerTransaction;
  documents: TransactionDocument[];
  conveyancerDocs: ConveyancerDoc[];
  actionLoading: string | null;
  uploadLoading: boolean;
  isExchanged: boolean;
  hasConveyancerDoc: (docType: string) => boolean;
  getStatusLabel: (s: string) => string;
  getMilestoneLabel: (s: string) => string;
  onBack: () => void;
  onDocClick: (doc: TransactionDocument) => void;
  onAction: (action: 'tr1' | 'exchange' | 'ap1') => void;
  onUpload: (docType: string) => void;
}
const TransactionDetailView: React.FC<TransactionDetailViewProps> = ({
  tx, documents, conveyancerDocs, actionLoading, uploadLoading, isExchanged,
  hasConveyancerDoc, getStatusLabel,
  onBack, onDocClick, onAction, onUpload,
}) => {
  const hasTR1 = hasConveyancerDoc('tr1_transfer');
  const hasAP1 = hasConveyancerDoc('ap1_application');
  // Exchange is confirmed while the deal is still pre-exchange on chain. This
  // was gated on a 'contract-prep' status that never existed, so the button
  // could never enable.
  const canConfirmExchange = tx.status === 'active';

  return (
    <div className="mx-auto max-w-6xl">
      <button
        onClick={onBack}
        className="mb-6 inline-flex items-center gap-1 font-[DM_Sans] text-sm text-[#6B7280] transition-colors hover:text-[#1A1A1A] dark:hover:text-stone-200"
      >
        &larr; My transactions
      </button>

      <div className="mb-10 flex items-end justify-between gap-6">
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-[Fraunces] text-[2rem] font-semibold leading-tight tracking-tight text-[#1A1A1A] dark:text-stone-100 sm:text-[2.5rem]">
            {tx.propertyAddress}
          </h1>
          <p className="mt-2 font-[DM_Sans] text-base text-[#6B7280] dark:text-stone-400">
            £{tx.amount.toLocaleString()}
          </p>
        </div>
        <span className="flex-shrink-0 rounded-full border border-[#0D9488]/30 bg-[#CCFBF1]/30 px-4 py-1.5 font-[DM_Sans] text-sm font-medium text-[#0F766E]">
          {getStatusLabel(tx.status)}
        </span>
      </div>

      {/* Who this matter is waiting on, and the stage against the benchmark. */}
      <StallLine transactionId={tx.id} className="mb-6" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Left Column — 3 of 5 */}
        <div className="space-y-6 lg:col-span-3">
          {/* Property Details */}
          <section className="rounded-md border border-[#E5E7EB] bg-white p-6 dark:border-stone-700 dark:bg-stone-800">
            <h2 className="font-[Fraunces] text-lg font-semibold text-[#1A1A1A] dark:text-stone-100">Property</h2>
            <dl className="mt-4 space-y-3 font-[DM_Sans] text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-[#6B7280]">Address</dt>
                <dd className="max-w-[60%] text-right font-medium text-[#1A1A1A] dark:text-stone-100">{tx.propertyAddress}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[#6B7280]">Sale price</dt>
                <dd className="font-medium text-[#1A1A1A] dark:text-stone-100">£{tx.amount.toLocaleString()}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[#6B7280]">Seller</dt>
                <dd className="max-w-[60%] truncate text-right font-medium text-[#1A1A1A] dark:text-stone-100">{tx.seller}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[#6B7280]">Buyer</dt>
                <dd className="max-w-[60%] truncate text-right font-medium text-[#1A1A1A] dark:text-stone-100">{tx.buyer}</dd>
              </div>
            </dl>
          </section>

          {/* Seller Documents */}
          <section className="rounded-md border border-[#E5E7EB] bg-white p-6 dark:border-stone-700 dark:bg-stone-800">
            <div className="flex items-baseline justify-between">
              <h2 className="font-[Fraunces] text-lg font-semibold text-[#1A1A1A] dark:text-stone-100">From the seller</h2>
              <span className="font-[DM_Sans] text-sm text-[#6B7280]">{documents.length}</span>
            </div>
            {documents.length === 0 ? (
              <p className="mt-3 font-[DM_Sans] text-sm text-[#6B7280]">Waiting for the seller to upload documents.</p>
            ) : (
              <ul className="mt-4 divide-y divide-[#E5E7EB] dark:divide-stone-700">
                {documents.map((doc) => (
                  <li key={doc.id}>
                    <button
                      onClick={() => onDocClick(doc)}
                      className="group flex w-full items-center justify-between gap-3 py-3 text-left transition-colors hover:bg-[#FAFAF8] dark:hover:bg-stone-900"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-[DM_Sans] text-sm font-medium text-[#1A1A1A] dark:text-stone-100">
                          {doc.fileName || doc.docType}
                        </p>
                        <p className="mt-0.5 font-[DM_Sans] text-xs text-[#6B7280]">
                          {doc.docType}
                          {doc.verified && <span className="ml-2 text-[#5F8A68]">Verified</span>}
                        </p>
                      </div>
                      <span className="flex-shrink-0 text-[#9CA3AF] transition-colors group-hover:text-[#0D9488]">→</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Documents shared with this conveyancer (share-wallet-docs Phase 3) */}
          <SharedWithYouSection transactionId={tx.id} />

          {/* Pre-contract enquiries — same tab as the transaction workspace */}
          <ConveyancerEnquiriesSection transactionId={tx.id} />

          {/* From the buyer: the Buyer Pack status (spec 2026-09-05); shared documents are in Shared with you above */}
          <ConveyancerBuyerPackSection transactionId={tx.id} />

          {/* Conveyancer's Documents */}
          <section className="rounded-md border border-[#E5E7EB] bg-white p-6 dark:border-stone-700 dark:bg-stone-800">
            <h2 className="font-[Fraunces] text-lg font-semibold text-[#1A1A1A] dark:text-stone-100">Your documents</h2>
            <ul className="mt-4 space-y-2.5">
              {REQUIRED_DOCS.map((reqDoc) => {
                const isUploaded = hasConveyancerDoc(reqDoc.docType);
                const uploadedDoc = conveyancerDocs.find((d) => d.docType === reqDoc.docType);

                return (
                  <li key={reqDoc.docType} className="flex items-center justify-between gap-3 rounded-md border border-[#E5E7EB] px-4 py-3 dark:border-stone-700">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <span className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs ${isUploaded ? 'bg-[#5F8A68]/15 text-[#5F8A68]' : 'border border-[#E5E7EB] text-[#9CA3AF] dark:border-stone-600'}`}>
                        {isUploaded ? '\u2713' : ''}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-[DM_Sans] text-sm font-medium text-[#1A1A1A] dark:text-stone-100">{reqDoc.label}</p>
                        {isUploaded && uploadedDoc && (
                          <p className="truncate font-[DM_Sans] text-xs text-[#5F8A68]">{uploadedDoc.fileName}</p>
                        )}
                        {!isUploaded && (
                          <p className="font-[DM_Sans] text-xs text-[#6B7280]">{reqDoc.phase === 'pre-exchange' ? 'Before exchange' : 'After exchange'}</p>
                        )}
                      </div>
                    </div>
                    {!isUploaded && (
                      <div className="flex flex-shrink-0 gap-2">
                        {reqDoc.canGenerate && (
                          <button
                            onClick={() => onAction(reqDoc.docType === 'tr1_transfer' ? 'tr1' : 'ap1')}
                            className="rounded-md bg-[#0D9488] px-3 py-1.5 font-[DM_Sans] text-xs font-medium text-white transition-colors hover:bg-[#0F766E]"
                          >
                            Generate
                          </button>
                        )}
                        <button
                          onClick={() => onUpload(reqDoc.docType)}
                          disabled={uploadLoading}
                          className="rounded-md border border-[#E5E7EB] px-3 py-1.5 font-[DM_Sans] text-xs font-medium text-[#1A1A1A] transition-colors hover:bg-[#FAFAF8] disabled:opacity-40 dark:border-stone-700 dark:text-stone-100 dark:hover:bg-stone-900"
                        >
                          Upload
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        {/* Right Column — 2 of 5, sticky workflow */}
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-md border border-[#E5E7EB] bg-white p-6 lg:sticky lg:top-6 dark:border-stone-700 dark:bg-stone-800">
            <h2 className="font-[Fraunces] text-lg font-semibold text-[#1A1A1A] dark:text-stone-100">Workflow</h2>
            <p className="mt-1 font-[DM_Sans] text-sm text-[#6B7280]">
              Five steps from receipt to registration.
            </p>
            <ol className="mt-6 space-y-5">
              {/* Step 1 */}
              <WorkflowStep
                number={1}
                title="Review seller documents"
                description={documents.length > 0 ? `${documents.length} document${documents.length !== 1 ? 's' : ''} ready to review` : 'Waiting for seller upload'}
                isComplete={documents.length > 0}
                isActive={documents.length === 0}
              />

              {/* Step 2 */}
              <WorkflowStep
                number={2}
                title="Prepare TR1 transfer deed"
                description={hasTR1 ? 'Generated and registered on-chain' : 'Generate or upload the TR1 form'}
                isComplete={hasTR1}
                isActive={!hasTR1 && documents.length > 0}
              >
                {!hasTR1 && (
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => onAction('tr1')}
                      className="rounded-md bg-[#0D9488] px-3 py-1.5 font-[DM_Sans] text-xs font-medium text-white transition-colors hover:bg-[#0F766E]"
                    >
                      Generate TR1
                    </button>
                    <button
                      onClick={() => onUpload('tr1_transfer')}
                      className="rounded-md border border-[#E5E7EB] px-3 py-1.5 font-[DM_Sans] text-xs font-medium text-[#1A1A1A] transition-colors hover:bg-[#FAFAF8] dark:border-stone-700 dark:text-stone-100 dark:hover:bg-stone-900"
                    >
                      Upload
                    </button>
                  </div>
                )}
              </WorkflowStep>

              {/* Step 3 */}
              <WorkflowStep
                number={3}
                title="Confirm exchange"
                description={isExchanged ? 'Contracts exchanged' : 'Needs TR1 and deposit confirmation'}
                isComplete={isExchanged}
                isActive={hasTR1 && !isExchanged}
              >
                {!isExchanged && (
                  <button
                    onClick={() => onAction('exchange')}
                    disabled={!hasTR1 || !canConfirmExchange || actionLoading === 'exchange'}
                    className="mt-3 rounded-md bg-[#0D9488] px-3 py-1.5 font-[DM_Sans] text-xs font-medium text-white transition-colors hover:bg-[#0F766E] disabled:cursor-not-allowed disabled:bg-[#9CA3AF]"
                  >
                    {actionLoading === 'exchange' ? 'Processing…' : 'Confirm exchange'}
                  </button>
                )}
              </WorkflowStep>

              {/* Step 4 */}
              <WorkflowStep
                number={4}
                title="Prepare AP1 application"
                description={hasAP1 ? 'Generated and registered on-chain' : 'Generate or upload the AP1 form'}
                isComplete={hasAP1}
                isActive={isExchanged && !hasAP1}
              >
                {!hasAP1 && isExchanged && (
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => onAction('ap1')}
                      className="rounded-md bg-[#0D9488] px-3 py-1.5 font-[DM_Sans] text-xs font-medium text-white transition-colors hover:bg-[#0F766E]"
                    >
                      Generate AP1
                    </button>
                    <button
                      onClick={() => onUpload('ap1_application')}
                      className="rounded-md border border-[#E5E7EB] px-3 py-1.5 font-[DM_Sans] text-xs font-medium text-[#1A1A1A] transition-colors hover:bg-[#FAFAF8] dark:border-stone-700 dark:text-stone-100 dark:hover:bg-stone-900"
                    >
                      Upload
                    </button>
                  </div>
                )}
              </WorkflowStep>

              {/* Step 5 */}
              <WorkflowStep
                number={5}
                title="Submit to HMLR"
                description={hasAP1 && isExchanged ? 'Ready for Land Registry submission' : 'Needs exchange and AP1'}
                isComplete={false}
                isActive={hasAP1 && isExchanged}
              >
                <button
                  disabled={!hasAP1 || !isExchanged}
                  className="mt-3 rounded-md bg-[#0D9488] px-3 py-1.5 font-[DM_Sans] text-xs font-medium text-white transition-colors hover:bg-[#0F766E] disabled:cursor-not-allowed disabled:bg-[#9CA3AF]"
                >
                  Submit AP1
                </button>
              </WorkflowStep>
            </ol>
          </section>

          {/* Audit Log */}
          <section className="rounded-md border border-[#E5E7EB] bg-white p-6 dark:border-stone-700 dark:bg-stone-800">
            <h2 className="font-[Fraunces] text-lg font-semibold text-[#1A1A1A] dark:text-stone-100">Audit log</h2>
            <p className="mt-2 font-[DM_Sans] text-sm text-[#6B7280]">
              Ledger entries for this transaction will appear here as you act.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

interface WorkflowStepProps {
  number: number;
  title: string;
  description: string;
  isComplete: boolean;
  isActive: boolean;
  children?: React.ReactNode;
}
const WorkflowStep: React.FC<WorkflowStepProps> = ({ number, title, description, isComplete, isActive, children }) => (
  <li className={`flex gap-3 ${!isActive && !isComplete ? 'opacity-60' : ''}`}>
    <span
      className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full font-[DM_Sans] text-xs font-medium ${
        isComplete
          ? 'bg-[#5F8A68] text-white'
          : isActive
            ? 'bg-[#0D9488] text-white'
            : 'border border-[#E5E7EB] text-[#9CA3AF] dark:border-stone-600'
      }`}
    >
      {isComplete ? '\u2713' : number}
    </span>
    <div className="min-w-0 flex-1 pt-0.5">
      <p className={`font-[DM_Sans] text-sm font-medium ${isActive ? 'text-[#1A1A1A] dark:text-stone-100' : 'text-[#1A1A1A] dark:text-stone-200'}`}>
        {title}
      </p>
      <p className="mt-0.5 font-[DM_Sans] text-xs text-[#6B7280]">{description}</p>
      {children}
    </div>
  </li>
);

export default ConveyancerDashboard;
