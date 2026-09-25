/**
 * ConveyancerDashboard - Portal for conveyancers to manage transactions
 * Flow: Enter invite code -> join transaction -> view in list -> open detail
 * Four views: Code Entry, Transaction List, Transaction Detail, Registration
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { conveyancerJoinService } from '../services/conveyancerJoin.service';
import AppTopBar from '@/components/navigation/AppTopBar';
import DocumentDetailModal from '../components/conveyancer/DocumentDetailModal';
import { SharedWithYouSection } from '../components/conveyancer/SharedWithYouSection';
import { ConveyancerEnquiriesSection } from '../components/conveyancer/ConveyancerEnquiriesSection';
import { ConveyancerBuyerPackSection } from '../components/conveyancer/ConveyancerBuyerPackSection';
import TR1Form from '../components/conveyancer/TR1Form';
import AP1Form from '../components/conveyancer/AP1Form';
import { ProfessionalOverviewPanel } from '../components/professional/ProfessionalOverviewPanel';
import { getWaitingOn, sortByWaitingOn } from '../utils/matterWaitingOn';
import { useDealStalls } from '../hooks/useDealStalls';
import { describeStall, longestWait } from '../services/stall.service';
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

type ViewState = 'list' | 'detail' | 'register' | 'add-code';

/** Get localStorage key for this conveyancer's linked transaction IDs */
function getStorageKey(): string {
  const principal = useAuthStore.getState().principalId || 'anon';
  return `conveyancer_txs_${principal}`;
}

/** Read linked transaction IDs from localStorage */
function getLinkedTxIds(): string[] {
  try {
    const raw = localStorage.getItem(getStorageKey());
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Save a new transaction ID to the linked list */
function addLinkedTxId(txId: string): void {
  const existing = getLinkedTxIds();
  if (!existing.includes(txId)) {
    existing.push(txId);
    localStorage.setItem(getStorageKey(), JSON.stringify(existing));
  }
}

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
  const [searchParams, setSearchParams] = useSearchParams();
  const [viewState, setViewState] = useState<ViewState>('list');
  // Set when the conveyancer arrives via a quote-accept join code — first-run
  // "check your firm details" banner (details are pre-filled from the CLC register).
  const [joinedFirm, setJoinedFirm] = useState<{ firmName?: string; clcId?: string } | null>(null);
  // Set when a stashed join code FAILS to redeem here. Previously this path was
  // silent: the firm landed on the generic "Got a transaction code?" empty state
  // with no idea its activation had failed (2026-07-27, card 1a5e87bc).
  const [joinFailure, setJoinFailure] = useState<{ reason: string; retryable: boolean } | null>(null);
  const [transactions, setTransactions] = useState<ConveyancerTransaction[]>([]);
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

  // Code entry state
  const [inviteCode, setInviteCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [codeLoading, setCodeLoading] = useState(false);

  // Registration form state
  const [regForm, setRegForm] = useState({
    fullName: '',
    regNumber: '',
    email: '',
    piiConfirmed: false,
  });
  const [regError, setRegError] = useState<string | null>(null);
  const [regSubmitting, setRegSubmitting] = useState(false);

  const loadTransactions = useCallback(async (): Promise<void> => {
    try {
      const linkedIds = getLinkedTxIds();
      if (linkedIds.length === 0) {
        setTransactions([]);
        return;
      }

      const results: ConveyancerTransaction[] = [];
      for (const txId of linkedIds) {
        try {
          const tx = await icpService.getTransaction(txId);
          if (tx) {
            results.push({
              id: String(tx.id),
              propertyAddress: String(tx.propertyAddress || ''),
              buyer: String(tx.buyer || ''),
              seller: String(tx.seller || ''),
              status: variantToKey(tx.status),
              amount: Number(tx.amount || 0),
              createdAt: Number(tx.createdAt),
            });
          }
        } catch (error) {
          logger.error(`Failed to fetch transaction ${txId}:`, error);
        }
      }
      setTransactions(results);
    } catch (error) {
      logger.error('Failed to load transactions:', error);
    }
  }, []);

  // Arrival from JoinConveyancerPage's success screen — surface the
  // first-run banner, then strip the params so a refresh doesn't repeat it.
  useEffect(() => {
    if (searchParams.get('joined') === null) return;
    setJoinedFirm({
      firmName: searchParams.get('firm') ?? undefined,
      clcId: searchParams.get('clc') ?? undefined,
    });
    setSearchParams({}, { replace: true });
    // Run once on mount — the params only exist on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const init = async (): Promise<void> => {
      const authState = useAuthStore.getState();
      const principalId = authState.principalId;
      if (!principalId || !authState.isAuthenticated) {
        navigate('/login');
        return;
      }

      // Consume a pending join code (stashed by /conveyancer/join/:code when
      // the winner signed up before their ICP principal existed). Runs before
      // the profile check so the transaction links even if on-chain profile
      // registration is still outstanding.
      const pendingCode = conveyancerJoinService.readPendingJoinCode();
      if (pendingCode) {
        const redeem = await conveyancerJoinService.redeemJoinCode(pendingCode);
        if (redeem.success) {
          conveyancerJoinService.clearPendingJoinCode();
          if (redeem.transactionId) addLinkedTxId(redeem.transactionId);
          setJoinedFirm({ firmName: redeem.firmName, clcId: redeem.clcId });
          setJoinFailure(null);
        } else if (
          redeem.error === 'invalid_code' ||
          redeem.error === 'already_redeemed' ||
          redeem.error === 'expired'
        ) {
          // Dead code — stop retrying it on every visit.
          conveyancerJoinService.clearPendingJoinCode();
          setJoinFailure({ reason: redeem.detail ?? redeem.error, retryable: false });
        } else {
          // Transient (no_principal, assignment_failed, network): keep the code
          // stashed for the next visit — but SAY SO. Swallowing this was the
          // 2026-07-27 defect: the firm saw the generic "Got a transaction code?"
          // empty state and had no idea activation had failed, while the sidebar
          // still read "ACTING AS <firm>". Firm and client both believed the
          // instruction had gone through.
          setJoinFailure({ reason: redeem.detail ?? redeem.error ?? 'Activation failed', retryable: true });
        }
      }

      try {
        await icpService.initialize();
        const profile = await icpService.getMyProfile();

        if (!profile) {
          setIsRegistered(false);
          setViewState('register');
          setLoading(false);
          return;
        }

        const userType = typeof profile.userType === 'object'
          ? Object.keys(profile.userType)[0] || ''
          : String(profile.userType || '');

        if (!userType.toLowerCase().includes('conveyancer')) {
          setIsRegistered(false);
          setViewState('register');
          setLoading(false);
          return;
        }

        await loadTransactions();

        const linked = getLinkedTxIds();
        if (linked.length === 0) {
          setViewState('add-code');
        }
      } catch (error) {
        logger.error('ConveyancerDashboard init error:', error);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [navigate, loadTransactions]);

  const handleAddCode = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setCodeError(null);
    const code = inviteCode.trim().toUpperCase();

    if (!/^TX-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)) {
      setCodeError('Invalid code format. Expected: TX-XXXX-XXXX');
      return;
    }

    setCodeLoading(true);
    try {
      const result = await icpService.joinTransactionByInviteCode(code);
      if (!result || !result.id) {
        setCodeError('Transaction not found. Check the code and try again.');
        return;
      }

      addLinkedTxId(String(result.id));
      setInviteCode('');
      await loadTransactions();
      setViewState('list');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to join transaction';
      setCodeError(msg);
    } finally {
      setCodeLoading(false);
    }
  };

  const loadDocuments = useCallback(async (txId: string): Promise<void> => {
    try {
      const docs = await icpService.getDocumentsByTransaction(txId);
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

  const handleSelectTx = async (tx: ConveyancerTransaction): Promise<void> => {
    setSelectedTx(tx);
    setViewState('detail');
    setConveyancerDocs(getConveyancerDocs(tx.id));
    await loadDocuments(tx.id);
  };

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
      await loadTransactions();
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
      setViewState('add-code');
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
        {/* Was a sidebar nav action; kept as a page action so replacing the
            sidebar does not remove the only way to add a transaction. */}
        <div className="mb-6 flex justify-end">
          <button
            type="button"
            onClick={() => { setViewState('add-code'); setCodeError(null); setInviteCode(''); }}
            className="flex h-11 items-center gap-2 rounded-lg border-none bg-[#0D9488] px-4 text-sm font-medium text-white transition-colors duration-200 ease-out hover:bg-[#0F766E]"
          >
            Add transaction
          </button>
        </div>
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

        {/* Add Transaction Code */}
        {viewState === 'add-code' && isRegistered && (
          <CodeEntryView
            inviteCode={inviteCode}
            setInviteCode={setInviteCode}
            codeError={codeError}
            setCodeError={setCodeError}
            codeLoading={codeLoading}
            onSubmit={handleAddCode}
            transactionCount={transactions.length}
            onBackToList={() => setViewState('list')}
          />
        )}

        {/* Activation FAILED for a stashed join code. Never fail silently here:
            the firm has been told by email that it won the work, so an invisible
            failure leaves it stranded on the empty state with no explanation. */}
        {joinFailure && (viewState === 'list' || viewState === 'add-code') && (
          <div
            role="alert"
            className="mb-6 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-4 py-3"
          >
            <p className="text-sm font-medium text-amber-900 dark:text-amber-300">
              We couldn&rsquo;t finish connecting you to the transaction.
            </p>
            <p className="mt-1 text-xs text-amber-800 dark:text-amber-400">{joinFailure.reason}</p>
            <p className="mt-2 text-xs text-amber-800 dark:text-amber-400">
              {joinFailure.retryable
                ? 'We’ll try again next time you open this page. If it keeps happening, email '
                : 'This activation link can no longer be used. Please email '}
              <a className="underline" href="mailto:support@propxchain.com">support@propxchain.com</a>
              {' '}and we&rsquo;ll sort it out.
            </p>
          </div>
        )}

        {/* First-run banner after joining via an accepted quote */}
        {joinedFirm && (viewState === 'list' || viewState === 'add-code') && (
          <div className="mb-6 rounded-lg border border-teal-300 dark:border-teal-700 bg-teal-50 dark:bg-teal-900/20 px-4 py-3">
            <p className="text-sm font-medium text-teal-800 dark:text-teal-300">
              You&rsquo;re on the transaction{joinedFirm.firmName ? ` as ${joinedFirm.firmName}` : ''}
              {joinedFirm.clcId ? ` (CLC ${joinedFirm.clcId})` : ''}.
            </p>
            <p className="mt-1 text-xs text-teal-700 dark:text-teal-400">
              Your firm details were pre-filled from the CLC register — please check them and
              email <a className="underline" href="mailto:support@propxchain.com">support@propxchain.com</a> if
              anything needs correcting.
            </p>
          </div>
        )}

        {/* Transaction List */}
        {viewState === 'list' && isRegistered && (
          <TransactionListView
            transactions={transactions}
            onSelect={handleSelectTx}
            onAddNew={() => { setViewState('add-code'); setCodeError(null); setInviteCode(''); }}
            getStatusLabel={getStatusLabel}
            getMilestoneLabel={getMilestoneLabel}
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
            onBack={() => { setViewState('list'); setSelectedTx(null); }}
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

interface CodeEntryViewProps {
  inviteCode: string;
  setInviteCode: (v: string) => void;
  codeError: string | null;
  setCodeError: (v: string | null) => void;
  codeLoading: boolean;
  onSubmit: (e: React.FormEvent) => Promise<void>;
  transactionCount: number;
  onBackToList: () => void;
}
const CodeEntryView: React.FC<CodeEntryViewProps> = ({ inviteCode, setInviteCode, codeError, setCodeError, codeLoading, onSubmit, transactionCount, onBackToList }) => (
  <div className="mx-auto max-w-xl">
    <h1 className="font-[Fraunces] text-[2rem] font-semibold leading-tight tracking-tight text-[#1A1A1A] dark:text-stone-100 sm:text-[2.5rem]">
      Got a transaction code?
    </h1>
    <p className="mt-3 max-w-md font-[DM_Sans] text-base text-[#6B7280] dark:text-stone-400">
      Paste it below to pick up the matter. Buyers and sellers receive the code when they start a transaction.
    </p>

    <form onSubmit={onSubmit} className="mt-10">
      <label htmlFor="conv-invite-code" className="block font-[DM_Sans] text-sm font-medium text-[#1A1A1A] dark:text-stone-200">
        Transaction code
      </label>
      <input
        id="conv-invite-code"
        type="text"
        value={inviteCode}
        onChange={(e) => { setInviteCode(e.target.value); setCodeError(null); }}
        placeholder="TX-XXXX-XXXX"
        maxLength={12}
        autoFocus
        className="mt-2 w-full rounded-md border border-[#E5E7EB] bg-white px-4 py-4 text-center font-mono text-2xl tracking-[0.2em] text-[#1A1A1A] uppercase focus:border-[#0D9488] focus:outline-none focus:ring-1 focus:ring-[#0D9488] dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
      />
      <p className="mt-1.5 font-[DM_Sans] text-xs text-[#6B7280]">
        Twelve characters, hyphens included.
      </p>

      {codeError && (
        <div className="mt-4 rounded-md border border-[#DC2626]/30 bg-[#FEF2F2] p-3 font-[DM_Sans] text-sm text-[#DC2626]">
          {codeError}
        </div>
      )}

      <div className="mt-8 flex items-center gap-4">
        {transactionCount > 0 && (
          <button
            type="button"
            onClick={onBackToList}
            className="font-[DM_Sans] text-sm text-[#6B7280] transition-colors hover:text-[#1A1A1A] dark:hover:text-stone-200"
          >
            ← My transactions ({transactionCount})
          </button>
        )}
        <button
          type="submit"
          disabled={codeLoading || !inviteCode.trim()}
          className="ml-auto inline-flex min-h-12 items-center justify-center rounded-md bg-[#0D9488] px-8 py-3 font-[DM_Sans] text-base font-medium text-white transition-colors hover:bg-[#0F766E] disabled:cursor-not-allowed disabled:bg-[#9CA3AF]"
        >
          {codeLoading ? 'Joining…' : 'Access transaction'}
        </button>
      </div>
    </form>
  </div>
);

interface TransactionListViewProps {
  transactions: ConveyancerTransaction[];
  onSelect: (tx: ConveyancerTransaction) => void;
  onAddNew: () => void;
  getStatusLabel: (s: string) => string;
  getMilestoneLabel: (s: string) => string;
}
/** Small badge marking the matters whose next move is the conveyancer's. */
const NeedsYouBadge: React.FC = () => (
  <span className="rounded-full border border-[#D97706]/40 bg-[#FFF7ED] px-2.5 py-0.5 font-[DM_Sans] text-xs font-medium text-[#9A3412] dark:border-[#D97706]/50 dark:bg-[#D97706]/10 dark:text-[#FDBA74]">
    Needs you
  </span>
);

const TransactionListView: React.FC<TransactionListViewProps> = ({ transactions, onSelect, onAddNew, getStatusLabel, getMilestoneLabel }) => {
  // The server's stalls per matter (stall attribution): the longest wait
  // orders the desk inside each group and is shown on the row, by role.
  const stallsByTx = useDealStalls(transactions.map((tx) => tx.id));
  // Derived here rather than in the parent: it is presentation ordering, and
  // the inputs (status + the conveyancer's own docs in localStorage) are free.
  //
  // Resolved once per matter, not per comparison: the sort comparator, the
  // header count and the per-row badge all read the same answer, and each
  // lookup parses JSON out of localStorage. Computing it inside the
  // comparator would re-read the same matter O(log n) times on every render.
  const withWaiting = transactions.map((tx) => {
    const docs = getConveyancerDocs(tx.id);
    return {
      tx,
      waitingOn: getWaitingOn(tx.status, {
        hasTR1: docs.some((d) => d.docType === 'tr1_transfer'),
        hasAP1: docs.some((d) => d.docType === 'ap1_application'),
      }),
      wait: longestWait(stallsByTx[tx.id] ?? []),
    };
  });
  const ordered = sortByWaitingOn(withWaiting, (entry) => entry.waitingOn, (entry) => entry.wait?.days ?? 0);
  const needsYouCount = withWaiting.filter((entry) => entry.waitingOn === 'you').length;

  return (
  <div className="mx-auto max-w-5xl">
    <div className="mb-10 flex items-end justify-between gap-6">
      <div>
        <h1 className="font-[Fraunces] text-[2rem] font-semibold leading-tight tracking-tight text-[#1A1A1A] dark:text-stone-100 sm:text-[2.5rem]">
          My transactions
        </h1>
        <p className="mt-2 font-[DM_Sans] text-base text-[#6B7280] dark:text-stone-400">
          {transactions.length === 0
            ? 'Nothing here yet. Add a code to pick up your first matter.'
            : needsYouCount > 0
              ? `${needsYouCount} of ${transactions.length} need${needsYouCount === 1 ? 's' : ''} you. Waiting on someone else below.`
              : `${transactions.length} matter${transactions.length === 1 ? '' : 's'} on your desk — none waiting on you.`}
        </p>
      </div>
      <button
        onClick={onAddNew}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#0D9488] px-5 py-2.5 font-[DM_Sans] text-sm font-medium text-white transition-colors hover:bg-[#0F766E]"
      >
        Add transaction
      </button>
    </div>

    {/* v3 Ship 6 — aggregated overview: stats, forms progress, attention items */}
    {transactions.length > 0 && (
      <ProfessionalOverviewPanel
        transactions={transactions}
        onTransactionClick={(id) => {
          const tx = transactions.find((t) => t.id === id);
          if (tx) onSelect(tx);
        }}
      />
    )}

    {transactions.length === 0 ? (
      <div className="mt-8 rounded-md border border-[#E5E7EB] bg-white p-16 text-center dark:border-stone-700 dark:bg-stone-800">
        <h3 className="font-[Fraunces] text-xl font-semibold text-[#1A1A1A] dark:text-stone-100">
          Your panel is empty.
        </h3>
        <p className="mx-auto mt-2 max-w-sm font-[DM_Sans] text-sm text-[#6B7280] dark:text-stone-400">
          Once a buyer or seller invites you to their transaction, it&apos;ll appear here with everything you need to act on.
        </p>
        <button
          onClick={onAddNew}
          className="mt-8 inline-flex min-h-11 items-center justify-center rounded-md bg-[#0D9488] px-6 py-2.5 font-[DM_Sans] text-sm font-medium text-white transition-colors hover:bg-[#0F766E]"
        >
          Enter transaction code
        </button>
      </div>
    ) : (
      <ul className="mt-8 divide-y divide-[#E5E7EB] overflow-hidden rounded-md border border-[#E5E7EB] bg-white dark:divide-stone-700 dark:border-stone-700 dark:bg-stone-800">
        {ordered.map(({ tx, waitingOn, wait }) => (
          <li key={tx.id}>
            <button
              onClick={() => onSelect(tx)}
              className="group flex w-full items-center justify-between gap-6 px-6 py-5 text-left transition-colors hover:bg-[#FAFAF8] dark:hover:bg-stone-900"
            >
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-[Fraunces] text-lg font-semibold text-[#1A1A1A] dark:text-stone-100">
                  {tx.propertyAddress}
                </h3>
                <p className="mt-1 font-[DM_Sans] text-sm text-[#6B7280] dark:text-stone-400">
                  £{tx.amount.toLocaleString()}
                </p>
                <p className="mt-2 font-[DM_Sans] text-xs text-[#5F8A68]">
                  {getMilestoneLabel(tx.status)}
                </p>
                {wait && (
                  <p data-testid="matter-wait" className="mt-1 font-[DM_Sans] text-xs text-[#9A3412] dark:text-[#FDBA74]">
                    {describeStall(wait)}
                  </p>
                )}
              </div>
              <div className="flex flex-shrink-0 items-center gap-4">
                {waitingOn === 'you' && <NeedsYouBadge />}
                <span className="rounded-full border border-[#0D9488]/30 bg-[#CCFBF1]/30 px-3 py-1 font-[DM_Sans] text-xs font-medium text-[#0F766E]">
                  {getStatusLabel(tx.status)}
                </span>
                <span className="text-[#9CA3AF] transition-colors group-hover:text-[#0D9488]">→</span>
              </div>
            </button>
          </li>
        ))}
      </ul>
    )}
    </div>
  );
};

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
