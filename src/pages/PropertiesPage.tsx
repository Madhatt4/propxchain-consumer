import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardSidebar from '../components/navigation/DashboardSidebar';
import DashboardHeader from '../components/navigation/DashboardHeader';
import { logger } from '@/utils/logger';
import { useAuthStore } from '../stores/authStore';
import { useThemeClasses } from '@/hooks/useThemeClasses';
/** Brand primary action — PropXchain teal (--px-primary / --px-primary-hover). */
const PRIMARY_BTN = 'bg-[#0D9488] text-white hover:bg-[#0F766E]';

const PropertiesPage: React.FC = () => {
  const navigate = useNavigate();
  const t = useThemeClasses();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);

  useEffect(() => {
    const loadData = async () => {
      // Check authentication
      const authState = useAuthStore.getState();
      const principalId = authState.principalId;
      if (!principalId || !authState.isAuthenticated) {
        navigate('/login');
        return;
      }
      const currentUser = { principal: principalId, id: principalId };
      setUser(currentUser);

      try {
        // Load transactions from blockchain
        const { icpService } = await import('../services/icp.service');
        const allTransactions = await icpService.getAllTransactions();
        const userId = currentUser.principal || currentUser.id; // Use principal for ICP auth

        const userTransactions = Array.isArray(allTransactions)
          ? allTransactions.filter((tx: any) =>
              tx.createdBy === userId ||
              tx.seller === userId ||
              tx.buyer === userId ||
              tx.accessList?.includes(userId)
            )
          : [];

        setTransactions(userTransactions);

        // Auto-select first transaction
        if (userTransactions.length > 0) {
          setSelectedTransaction(userTransactions[0]);
        }
      } catch (error) {
        logger.error('Error loading transactions from blockchain:', error);
        // Fallback to localStorage
        const allTransactions = JSON.parse(localStorage.getItem('transactions') || '[]');
        const userId = currentUser.principal || currentUser.id;
        const userTransactions = Array.isArray(allTransactions)
          ? allTransactions.filter((tx: any) => tx.createdBy === userId)
          : [];
        setTransactions(userTransactions);

        if (userTransactions.length > 0) {
          setSelectedTransaction(userTransactions[0]);
        }
      }
    };

    loadData();
  }, [navigate]);

  const fieldLabel = `block text-sm font-medium ${t.textSecondary} mb-1`;

  return (
    <div className={`min-h-screen ${t.pageBg}`}>
      {/* Header */}
      <DashboardHeader
        user={user}
        title="PropXchain"
        subtitle="Property Details"
      />

      {/* Main Content with Sidebar */}
      <div className="flex">
        {/* Sidebar */}
        <DashboardSidebar activeRoute="/dashboard/properties" />

        {/* Main Content */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8">
        <h2 className={`font-display text-2xl font-bold ${t.textPrimary} mb-6`}>Property Details</h2>

        {transactions.length === 0 ? (
          <div className={`${t.cardBg} rounded-lg p-12 text-center`}>
            <p className={`${t.textPrimary} text-lg mb-4`}>No properties found</p>
            <p className={`${t.textSecondary} mb-6`}>Complete the wizard to create your first transaction.</p>
            <button
              onClick={() => navigate('/create-transaction')}
              className={`px-6 py-3 ${PRIMARY_BTN} rounded-lg font-medium transition-colors`}
            >
              Start New Transaction
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Transaction Selector */}
            <div className="lg:col-span-1">
              <div className={`${t.cardBg} rounded-lg p-4`}>
                <h3 className={`font-data text-xs font-semibold ${t.textSecondary} uppercase tracking-wider mb-4`}>Your Properties</h3>
                <div className="space-y-2">
                  {transactions.map((tx) => (
                    <button
                      key={tx.id}
                      onClick={() => setSelectedTransaction(tx)}
                      className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                        selectedTransaction?.id === tx.id
                          ? PRIMARY_BTN
                          : `${t.textPrimary} hover:bg-black/5 dark:hover:bg-white/5`
                      }`}
                    >
                      <div className="font-medium text-sm truncate">{tx.propertyAddress}</div>
                      <div className="text-xs opacity-75 capitalize">{tx.transactionType}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Property Details */}
            <div className="lg:col-span-3">
              {selectedTransaction ? (
                <div className="space-y-6">
                {!selectedTransaction.wizardData ? (
                  <div className={`${t.cardBg} rounded-lg p-6`}>
                    <div className="text-center py-12">
                      <svg className={`w-16 h-16 mx-auto ${t.textSecondary} mb-4`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <h3 className={`font-display text-xl font-semibold ${t.textPrimary} mb-2`}>Limited Transaction Details</h3>
                      <p className={`${t.textSecondary} mb-4`}>This transaction was created directly on the blockchain without wizard data.</p>
                      <div className={`${t.cardSecondary} rounded-lg p-4 max-w-md mx-auto text-left`}>
                        <div className="space-y-3">
                          <div>
                            <label className={fieldLabel}>Transaction ID</label>
                            <p className={`${t.textPrimary} font-data text-sm`}>{selectedTransaction.id}</p>
                          </div>
                          <div>
                            <label className={fieldLabel}>Property Address</label>
                            <p className={t.textPrimary}>{selectedTransaction.propertyAddress || 'N/A'}</p>
                          </div>
                          <div>
                            <label className={fieldLabel}>Amount</label>
                            <p className={t.textPrimary}>£{(selectedTransaction.amount || 0).toLocaleString()}</p>
                          </div>
                          <div>
                            <label className={fieldLabel}>Status</label>
                            <p className={`${t.textPrimary} capitalize`}>{selectedTransaction.status || 'pending'}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                <div className={`${t.cardBg} rounded-lg p-6`}>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className={`font-display text-xl font-bold ${t.textPrimary}`}>{selectedTransaction.propertyAddress}</h3>
                    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                      selectedTransaction.mode === 'diy' ? 'bg-[#CCFBF1] text-[#0F766E]' :
                      selectedTransaction.mode === 'hybrid' ? 'bg-[#DAE5DC] text-[#5F8A68]' :
                      'bg-purple-100 text-purple-800'
                    }`}>
                      {selectedTransaction.mode === 'diy' ? 'DIY' : selectedTransaction.mode === 'hybrid' ? 'Hybrid' : 'Professional'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Basic Information */}
                    <div className="space-y-4">
                      <h4 className={`font-display text-lg font-semibold ${t.textPrimary} border-b ${t.border} pb-2`}>Basic Information</h4>

                      <div>
                        <label className={fieldLabel}>Transaction Type</label>
                        <p className={`${t.textPrimary} capitalize`}>{selectedTransaction.transactionType}</p>
                      </div>

                      <div>
                        <label className={fieldLabel}>Property Address</label>
                        <p className={t.textPrimary}>{selectedTransaction.propertyAddress}</p>
                      </div>

                      {selectedTransaction.wizardData?.ta6Data?.titleNumber && (
                        <div>
                          <label className={fieldLabel}>Title Number</label>
                          <p className={t.textPrimary}>{selectedTransaction.wizardData.ta6Data.titleNumber}</p>
                        </div>
                      )}

                      {selectedTransaction.wizardData?.ta6Data?.propertyType && (
                        <div>
                          <label className={fieldLabel}>Property Type</label>
                          <p className={`${t.textPrimary} capitalize`}>{selectedTransaction.wizardData.ta6Data.propertyType}</p>
                        </div>
                      )}

                      {selectedTransaction.wizardData?.ta6Data?.tenure && (
                        <div>
                          <label className={fieldLabel}>Tenure</label>
                          <p className={`${t.textPrimary} capitalize`}>{selectedTransaction.wizardData.ta6Data.tenure}</p>
                        </div>
                      )}
                    </div>

                    {/* Financial Information */}
                    <div className="space-y-4">
                      <h4 className={`font-display text-lg font-semibold ${t.textPrimary} border-b ${t.border} pb-2`}>Financial Information</h4>

                      <div>
                        <label className={fieldLabel}>Purchase Price</label>
                        <p className={`${t.textPrimary} text-2xl font-bold`}>
                          £{(selectedTransaction.financialTerms?.purchasePrice || selectedTransaction.amount || 0).toLocaleString()}
                        </p>
                      </div>

                      {selectedTransaction.financialTerms?.deposit && (
                        <div>
                          <label className={fieldLabel}>Deposit</label>
                          <p className={t.textPrimary}>£{selectedTransaction.financialTerms.deposit.toLocaleString()}</p>
                        </div>
                      )}

                      {selectedTransaction.financialTerms?.completionDate && (
                        <div>
                          <label className={fieldLabel}>Completion Date</label>
                          <p className={t.textPrimary}>{new Date(selectedTransaction.financialTerms.completionDate).toLocaleDateString()}</p>
                        </div>
                      )}

                      <div>
                        <label className={fieldLabel}>Status</label>
                        <p className={`${t.textPrimary} capitalize`}>{selectedTransaction.status.replace('-', ' ')}</p>
                      </div>
                    </div>

                    {/* Additional Details from TA6 */}
                    {selectedTransaction.wizardData?.ta6Data && (
                      <div className="md:col-span-2 space-y-4">
                        <h4 className={`font-display text-lg font-semibold ${t.textPrimary} border-b ${t.border} pb-2`}>Property Characteristics</h4>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {selectedTransaction.wizardData.ta6Data.boundaries !== undefined && (
                            <div>
                              <label className={fieldLabel}>Known Boundaries</label>
                              <p className={t.textPrimary}>{selectedTransaction.wizardData.ta6Data.boundaries ? 'Yes' : 'No'}</p>
                            </div>
                          )}

                          {selectedTransaction.wizardData.ta6Data.disputes !== undefined && (
                            <div>
                              <label className={fieldLabel}>Known Disputes</label>
                              <p className={t.textPrimary}>{selectedTransaction.wizardData.ta6Data.disputes ? 'Yes' : 'No'}</p>
                            </div>
                          )}

                          {selectedTransaction.wizardData.ta6Data.notices !== undefined && (
                            <div>
                              <label className={fieldLabel}>Notices Received</label>
                              <p className={t.textPrimary}>{selectedTransaction.wizardData.ta6Data.notices ? 'Yes' : 'No'}</p>
                            </div>
                          )}

                          {selectedTransaction.wizardData.ta6Data.alterations !== undefined && (
                            <div>
                              <label className={fieldLabel}>Alterations Made</label>
                              <p className={t.textPrimary}>{selectedTransaction.wizardData.ta6Data.alterations ? 'Yes' : 'No'}</p>
                            </div>
                          )}

                          {selectedTransaction.wizardData.ta6Data.guarantees !== undefined && (
                            <div>
                              <label className={fieldLabel}>Guarantees/Warranties</label>
                              <p className={t.textPrimary}>{selectedTransaction.wizardData.ta6Data.guarantees ? 'Yes' : 'No'}</p>
                            </div>
                          )}

                          {selectedTransaction.wizardData.ta6Data.insurance !== undefined && (
                            <div>
                              <label className={fieldLabel}>Building Insurance</label>
                              <p className={t.textPrimary}>{selectedTransaction.wizardData.ta6Data.insurance ? 'Yes' : 'No'}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Transaction Timeline */}
                    <div className="md:col-span-2 space-y-4">
                      <h4 className={`font-display text-lg font-semibold ${t.textPrimary} border-b ${t.border} pb-2`}>Transaction Timeline</h4>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className={fieldLabel}>Created</label>
                          <p className={t.textPrimary}>{new Date(selectedTransaction.createdAt).toLocaleString()}</p>
                        </div>

                        <div>
                          <label className={fieldLabel}>Last Updated</label>
                          <p className={t.textPrimary}>{new Date(selectedTransaction.updatedAt).toLocaleString()}</p>
                        </div>

                        {selectedTransaction.milestones && Array.isArray(selectedTransaction.milestones) && selectedTransaction.milestones.length > 0 && (
                          <div>
                            <label className={fieldLabel}>Progress</label>
                            <div className="flex items-center gap-3">
                              <div className={`flex-1 ${t.progressBarTrack} rounded-full h-2`}>
                                <div
                                  className="bg-[#0D9488] h-2 rounded-full transition-all"
                                  style={{ width: `${(selectedTransaction.milestones.filter((m: any) => m.status === 'completed').length / selectedTransaction.milestones.length) * 100}%` }}
                                ></div>
                              </div>
                              <span className={`${t.textPrimary} text-sm font-medium`}>
                                {Math.round((selectedTransaction.milestones.filter((m: any) => m.status === 'completed').length / selectedTransaction.milestones.length) * 100)}%
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className={`md:col-span-2 flex gap-4 pt-4 border-t ${t.border}`}>
                      <button
                        onClick={() => navigate(`/transaction/${selectedTransaction.id}`)}
                        className={`px-6 py-3 ${PRIMARY_BTN} rounded-lg font-medium transition-colors`}
                      >
                        View Full Transaction
                      </button>
                      <button
                        onClick={() => navigate('/dashboard')}
                        className={`px-6 py-3 ${t.btnSecondary} rounded-lg font-medium transition-colors`}
                      >
                        Back to Dashboard
                      </button>
                    </div>
                  </div>
                </div>
                )}
                </div>
              ) : (
                <div className={`${t.cardBg} rounded-lg p-12 text-center`}>
                  <p className={t.textSecondary}>Select a property from the list to view details</p>
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

export default PropertiesPage;
