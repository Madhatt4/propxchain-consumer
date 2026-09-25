import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useThemeClasses } from '../hooks/useThemeClasses';
import { icpService } from '../services/icp.service';
import { partyRoleService } from '../services/partyRole.service';
import { logger } from '@/utils/logger';
import { useAuthStore } from '../stores/authStore';
import TierToggle from '../components/admin/TierToggle';

interface MockUser {
  id: string;
  principal: string;
  name: string;
  email: string;
  mobile: string;
  username: string;
  userType: 'buyer' | 'seller' | 'solicitor';
  role: string;
  isActive: boolean;
}

interface MockTransaction {
  id: string;
  propertyAddress: string;
  propertyId: string;
  titleNumber: string;
  amount: number;
  status: string;
  buyer: string;
  seller: string;
  buyerSolicitor?: string;
  sellerSolicitor?: string;
  inviteCode?: string;
}

const AdminTestingPanel: React.FC = () => {
  const navigate = useNavigate();
  const themeClasses = useThemeClasses();
  const [activeUser, setActiveUser] = useState<MockUser | null>(null);
  const [mockUsers, setMockUsers] = useState<MockUser[]>([]);
  const [mockTransaction, setMockTransaction] = useState<MockTransaction | null>(null);
  const [testingLog, setTestingLog] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const authState = useAuthStore.getState();
    const principalId = authState.principalId;
    if (!principalId || !authState.isAuthenticated) {
      navigate('/login');
      return;
    }

    // Check admin access via the user_management `admins` stable map
    // (single source of truth, orthogonal to userType).
    const checkAdminAccess = async () => {
      try {
        await icpService.initialize();
        const isAdmin = await (await icpService.requireUserManagement()).amIAdmin();

        if (!isAdmin) {
          alert('Access Denied: Admin privileges required');
          navigate('/dashboard');
          return;
        }
      } catch (error) {
        logger.error('Admin access check error:', error);
        navigate('/dashboard');
      }
    };

    checkAdminAccess();

    initializeMockData();
  }, [navigate]);

  const initializeMockData = () => {
    // Create mock users with valid ICP principals
    // These are actual valid principal IDs (anonymous principals for testing)
    const users: MockUser[] = [
      {
        id: 'BUYER-001',
        principal: '2vxsx-fae', // Anonymous principal 1
        name: 'Alice Thompson',
        email: 'alice.thompson@example.com',
        mobile: '+44 7700 900123',
        username: 'alice_buyer',
        userType: 'buyer',
        role: 'Buyer',
        isActive: false,
      },
      {
        id: 'SELLER-001',
        principal: 'aaaaa-aa', // Anonymous principal 2 (management canister)
        name: 'Bob Martinez',
        email: 'bob.martinez@example.com',
        mobile: '+44 7700 900456',
        username: 'bob_seller',
        userType: 'seller',
        role: 'Seller',
        isActive: false,
      },
      {
        id: 'SOLICITOR-BUYER-001',
        principal: 'rrkah-fqaaa-aaaaa-aaaaq-cai', // Valid canister principal
        name: 'Catherine Law (Buyer\'s Solicitor)',
        email: 'catherine.law@smithlawfirm.co.uk',
        mobile: '+44 20 7946 0958',
        username: 'catherine_solicitor',
        userType: 'solicitor',
        role: 'Buyer\'s Solicitor',
        isActive: false,
      },
      {
        id: 'SOLICITOR-SELLER-001',
        principal: 'ryjl3-tyaaa-aaaaa-aaaba-cai', // Valid canister principal
        name: 'David Williams (Seller\'s Solicitor)',
        email: 'david.williams@joneslegal.co.uk',
        mobile: '+44 20 7946 0987',
        username: 'david_solicitor',
        userType: 'solicitor',
        role: 'Seller\'s Solicitor',
        isActive: false,
      },
    ];

    setMockUsers(users);
    addLog('✅ Mock users initialized with valid ICP principals');
  };

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setTestingLog(prev => [`[${timestamp}] ${message}`, ...prev]);
  };

  const switchUser = (user: MockUser) => {
    // Update active user
    const updatedUsers = mockUsers.map(u => ({
      ...u,
      isActive: u.id === user.id,
    }));
    setMockUsers(updatedUsers);
    setActiveUser(user);

    // Update localStorage to simulate this user being logged in
    const mockUserData = {
      id: user.id,
      principal: user.principal,
      firstName: user.name.split(' ')[0],
      lastName: user.name.split(' ').slice(1).join(' '),
      email: user.email,
      mobile: user.mobile,
      // `username` is not on the canister UserProfile — always undefined here.
      userType: user.userType,
      role: user.role,
    };

    localStorage.setItem('user', JSON.stringify(mockUserData));
    localStorage.setItem('testMode', 'true');
    localStorage.setItem('testModeRole', user.role);

    addLog(`🔄 Switched to: ${user.name} (${user.role})`);
  };

  const createMockProperty = async () => {
    setLoading(true);
    addLog('🏠 Creating mock property on ICP blockchain...');

    try {
      // Create property on blockchain via Property Registry canister
      const propertyData = {
        address: '123 Blockchain Avenue, Test Town, London',
        price: 450000,
        size: 1850,
        propertyType: 'freehold',
        description: 'Mock property for testing transaction signing flow',
      };

      const result = await icpService.registerProperty(propertyData);

      if (result.propertyId) {
        addLog(`✅ Property registered on blockchain - ID: ${result.propertyId}`);
        return result.propertyId.toString();
      } else {
        throw new Error('No property ID returned');
      }
    } catch (error: any) {
      addLog(`❌ Failed to create property: ${error.message}`);
      logger.error('Property creation error:', error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const createMockTransaction = async () => {
    if (!mockUsers.length) {
      addLog('❌ No mock users available');
      return;
    }

    setLoading(true);
    addLog('📝 Creating complete mock transaction on ICP blockchain...');

    try {
      // Step 1: Create property
      const propertyId = await createMockProperty();
      if (!propertyId) {
        addLog('❌ Cannot create transaction without property');
        setLoading(false);
        return;
      }

      // Step 2: Get current user's real principal (logged in as admin)
      const currentUserPrincipal = await icpService.getUserPrincipal();
      addLog(`👤 Using your Internet Identity as buyer: ${currentUserPrincipal}`);

      // Get mock seller (with valid principal)
      const seller = mockUsers.find(u => u.userType === 'seller');

      if (!seller) {
        addLog('❌ Seller not found');
        setLoading(false);
        return;
      }

      // Step 3: Create transaction on blockchain
      // The transaction will be created by the current logged-in user (you)
      addLog('💰 Creating transaction on ICP blockchain...');

      const transactionData = {
        propertyId: propertyId.toString(),
        propertyAddress: '123 Blockchain Avenue, Test Town, London',
        postcode: 'SW1A 1AA',
        titleNumber: 'TEST123456',
        previousOwner: 'Previous Owner Ltd',
        amount: 450000,
        transactionType: 'sale',
        userRole: 'buyer',
        propertyType: 'freehold',
        propertyCategory: 'residential',
        mode: 'full-service',
        deposit: 45000,
        mortgageAmount: 360000,
        completionDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        seller: seller.principal, // Pass seller's mock principal
      };

      addLog(`📊 Transaction: Buyer=YOU (${currentUserPrincipal}), Seller=${seller.principal}`);

      // Create transaction on blockchain
      const txResult = await icpService.createTransaction(transactionData);

      if (txResult.success && txResult.transactionId) {
        addLog(`✅ Transaction created on blockchain - ID: ${txResult.transactionId}`);

        // You are the on-chain buyer of this mock deal; the chain-verified writer
        // records that off-chain (nobody invites you to your own deal).
        void partyRoleService.recordRoleFromChain(String(txResult.transactionId));

        // Get the transaction to retrieve invite code (pass string ID directly)
        const createdTx = await icpService.getTransaction(txResult.transactionId);

        if (createdTx) {
          const mockTx: MockTransaction = {
            id: txResult.transactionId.toString(),
            propertyAddress: transactionData.propertyAddress,
            propertyId: propertyId,
            titleNumber: transactionData.titleNumber,
            amount: transactionData.amount,
            status: 'active',
            buyer: currentUserPrincipal,
            seller: seller.principal,
            inviteCode: createdTx.inviteCode || undefined,
          };

          setMockTransaction(mockTx);

          addLog(`✅ Mock transaction created successfully`);
          addLog(`📤 Invite Code: ${createdTx.inviteCode || 'N/A'}`);
          addLog(`🔗 Share this invite code with other parties to join the transaction`);
        }
      }

    } catch (error: any) {
      addLog(`❌ Failed to create transaction: ${error.message}`);
      logger.error('Transaction creation error:', error);
    } finally {
      setLoading(false);
    }
  };

  const joinTransactionAsUser = async (user: MockUser) => {
    if (!mockTransaction || !mockTransaction.inviteCode) {
      addLog('❌ No transaction or invite code available');
      return;
    }

    setLoading(true);
    addLog(`🔗 ${user.name} joining transaction with invite code...`);

    try {
      // Switch to this user
      switchUser(user);

      // Join transaction via invite code
      const result = await icpService.joinTransactionByInviteCode(mockTransaction.inviteCode);

      if (result) {
        addLog(`✅ ${user.name} successfully joined the transaction`);
        addLog(`🎉 ${user.name} can now sign the transaction`);
      }
    } catch (error: any) {
      addLog(`❌ Failed to join transaction: ${error.message}`);
      logger.error('Join transaction error:', error);
    } finally {
      setLoading(false);
    }
  };

  const viewTransactionPage = () => {
    if (!mockTransaction) {
      alert('No mock transaction created yet');
      return;
    }

    // Navigate to transaction detail page
    navigate(`/transaction/${mockTransaction.id}`);
  };

  const viewExchangePage = () => {
    if (!mockTransaction) {
      alert('No mock transaction created yet');
      return;
    }

    // Navigate to exchange signing page
    navigate(`/exchange/${mockTransaction.id}`);
  };

  const resetTestMode = () => {
    if (confirm('Reset all test data? This will clear mock users and transactions.')) {
      setMockTransaction(null);
      setActiveUser(null);
      localStorage.removeItem('testMode');
      localStorage.removeItem('testModeRole');
      initializeMockData();
      setTestingLog([]);
      addLog('🔄 Test mode reset');
    }
  };

  return (
    <div className={`min-h-screen ${themeClasses.pageBg}`}>
      {/* Header */}
      <header className={themeClasses.headerBg}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <h1 className={`text-2xl font-bold ${themeClasses.headerText}`}>
                🧪 PropXchain Testing Panel
              </h1>
              <span className="px-3 py-1 bg-purple-600 text-white text-xs font-bold rounded-full">
                TEST MODE
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/admin')}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                ← Admin Dashboard
              </button>
              <button
                onClick={resetTestMode}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Reset Test
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - User Management */}
          <div>
            {/* Subscription Tier toggle — see what premium gates (Move Narrator,
                premium NextStepCard behaviour, analytics) without re-logging. */}
            <div className={`${themeClasses.cardBg} rounded-lg p-6 border ${themeClasses.border} mb-6`}>
              <h2 className={`text-xl font-bold ${themeClasses.textPrimary} mb-4`}>
                Subscription Tier
              </h2>
              <TierToggle />
            </div>

            {/* Active User Card */}
            <div className={`${themeClasses.cardBg} rounded-lg p-6 border ${themeClasses.border} mb-6`}>
              <h2 className={`text-xl font-bold ${themeClasses.textPrimary} mb-4`}>
                Active User
              </h2>
              {activeUser ? (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center text-white font-bold text-xl">
                      {activeUser.name.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <p className="text-gray-900 dark:text-white font-bold">{activeUser.name}</p>
                      <p className="text-green-700 dark:text-green-300 text-sm">{activeUser.role}</p>
                      <p className="text-green-700 dark:text-green-400 text-xs font-mono">{activeUser.principal}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className={themeClasses.textSecondary}>No user selected. Switch to a mock user below.</p>
              )}
            </div>

            {/* Mock Users */}
            <div className={`${themeClasses.cardBg} rounded-lg p-6 border ${themeClasses.border}`}>
              <h2 className={`text-xl font-bold ${themeClasses.textPrimary} mb-4`}>
                Mock Users
              </h2>
              <div className="space-y-3">
                {mockUsers.map((user) => (
                  <div
                    key={user.id}
                    className={`p-4 rounded-lg border cursor-pointer transition-all ${
                      user.isActive
                        ? 'bg-gray-200 dark:bg-gray-800/30 border-gray-400 dark:border-gray-500'
                        : 'bg-gray-100 dark:bg-gray-700/30 border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                    }`}
                    onClick={() => switchUser(user)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                          user.userType === 'buyer' ? 'bg-green-600' :
                          user.userType === 'seller' ? 'bg-gray-700' :
                          'bg-purple-600'
                        }`}>
                          {user.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-gray-900 dark:text-white font-medium">{user.name}</p>
                          <p className="text-gray-600 dark:text-gray-400 text-sm">{user.role}</p>
                          <p className="text-gray-500 dark:text-gray-400 text-xs">{user.email}</p>
                        </div>
                      </div>
                      {user.isActive && (
                        <span className="px-2 py-1 bg-green-600 text-white text-xs rounded-full">
                          Active
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column - Transaction Management */}
          <div>
            {/* Transaction Actions */}
            <div className={`${themeClasses.cardBg} rounded-lg p-6 border ${themeClasses.border} mb-6`}>
              <h2 className={`text-xl font-bold ${themeClasses.textPrimary} mb-4`}>
                Transaction Setup
              </h2>

              <div className="space-y-3">
                <button
                  onClick={createMockTransaction}
                  disabled={loading}
                  className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed font-medium transition-colors"
                >
                  {loading ? (
                    <span className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Creating on blockchain...
                    </span>
                  ) : (
                    '🏠 Create Mock Property & Transaction (On-Chain)'
                  )}
                </button>

                {mockTransaction && (
                  <>
                    <button
                      onClick={viewTransactionPage}
                      className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 font-medium"
                    >
                      📋 View Transaction Details
                    </button>

                    <button
                      onClick={viewExchangePage}
                      className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
                    >
                      ✍️ Go to Exchange Signing Page
                    </button>

                    <div className="border-t border-gray-300 dark:border-gray-600 pt-3 mt-3">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Join Transaction As:</p>
                      {mockUsers.filter(u => u.id !== activeUser?.id).map((user) => (
                        <button
                          key={user.id}
                          onClick={() => joinTransactionAsUser(user)}
                          disabled={loading}
                          className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-600 mb-2 text-sm"
                        >
                          {user.name}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Mock Transaction Details */}
            {mockTransaction && (
              <div className={`${themeClasses.cardBg} rounded-lg p-6 border ${themeClasses.border} mb-6`}>
                <h2 className={`text-xl font-bold ${themeClasses.textPrimary} mb-4`}>
                  Mock Transaction
                </h2>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Transaction ID:</span>
                    <span className="text-gray-900 dark:text-white font-mono">{mockTransaction.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Property:</span>
                    <span className="text-gray-900 dark:text-white">{mockTransaction.propertyAddress}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Title Number:</span>
                    <span className="text-gray-900 dark:text-white">{mockTransaction.titleNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Amount:</span>
                    <span className="text-gray-900 dark:text-white font-bold">£{mockTransaction.amount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Status:</span>
                    <span className="px-2 py-1 bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded text-xs">
                      {mockTransaction.status}
                    </span>
                  </div>
                  {mockTransaction.inviteCode && (
                    <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded">
                      <p className="text-yellow-700 dark:text-yellow-300 text-xs mb-1">Invite Code:</p>
                      <p className="text-yellow-900 dark:text-yellow-100 font-mono font-bold">{mockTransaction.inviteCode}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Testing Log */}
            <div className={`${themeClasses.cardBg} rounded-lg p-6 border ${themeClasses.border}`}>
              <h2 className={`text-xl font-bold ${themeClasses.textPrimary} mb-4`}>
                Testing Log
              </h2>
              <div className="bg-gray-100 dark:bg-gray-900 rounded p-4 h-64 overflow-y-auto font-mono text-xs">
                {testingLog.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400">No activity yet...</p>
                ) : (
                  testingLog.map((log, index) => (
                    <div key={index} className="text-gray-700 dark:text-gray-300 mb-1">
                      {log}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Testing Instructions */}
        <div className={`${themeClasses.cardBg} rounded-lg p-6 border ${themeClasses.border} mt-6`}>
          <h2 className={`text-xl font-bold ${themeClasses.textPrimary} mb-4`}>
            📖 Testing Instructions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h3 className="text-gray-900 dark:text-white font-semibold mb-2">1. Create Transaction</h3>
              <p className={themeClasses.textSecondary}>
                Click "Create Mock Property & Transaction" to create a complete transaction on the ICP blockchain.
                This creates a real property and transaction in the canisters.
              </p>
            </div>
            <div>
              <h3 className="text-gray-900 dark:text-white font-semibold mb-2">2. Switch Users</h3>
              <p className={themeClasses.textSecondary}>
                Click on any mock user to switch roles. This simulates different users accessing the platform.
              </p>
            </div>
            <div>
              <h3 className="text-gray-900 dark:text-white font-semibold mb-2">3. Join Transaction</h3>
              <p className={themeClasses.textSecondary}>
                Use "Join Transaction As" buttons to add other parties to the transaction using the invite code.
              </p>
            </div>
            <div>
              <h3 className="text-gray-900 dark:text-white font-semibold mb-2">4. Sign Contract</h3>
              <p className={themeClasses.textSecondary}>
                Navigate to the Exchange Signing Page and sign as each party. Test the complete signing flow.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminTestingPanel;
