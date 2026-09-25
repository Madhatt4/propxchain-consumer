import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { icpService } from '../services/icp.service';
import SignatureModal from '../components/SignatureModal';
import { generateSignedContractPDF } from '../utils/contractPdfGenerator';
import { useThemeClasses } from '../hooks/useThemeClasses';
import { logger } from '@/utils/logger';
import { isWaitingForOtherSide } from '@/utils/twoSidedSteps';
import { documentShareService } from '@/services/documentShare.service';
import { useAuthStore } from '../stores/authStore';
import OverviewTab from '../components/exchange/OverviewTab';
import SellerTab from '../components/exchange/SellerTab';
import BuyerTab from '../components/exchange/BuyerTab';
import SolicitorTab from '../components/exchange/SolicitorTab';
import LenderTab from '../components/exchange/LenderTab';
import EscrowTab from '../components/exchange/EscrowTab';
import type {
  ExchangeTransaction,
  ExchangeTabId,
  ExchangeTab,
  CurrentUser,
  EscrowConfirmation,
  LenderConfirmation,
} from '../types/exchange.types';

const TABS: ExchangeTab[] = [
  { id: 'overview', label: 'Overview', icon: '\uD83D\uDCCA' },
  { id: 'seller', label: 'Seller', icon: '\uD83C\uDFE0' },
  { id: 'buyer', label: 'Buyer', icon: '\uD83D\uDD11' },
  { id: 'solicitors', label: 'Solicitors', icon: '\u2696\uFE0F' },
  { id: 'lender', label: 'Lender', icon: '\uD83C\uDFE6' },
  { id: 'escrow', label: 'Funds', icon: '\uD83D\uDD12' },
];

/** Generate an 8-char alphanumeric code */
function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

const ExchangeSigningPage: React.FC = () => {
  const { transactionId } = useParams<{ transactionId: string }>();
  const navigate = useNavigate();
  const themeClasses = useThemeClasses();

  const [transaction, setTransaction] = useState<ExchangeTransaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [activeTab, setActiveTab] = useState<ExchangeTabId>('overview');
  const [escrowConfirmations, setEscrowConfirmations] = useState<EscrowConfirmation[]>([]);
  const [lenderConfirmation, setLenderConfirmation] = useState<LenderConfirmation | null>(null);

  useEffect(() => { loadTransactionData(); }, [transactionId]);

  /**
   * Load transaction from canister — no localStorage.
   * Builds a parties array from on-chain buyer/seller principals for UI compat.
   */
  const loadTransactionData = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);

      // 1. Identify current user from auth store
      const authState = useAuthStore.getState();
      const principalId = authState.principalId;
      let user: CurrentUser | null = null;

      if (principalId && authState.isAuthenticated) {
        user = { id: principalId, principal: principalId, firstName: '', lastName: '', email: '', name: 'User' };
        try {
          await icpService.initialize();
          const profile = await icpService.getUserProfile(principalId);
          if (profile) {
            const nameParts = (profile.name || '').split(' ');
            user.firstName = nameParts[0] || '';
            user.lastName = nameParts.slice(1).join(' ') || '';
            user.email = profile.email || '';
            user.name = profile.name || `${user.firstName} ${user.lastName}`.trim() || 'User';
          }
        } catch { logger.warn('Could not load user profile from canister'); }
        setCurrentUser(user);
      }

      // 2. Load transaction from canister
      await icpService.initialize();
      const canisterTx = await icpService.getTransactionByTextId(transactionId || '');

      if (!canisterTx) {
        throw new Error('Transaction not found on-chain. Please return to the dashboard.');
      }

      // 3. Build ExchangeTransaction from canister data
      const combined = buildExchangeTransaction(canisterTx, user);

      // 4. Load escrow confirmations (still localStorage for prototype demo)
      loadEscrowConfirmations(combined);
      setTransaction(combined);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load transaction';
      logger.error('Error loading transaction:', err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [transactionId]);

  const loadEscrowConfirmations = (tx: ExchangeTransaction): void => {
    const key = `escrow_${tx.id}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        const data = JSON.parse(stored);
        setEscrowConfirmations(data.escrow || []);
        setLenderConfirmation(data.lender || null);
        return;
      } catch { /* fall through to generate */ }
    }
    const escrow: EscrowConfirmation[] = [
      { stakeholderRole: 'conveyancer_funds', stakeholderName: 'Conveyancer (client account)', confirmationCode: generateCode(), isConfirmed: false },
      { stakeholderRole: 'buyer_funds', stakeholderName: 'Buyer Funds Transfer', confirmationCode: generateCode(), isConfirmed: false },
    ];
    const lender: LenderConfirmation | null = tx.financialTerms.hasMortgage !== false
      ? { lenderName: tx.financialTerms.lenderName || 'Mortgage Lender', confirmationCode: generateCode(), isConfirmed: false, mortgageAdvanceReady: false, dischargeConsentGiven: false }
      : null;
    localStorage.setItem(key, JSON.stringify({ escrow, lender }));
    setEscrowConfirmations(escrow);
    setLenderConfirmation(lender);
  };

  const handleEscrowCodeSubmit = (role: string, code: string): void => {
    if (!transaction) return;
    const updated = escrowConfirmations.map(c => {
      if (c.stakeholderRole === role && c.confirmationCode === code) {
        return { ...c, isConfirmed: true, confirmedAt: new Date().toISOString() };
      }
      if (c.stakeholderRole === role && c.confirmationCode !== code) {
        alert('Invalid confirmation code. Please check and try again.');
      }
      return c;
    });
    setEscrowConfirmations(updated);
    const key = `escrow_${transaction.id}`;
    localStorage.setItem(key, JSON.stringify({ escrow: updated, lender: lenderConfirmation }));
  };

  const handleLenderCodeSubmit = (code: string): void => {
    if (!transaction || !lenderConfirmation) return;
    if (lenderConfirmation.confirmationCode === code) {
      const updated: LenderConfirmation = {
        ...lenderConfirmation,
        isConfirmed: true,
        confirmedAt: new Date().toISOString(),
        mortgageAdvanceReady: true,
        dischargeConsentGiven: true,
      };
      setLenderConfirmation(updated);
      const key = `escrow_${transaction.id}`;
      localStorage.setItem(key, JSON.stringify({ escrow: escrowConfirmations, lender: updated }));
    } else {
      alert('Invalid lender confirmation code. Please check and try again.');
    }
  };

  /**
   * Determine the current user's signing role from the transaction.
   * When buyer != seller principals, match by principal.
   * When they're equal (buyer hasn't joined yet), use the active tab context.
   */
  const getUserSigningRole = (): 'buyer' | 'seller' | null => {
    if (!transaction || !currentUser) return null;
    const { buyerPrincipal, sellerPrincipal } = transaction;

    // When principals differ, match unambiguously
    if (buyerPrincipal !== sellerPrincipal) {
      if (currentUser.principal === sellerPrincipal) return 'seller';
      if (currentUser.principal === buyerPrincipal) return 'buyer';
      return null;
    }

    // Same principal for both (buyer hasn't joined) — use active tab
    if (activeTab === 'buyer') return 'buyer';
    if (activeTab === 'seller') return 'seller';

    // Fallback: check localStorage userType set during wizard
    const storedRole = localStorage.getItem('userType');
    if (storedRole?.includes('seller')) return 'seller';
    if (storedRole?.includes('buyer')) return 'buyer';

    return null;
  };

  /**
   * Handle signature: hash it, record on-chain via recordPartySignature,
   * then reload from canister to show updated state.
   */
  const handleSignatureComplete = async (_signatureDataUrl: string): Promise<void> => {
    if (!transaction || !currentUser) return;

    const signingRole = getUserSigningRole();
    if (!signingRole) {
      setError('Unable to determine your signing role. Please sign from the Buyer or Seller tab.');
      setShowSignatureModal(false);
      return;
    }

    setShowSignatureModal(false);
    setSigning(true);
    setError(null);

    try {
      // Generate SHA-256 hash of signature data
      const signatureData = {
        principal: currentUser.principal,
        userName: `${currentUser.firstName} ${currentUser.lastName}`,
        transactionId: transaction.id,
        timestamp: new Date().toISOString(),
        propertyAddress: transaction.propertyAddress,
        role: signingRole,
      };
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(JSON.stringify(signatureData)));
      const signatureHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

      // Record on-chain with explicit role
      const result = await icpService.recordPartySignature(transaction.id, signatureHash, signingRole);

      if (result.success) {
        logger.info('Signature recorded on-chain:', result.message);
        const isNowExchanged = result.message.toLowerCase().includes('exchanged') ||
          result.message.toLowerCase().includes('both');
        if (isNowExchanged) {
          alert('All parties have signed! The exchange is now recorded on the blockchain.');
        } else {
          alert('Your signature has been recorded on the blockchain. Waiting for the other party to sign.');
        }
        // Reload from canister to reflect updated state
        await loadTransactionData();
      } else {
        setError(`Failed to record signature: ${result.message}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to sign contract';
      logger.error('Error signing:', err);
      setError(msg);
    } finally {
      setSigning(false);
    }
  };

  const handleDownloadContract = async (): Promise<void> => {
    if (!transaction) return;
    try {
      const pdfBlob = await generateSignedContractPDF(transaction, currentUser);
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `PropXchain-Contract-${transaction.propertyAddress.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to download';
      alert('Failed to download contract: ' + msg);
    }
  };

  const handleInitiateCompletion = async (): Promise<void> => {
    if (!transaction) return;
    setSigning(true);
    setError(null);
    try {
      const encoder = new TextEncoder();
      const fundsHash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',
        encoder.encode(JSON.stringify({ transactionId: transaction.id, amount: transaction.financialTerms.purchasePrice, timestamp: new Date().toISOString() }))
      ))).map(b => b.toString(16).padStart(2, '0')).join('');

      const completionHash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',
        encoder.encode(JSON.stringify({ transactionId: transaction.id, propertyAddress: transaction.propertyAddress, completionDate: new Date().toISOString(), purchasePrice: transaction.financialTerms.purchasePrice }))
      ))).map(b => b.toString(16).padStart(2, '0')).join('');

      const result = await icpService.initiateCompletion(transaction.id, fundsHash, completionHash);
      if (result.success && isWaitingForOtherSide(result.message)) {
        // Completion needs the buyer side and the seller side (security scan
        // H6); this confirmation is held until the other side confirms too.
        alert(result.message);
        loadTransactionData();
      } else if (result.success) {
        // Wallet spec decision 8: shared documents stop being readable 14 days after completion.
        void documentShareService
          .scheduleExpiryForDeal(String(transaction.id))
          .catch((e: unknown) => logger.warn('[completion] could not schedule share expiry', e));
        alert('Blockchain Completion Initiated!\n\n' + result.message);
        loadTransactionData();
      } else {
        setError(result.message);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to initiate completion';
      setError(msg);
    } finally {
      setSigning(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className={`min-h-screen ${themeClasses.pageBg} flex items-center justify-center`}>
        <div className="text-center">
          <div className={`animate-spin rounded-full h-12 w-12 border-b-2 ${themeClasses.spinner} mx-auto mb-4`} />
          <p className={themeClasses.textSecondary}>Loading exchange from blockchain...</p>
        </div>
      </div>
    );
  }

  if (!transaction) {
    return (
      <div className={`min-h-screen ${themeClasses.pageBg} flex items-center justify-center`}>
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400">{error || 'Transaction not found'}</p>
          <button onClick={() => navigate('/dashboard')} className="mt-4 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200">
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${themeClasses.pageBg}`}>
      {/* Header */}
      <header className={themeClasses.headerBg}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <button onClick={() => navigate('/dashboard')} className="text-gray-700 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300 font-medium">
                {'\u2190'} Back to Dashboard
              </button>
              <div>
                <h1 className={`text-2xl font-bold ${themeClasses.headerText}`}>Exchange of Contracts</h1>
                <p className={`text-sm ${themeClasses.headerSubtext}`}>{transaction.propertyAddress}</p>
              </div>
            </div>
            <span className={`px-4 py-2 rounded-full text-sm font-semibold ${
              transaction.status === 'exchanged' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
              transaction.status === 'completion_initiated' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' :
              'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
            }`}>
              {transaction.status === 'exchanged' ? 'EXCHANGED' :
               transaction.status === 'completion_initiated' ? 'COMPLETING' :
               transaction.status.toUpperCase().replace(/_/g, ' ')}
            </span>
          </div>
        </div>
      </header>

      {/* Tab Bar */}
      <div className={`${themeClasses.cardBg} border-b ${themeClasses.border}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-1 overflow-x-auto py-1">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap rounded-t-lg transition-colors ${
                  activeTab === tab.id
                    ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-b-2 border-indigo-600'
                    : `${themeClasses.textSecondary} hover:bg-gray-100 dark:hover:bg-gray-700`
                }`}
              >
                <span className="mr-1.5">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4">
            <p className="text-red-800 dark:text-red-300">{error}</p>
          </div>
        </div>
      )}

      {/* Tab Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'overview' && (
          <OverviewTab transaction={transaction} escrowConfirmations={escrowConfirmations} lenderConfirmation={lenderConfirmation} themeClasses={themeClasses} />
        )}
        {activeTab === 'seller' && (
          <SellerTab transaction={transaction} currentUser={currentUser} isSigning={signing} onOpenSignatureModal={() => setShowSignatureModal(true)} themeClasses={themeClasses} />
        )}
        {activeTab === 'buyer' && (
          <BuyerTab transaction={transaction} currentUser={currentUser} isSigning={signing} onOpenSignatureModal={() => setShowSignatureModal(true)} themeClasses={themeClasses} />
        )}
        {activeTab === 'solicitors' && (
          <SolicitorTab transaction={transaction} currentUser={currentUser} themeClasses={themeClasses} />
        )}
        {activeTab === 'lender' && (
          <LenderTab transaction={transaction} lenderConfirmation={lenderConfirmation} onConfirmationCodeSubmit={handleLenderCodeSubmit} themeClasses={themeClasses} />
        )}
        {activeTab === 'escrow' && (
          <EscrowTab transaction={transaction} escrowConfirmations={escrowConfirmations} lenderConfirmation={lenderConfirmation} onEscrowCodeSubmit={handleEscrowCodeSubmit} onDownloadContract={handleDownloadContract} onInitiateCompletion={handleInitiateCompletion} isSigning={signing} themeClasses={themeClasses} />
        )}
      </main>

      {/* Signature Modal */}
      {currentUser && (
        <SignatureModal
          isOpen={showSignatureModal}
          onClose={() => setShowSignatureModal(false)}
          onSign={handleSignatureComplete}
          userName={`${currentUser.firstName} ${currentUser.lastName}`.trim() || currentUser.name}
          documentTitle={`Property Exchange Contract - ${transaction.propertyAddress}`}
        />
      )}
    </div>
  );
};

/**
 * Build ExchangeTransaction from canister response.
 * Constructs a parties array from buyer/seller principals for tab component compat.
 */
function buildExchangeTransaction(
  canisterTx: Record<string, unknown>,
  user: CurrentUser | null
): ExchangeTransaction {
  const seller = (canisterTx.seller as string) || '';
  const buyer = (canisterTx.buyer as string) || '';
  const buyerSigHash = (canisterTx.buyerSolicitorSignature as string | null) || null;
  const sellerSigHash = (canisterTx.sellerSolicitorSignature as string | null) || null;
  const hasBuyerSigned = !!buyerSigHash;
  const hasSellerSigned = !!sellerSigHash;
  const status = (canisterTx.status as string) || 'active';
  const amount = Number(canisterTx.amount || 0);
  const deposit = Number(canisterTx.deposit || 0);
  const mortgageAmount = Number(canisterTx.mortgageAmount || 0);
  const exchangedAt = canisterTx.exchangedAt ? Number(canisterTx.exchangedAt) : null;

  // Determine display names — try to match current user
  const sellerName = (user && seller === user.principal)
    ? `${user.firstName} ${user.lastName}`.trim() || user.name
    : 'Seller';
  const buyerName = (user && buyer === user.principal)
    ? `${user.firstName} ${user.lastName}`.trim() || user.name
    : 'Buyer';

  // Build parties array for tab components (userId = principalId)
  const parties = [
    {
      userId: seller,
      role: 'seller',
      name: sellerName,
      email: (user && seller === user.principal) ? user.email : '',
      verified: true,
      hasSigned: hasSellerSigned,
      signedAt: hasSellerSigned ? 'On-chain' : undefined,
      signature: sellerSigHash || undefined,
    },
    {
      userId: buyer,
      role: 'buyer',
      name: buyerName,
      email: (user && buyer === user.principal) ? user.email : '',
      verified: true,
      hasSigned: hasBuyerSigned,
      signedAt: hasBuyerSigned ? 'On-chain' : undefined,
      signature: buyerSigHash || undefined,
    },
  ];

  return {
    id: canisterTx.id as string,
    propertyAddress: (canisterTx.propertyAddress as string) || 'Address not available',
    titleNumber: (canisterTx.titleNumber as string) || 'TN-PENDING',
    propertyType: (canisterTx.propertyType as string) || 'Property',
    status,
    financialTerms: {
      purchasePrice: amount,
      deposit: deposit || Math.round(amount * 0.1),
      completionDate: (canisterTx.completionDate as string) || new Date().toISOString(),
      hasMortgage: mortgageAmount > 0,
      mortgageAmount,
    },
    buyerPrincipal: buyer,
    sellerPrincipal: seller,
    buyerSigned: hasBuyerSigned,
    sellerSigned: hasSellerSigned,
    buyerSignatureHash: buyerSigHash,
    sellerSignatureHash: sellerSigHash,
    parties,
    allPartiesSigned: hasBuyerSigned && hasSellerSigned,
    exchangeTimestamp: exchangedAt ? Math.floor(exchangedAt / 1_000_000) : undefined,
    contractExchangeTimestamp: canisterTx.contractExchangeTimestamp ? Number(canisterTx.contractExchangeTimestamp) : null,
    contractHash: `blockchain_tx_${canisterTx.id as string}`,
    blockchainTransactionId: canisterTx.id as string,
  };
}

export default ExchangeSigningPage;
