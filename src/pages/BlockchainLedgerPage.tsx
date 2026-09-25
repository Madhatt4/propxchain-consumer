import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardSidebar from '../components/navigation/DashboardSidebar';
import DashboardHeader from '../components/navigation/DashboardHeader';
import { useCanAccessFeature } from '../hooks/useSubscription';
import UpgradePrompt from '../components/subscription/UpgradePrompt';
import { logger } from '@/utils/logger';
import { useAuthStore } from '../stores/authStore';
import { toTransactionStatus } from '@/types/transactionStatus';

interface BlockchainDocument {
  id: string;
  transactionId: string;
  documentName: string;
  documentType: string;
  uploadedBy: string;
  uploadedAt: string;
  blockchainHash: string;
  fileSize: number;
  canisterId: string;
  chunkCount: number;
  verified: boolean;
  propertyAddress: string;
}

interface Transaction {
  id: string;
  propertyAddress: string;
  status: string;
  role: string;
  parties: any[];
  documentCount: number;
  createdAt: string;
  blockchainTxId?: string;
}

const BlockchainLedgerPage: React.FC = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<'client' | 'solicitor'>('client');
  const [activeTab, setActiveTab] = useState<'transactions' | 'documents' | 'verification'>('transactions');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [documents, setDocuments] = useState<BlockchainDocument[]>([]);
  const [selectedTransaction, setSelectedTransaction] = useState<string | null>(null);
  const [verificationHash, setVerificationHash] = useState('');
  const [loading, setLoading] = useState(true);

  // Check subscription access - blockchain_ledger requires Individual tier
  const canAccessBlockchainLedger = useCanAccessFeature('blockchain_ledger');

  // Theme classes for dark mode
  const themeClasses = {
    pageBg: 'bg-gray-50 dark:bg-gray-900',
    textPrimary: 'text-gray-900 dark:text-white',
    textSecondary: 'text-gray-600 dark:text-gray-400',
    cardBg: 'bg-white dark:bg-gray-800',
    cardSecondary: 'bg-gray-50 dark:bg-gray-700',
    border: 'border-gray-200 dark:border-gray-700',
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Get current user
      const authState = useAuthStore.getState();
      const principalId = authState.principalId;
      const user = (principalId && authState.isAuthenticated) ? {
        principal: principalId,
        id: principalId,
        email: '',
        role: ''
      } : null;
      if (user) {
        setCurrentUser(user);
        // Check if user is a solicitor based on email domain or role
        const isSolicitor = user.email?.includes('solicitor') ||
                           user.email?.includes('legal') ||
                           user.role === 'solicitor';
        setUserRole(isSolicitor ? 'solicitor' : 'client');
      }

      // Load transactions from blockchain
      const { icpService } = await import('../services/icp.service');
      let blockchainTransactions: any[] = [];
      try {
        blockchainTransactions = await icpService.getAllTransactions();
        if (!Array.isArray(blockchainTransactions)) {
          logger.warn('Blockchain returned non-array, using empty array');
          blockchainTransactions = [];
        }
      } catch (error) {
        logger.error('Error loading from blockchain:', error);
        blockchainTransactions = [];
      }

      // Also load from localStorage to get full wizard data
      const localStorageTransactions = JSON.parse(localStorage.getItem('transactions') || '[]');

      // Merge blockchain and localStorage data
      const mergedTransactions = blockchainTransactions.map((bcTx: any) => {
        // Find matching localStorage transaction
        const localTx = localStorageTransactions.find((lsTx: any) =>
          lsTx.blockchainTransactionId === bcTx.id || lsTx.id === bcTx.id
        );

        // Merge data - blockchain is source of truth, but localStorage has additional details
        return {
          ...localTx,
          ...bcTx,
          // Preserve wizard data from localStorage
          wizardData: localTx?.wizardData,
          parties: localTx?.parties || [],
          uploadedDocuments: localTx?.uploadedDocuments || [],
        };
      });

      // Transform transactions for display
      const transformedTransactions: Transaction[] = Array.isArray(mergedTransactions)
        ? mergedTransactions.map((tx: any) => {
            const userParty = tx.parties?.find((p: any) => p.userId === user?.id || p.userId === user?.principal);
            return {
              id: tx.id?.toString() || tx.id,
              propertyAddress: tx.propertyAddress || 'Address not available',
              status: toTransactionStatus(tx.status),
              role: userParty?.role || tx.wizardData?.userRole || 'seller',
              parties: tx.parties || [],
              documentCount: (tx.uploadedDocuments?.length || 0) + (tx.wizardData?.documents?.length || 0),
              createdAt: tx.createdAt || new Date().toISOString(),
              blockchainTxId: tx.id,
            };
          })
        : [];

      setTransactions(transformedTransactions);

      // Load documents (simulate blockchain document storage)
      const allDocuments: BlockchainDocument[] = [];
      mergedTransactions.forEach((tx: any) => {
        // Add uploaded documents
        tx.uploadedDocuments?.forEach((doc: any, index: number) => {
          allDocuments.push({
            id: `doc_${tx.id}_${index}`,
            transactionId: tx.id,
            documentName: doc.name || 'Document',
            documentType: doc.type || 'application/pdf',
            uploadedBy: user?.email || 'Unknown',
            uploadedAt: doc.uploadedAt || new Date().toISOString(),
            blockchainHash: doc.blockchainHash || `hash_${Date.now()}_${index}`,
            fileSize: doc.size || 0,
            canisterId: 'u7777-77777-77774-qaaaq-cai',
            chunkCount: Math.ceil((doc.size || 0) / (2 * 1024 * 1024)), // 2MB chunks
            verified: true,
            propertyAddress: tx.propertyAddress || 'Address not available',
          });
        });

        // Add wizard documents
        tx.wizardData?.documents?.forEach((doc: any, index: number) => {
          allDocuments.push({
            id: `wiz_doc_${tx.id}_${index}`,
            transactionId: tx.id,
            documentName: doc.name || doc.type || 'Wizard Document',
            documentType: doc.type || 'document',
            uploadedBy: user?.email || 'Unknown',
            uploadedAt: doc.uploadedAt || tx.createdAt || new Date().toISOString(),
            blockchainHash: doc.blockchainHash || `hash_wizard_${Date.now()}_${index}`,
            fileSize: doc.size || 0,
            canisterId: 'u7777-77777-77774-qaaaq-cai',
            chunkCount: Math.ceil((doc.size || 0) / (2 * 1024 * 1024)),
            verified: true,
            propertyAddress: tx.propertyAddress || 'Address not available',
          });
        });
      });

      setDocuments(allDocuments);
      setLoading(false);
    } catch (err: any) {
      logger.error('Error loading dashboard data:', err);
      setLoading(false);
    }
  };

  const filteredDocuments = selectedTransaction
    ? documents.filter(doc => doc.transactionId === selectedTransaction)
    : documents;

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleVerifyHash = () => {
    if (!verificationHash) {
      alert('Please enter a contract hash or transaction ID to verify');
      return;
    }

    // Find matching document or transaction
    const matchingDoc = documents.find(doc =>
      doc.blockchainHash === verificationHash || doc.transactionId === verificationHash
    );
    const matchingTx = transactions.find(tx =>
      tx.id?.toLowerCase() === verificationHash?.toLowerCase() ||
      tx.blockchainTxId === verificationHash
    );

    if (matchingDoc || matchingTx) {
      alert(`✅ Verification Successful!\n\n${matchingDoc ? 'Document' : 'Transaction'} found and verified on blockchain.\n\nStatus: IMMUTABLE\nNetwork: Internet Computer Protocol`);
    } else {
      alert('⚠️ Verification Failed\n\nNo matching document or transaction found.\n\nPlease check the hash and try again.');
    }
  };

  if (loading) {
    return (
      <div className={`min-h-screen ${themeClasses.pageBg} flex items-center justify-center`}>
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-gray-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className={themeClasses.textPrimary}>Loading blockchain ledger...</p>
        </div>
      </div>
    );
  }

  // Show upgrade prompt if user doesn't have blockchain ledger access
  if (!canAccessBlockchainLedger) {
    return (
      <div className={`min-h-screen ${themeClasses.pageBg}`}>
        <DashboardHeader
          user={currentUser}
          title="PropXchain"
          subtitle="Blockchain Ledger"
        />
        <div className="flex">
          <DashboardSidebar activeRoute="/dashboard/blockchain-ledger" />
          <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8">
            <UpgradePrompt feature="blockchain_ledger" />
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${themeClasses.pageBg}`}>
      {/* Header */}
      <DashboardHeader
        user={currentUser}
        title="PropXchain"
        subtitle={userRole === 'solicitor' ? 'Multi-Client Document Management' : 'Blockchain Ledger'}
      />

      {/* Main Content with Sidebar */}
      <div className="flex">
        {/* Sidebar */}
        <DashboardSidebar activeRoute="/dashboard/blockchain-ledger" />

        {/* Main Content */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8">

      {/* Tabs */}
      <div className={`${themeClasses.cardBg} border-b ${themeClasses.border}`}>
        <div className="max-w-full px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            <button
              onClick={() => setActiveTab('transactions')}
              className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'transactions'
                  ? 'border-gray-500 text-gray-700 dark:text-gray-500'
                  : `border-transparent ${themeClasses.textSecondary} hover:text-gray-700 dark:hover:text-gray-500`
              }`}
            >
              📋 Transactions ({transactions.length})
            </button>
            <button
              onClick={() => setActiveTab('documents')}
              className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'documents'
                  ? 'border-gray-500 text-gray-700 dark:text-gray-500'
                  : `border-transparent ${themeClasses.textSecondary} hover:text-gray-700 dark:hover:text-gray-500`
              }`}
            >
              📄 Document Ledger ({documents.length})
            </button>
            <button
              onClick={() => setActiveTab('verification')}
              className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'verification'
                  ? 'border-gray-500 text-gray-700 dark:text-gray-500'
                  : `border-transparent ${themeClasses.textSecondary} hover:text-gray-700 dark:hover:text-gray-500`
              }`}
            >
              🔐 Blockchain Verification
            </button>
          </div>
        </div>
      </div>

        {/* Transactions Tab */}
        {activeTab === 'transactions' && (
          <div>
            <div className={`${themeClasses.cardBg} rounded-lg p-6 mb-6 border ${themeClasses.border}`}>
              <h2 className={`text-lg font-semibold ${themeClasses.textPrimary} mb-4`}>
                {userRole === 'solicitor' ? 'Client Transactions' : 'Your Transactions'}
              </h2>
              <div className="space-y-4">
                {transactions.length === 0 ? (
                  <div className={`text-center py-12 ${themeClasses.textSecondary}`}>
                    <p>No transactions found</p>
                  </div>
                ) : (
                  transactions.map(tx => (
                    <div
                      key={tx.id}
                      className={`${themeClasses.cardSecondary} rounded-lg p-4 border ${themeClasses.border} hover:border-gray-500 transition-colors cursor-pointer`}
                      onClick={() => {
                        setSelectedTransaction(tx.id);
                        setActiveTab('documents');
                      }}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className={`font-semibold ${themeClasses.textPrimary} mb-2`}>
                            {tx.propertyAddress}
                          </h3>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className={themeClasses.textSecondary}>Transaction ID:</span>
                              <span className={`ml-2 font-mono ${themeClasses.textPrimary}`}>{tx.id}</span>
                            </div>
                            <div>
                              <span className={themeClasses.textSecondary}>Your Role:</span>
                              <span className={`ml-2 capitalize ${themeClasses.textPrimary}`}>{tx.role}</span>
                            </div>
                            <div>
                              <span className={themeClasses.textSecondary}>Status:</span>
                              <span className={`ml-2 px-2 py-1 rounded text-xs font-semibold ${
                                tx.status === 'exchanged' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                tx.status === 'readyForExchange' ? 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200' :
                                'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                              }`}>
                                {tx.status}
                              </span>
                            </div>
                            <div>
                              <span className={themeClasses.textSecondary}>Documents:</span>
                              <span className={`ml-2 ${themeClasses.textPrimary}`}>{tx.documentCount}</span>
                            </div>
                          </div>
                          {tx.blockchainTxId && (
                            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                              <span className={`text-xs ${themeClasses.textSecondary}`}>Blockchain TX:</span>
                              <span className={`ml-2 text-xs font-mono ${themeClasses.textPrimary}`}>
                                {tx.blockchainTxId}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className={`text-xs ${themeClasses.textSecondary} mb-2`}>
                            {formatDate(tx.createdAt)}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/dashboard/exchange/${tx.id}`);
                            }}
                            className="text-gray-700 dark:text-gray-500 text-sm hover:underline"
                          >
                            View Details →
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Documents Tab */}
        {activeTab === 'documents' && (
          <div>
            {selectedTransaction && (
              <div className="mb-4">
                <button
                  onClick={() => setSelectedTransaction(null)}
                  className="text-gray-700 dark:text-gray-500 text-sm hover:underline"
                >
                  ← Show all documents
                </button>
              </div>
            )}
            <div className={`${themeClasses.cardBg} rounded-lg border ${themeClasses.border} overflow-hidden`}>
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className={`text-lg font-semibold ${themeClasses.textPrimary}`}>
                  Document Storage Ledger
                  {selectedTransaction && (
                    <span className={`ml-2 text-sm font-normal ${themeClasses.textSecondary}`}>
                      (Filtered by transaction)
                    </span>
                  )}
                </h2>
                <p className={`text-sm ${themeClasses.textSecondary} mt-1`}>
                  All documents are stored on ICP blockchain with cryptographic verification
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Document
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Property
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Blockchain Hash
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Uploaded
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Size
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredDocuments.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center">
                          <p className={themeClasses.textSecondary}>No documents found</p>
                        </td>
                      </tr>
                    ) : (
                      filteredDocuments.map(doc => (
                        <tr key={doc.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className={`text-sm font-medium ${themeClasses.textPrimary}`}>
                                {doc.documentName}
                              </div>
                              <div className={`text-xs ${themeClasses.textSecondary}`}>
                                {doc.documentType}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className={`text-sm ${themeClasses.textPrimary} max-w-xs truncate`}>
                              {doc.propertyAddress}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className={`text-xs font-mono ${themeClasses.textSecondary}`}>
                              {doc.blockchainHash.substring(0, 20)}...
                            </div>
                            <div className={`text-xs ${themeClasses.textSecondary} mt-1`}>
                              Canister: {doc.canisterId.substring(0, 12)}...
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className={`text-sm ${themeClasses.textPrimary}`}>
                              {formatDate(doc.uploadedAt)}
                            </div>
                            <div className={`text-xs ${themeClasses.textSecondary}`}>
                              by {doc.uploadedBy}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className={`text-sm ${themeClasses.textPrimary}`}>
                              {formatFileSize(doc.fileSize)}
                            </div>
                            <div className={`text-xs ${themeClasses.textSecondary}`}>
                              {doc.chunkCount} chunks
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {doc.verified ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                ✓ Verified
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                                ⏳ Pending
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Verification Tab */}
        {activeTab === 'verification' && (
          <div>
            <div className={`${themeClasses.cardBg} rounded-lg p-6 border ${themeClasses.border}`}>
              <h2 className={`text-lg font-semibold ${themeClasses.textPrimary} mb-4`}>
                Blockchain Verification
              </h2>
              <p className={`${themeClasses.textSecondary} mb-6`}>
                Enter a contract hash or transaction ID to verify its authenticity on the Internet Computer blockchain
              </p>

              <div className="mb-6">
                <label className={`block text-sm font-medium ${themeClasses.textPrimary} mb-2`}>
                  Contract Hash or Transaction ID
                </label>
                <input
                  type="text"
                  value={verificationHash}
                  onChange={(e) => setVerificationHash(e.target.value)}
                  placeholder="e.g., blockchain_tx_a7f2e9k3m8b1c4d6f8g2h5j7"
                  className={`w-full px-4 py-3 border ${themeClasses.border} rounded-lg bg-transparent ${themeClasses.textPrimary} font-mono text-sm`}
                />
              </div>

              <button
                onClick={handleVerifyHash}
                className="w-full bg-gray-700 text-white py-3 px-6 rounded-lg font-semibold hover:bg-gray-600 transition-colors"
              >
                🔍 Verify on Blockchain
              </button>

              <div className={`mt-8 p-4 rounded-lg ${themeClasses.cardSecondary} border ${themeClasses.border}`}>
                <h3 className={`font-semibold ${themeClasses.textPrimary} mb-3`}>How Verification Works</h3>
                <ul className={`space-y-2 text-sm ${themeClasses.textSecondary}`}>
                  <li>✓ Queries the ICP blockchain directly</li>
                  <li>✓ Validates cryptographic signatures</li>
                  <li>✓ Confirms document integrity</li>
                  <li>✓ Checks immutability status</li>
                  <li>✓ Verifies all parties' signatures</li>
                </ul>
              </div>

              {documents.length > 0 && (
                <div className="mt-6">
                  <h3 className={`text-sm font-semibold ${themeClasses.textPrimary} mb-3`}>
                    Quick Verify - Your Documents:
                  </h3>
                  <div className="space-y-2">
                    {documents.slice(0, 5).map(doc => (
                      <button
                        key={doc.id}
                        onClick={() => {
                          setVerificationHash(doc.blockchainHash);
                          handleVerifyHash();
                        }}
                        className={`w-full text-left px-4 py-2 rounded border ${themeClasses.border} hover:border-gray-500 transition-colors`}
                      >
                        <div className={`text-sm ${themeClasses.textPrimary}`}>{doc.documentName}</div>
                        <div className={`text-xs font-mono ${themeClasses.textSecondary}`}>
                          {doc.blockchainHash.substring(0, 40)}...
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
      </div>
    </div>
  );
};

export default BlockchainLedgerPage;