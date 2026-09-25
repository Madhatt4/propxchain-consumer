import React, { useState, useEffect, useRef } from 'react';
import { X, Sparkles } from 'lucide-react';
import { logger } from '../../utils/logger';
import { getStorePrincipalId } from '../../stores/authStore';
import { oscarService } from '../../services/oscar/oscarService';
import { icpService } from '../../services/icp.service';
import { OscarMessage } from './OscarMessage';
import { OscarInput } from './OscarInput';
import { OscarSuggestions } from './OscarSuggestions';
import type { Message, ChatResponse, TransactionSummaryInput } from '../../types/oscar.types';

interface ConversationContext {
  type?: 'transaction' | 'document' | 'message';
  id?: string;
  title?: string;
}

interface OscarChatWindowProps {
  messages: Message[];
  onSendMessage: (message: Message) => void;
  context: ConversationContext | null;
  onClearContext: () => void;
  conversationId: string | null;
  isNewConversation: boolean;
  initialDocumentId?: number;
}

interface DocumentOption {
  id: number;
  fileName: string;
  docType: string;
  contentType: string;
  transactionId?: string;
  propertyAddress?: string;
}

const OscarChatWindow: React.FC<OscarChatWindowProps> = ({
  messages,
  onSendMessage,
  context,
  onClearContext,
  initialDocumentId,
}) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [userTransactions, setUserTransactions] = useState<TransactionSummaryInput[]>([]);
  const [allUserDocuments, setAllUserDocuments] = useState<DocumentOption[]>([]);
  const [availableDocuments, setAvailableDocuments] = useState<DocumentOption[]>([]);
  const [, setSelectedDocument] = useState<DocumentOption | null>(null);
  const [initialDocHandled, setInitialDocHandled] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Initialize Oscar service on mount
  useEffect(() => {
    initializeOscar();
  }, []);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const initializeOscar = async () => {
    try {
      await oscarService.initialize();
      setIsInitialized(true);
      logger.info('Oscar service initialized successfully');

      // Load user transactions for context, then load all their documents
      const txs = await loadUserTransactions();
      if (txs && txs.length > 0) {
        await loadAllUserDocuments(txs);
      }
    } catch (err) {
      logger.error('Failed to initialize Oscar service:', err);
      setError('Failed to connect to Oscar. Please try again later.');
    }
  };

  const loadUserTransactions = async (): Promise<TransactionSummaryInput[]> => {
    try {
      await icpService.initialize();
      const principalId = getStorePrincipalId();

      if (!principalId) {
        logger.warn('No principal ID found, cannot load transactions for Oscar');
        return [];
      }

      // Get all transactions and filter for the current user
      const allTxs = await icpService.getAllTransactions();

      // Filter transactions where user is buyer, seller, or creator
      const userTxs = allTxs.filter((tx: any) =>
        tx.buyer?.toString() === principalId ||
        tx.seller?.toString() === principalId ||
        tx.createdBy?.toString() === principalId
      );

      // Convert to TransactionSummaryInput format
      const summaries: TransactionSummaryInput[] = userTxs.map((tx: any) => {
        // Calculate days active
        const createdAt = Number(tx.createdAt) / 1_000_000; // Convert nanoseconds to milliseconds
        const now = Date.now();
        const daysActive = Math.floor((now - createdAt) / (24 * 60 * 60 * 1000));

        // Determine user's role
        let role = 'party';
        if (tx.buyer?.toString() === principalId) role = 'buyer';
        else if (tx.seller?.toString() === principalId) role = 'seller';
        else if (tx.solicitor?.toString() === principalId) role = 'solicitor';

        // Determine phase from status
        let phase = 1;
        const status = tx.status ? Object.keys(tx.status)[0] : 'active';
        if (status === 'exchanged') phase = 4;
        else if (status === 'completion_initiated') phase = 5;
        else if (status === 'blockchain_completed' || status === 'land_registry_registered') phase = 6;

        // Calculate alert level
        let alertLevel = 'green';
        if (daysActive > 90) alertLevel = 'red';
        else if (daysActive > 45) alertLevel = 'amber';

        // Extract document counts if available
        const docs = tx.documents || [];
        const uploadedDocs = docs.filter((d: any) => d.status === 'uploaded' || d.hash).length;
        const verifiedDocs = docs.filter((d: any) => d.status === 'verified' || d.verified).length;
        const pendingDocs = Math.max(0, docs.length - verifiedDocs);

        // Extract milestone info if available
        const milestones = tx.milestones || [];
        const completedMilestones = milestones.filter((m: any) => m.completed || m.status === 'completed').length;
        const inProgressMilestones = milestones.filter((m: any) => m.status === 'in_progress').length;
        const nextMilestone = milestones.find((m: any) => !m.completed && m.status !== 'completed');

        // Extract parties info
        const parties = tx.parties || [];
        const hasSolicitor = !!(tx.solicitor || parties.some((p: any) => p.role === 'solicitor'));

        return {
          id: tx.id,
          propertyAddress: tx.propertyAddress || 'Unknown',
          status,
          phase,
          role,
          daysActive,
          alertLevel,
          amount: tx.amount ? Number(tx.amount) : undefined,
          postcode: tx.postcode || undefined,
          propertyType: tx.propertyType ? (typeof tx.propertyType === 'object' ? Object.keys(tx.propertyType)[0] : tx.propertyType) : undefined,
          transactionType: tx.transactionType ? (typeof tx.transactionType === 'object' ? Object.keys(tx.transactionType)[0] : tx.transactionType) : undefined,
          mode: tx.mode ? (typeof tx.mode === 'object' ? Object.keys(tx.mode)[0] : tx.mode) : undefined,
          titleNumber: tx.titleNumber || undefined,
          inviteCode: tx.inviteCode || undefined,
          createdAt: createdAt > 0 ? new Date(createdAt).toISOString() : undefined,
          deposit: tx.deposit ? Number(tx.deposit) : undefined,
          mortgageAmount: tx.mortgageAmount ? Number(tx.mortgageAmount) : undefined,
          documentSummary: docs.length > 0 ? {
            total: docs.length,
            uploaded: uploadedDocs,
            verified: verifiedDocs,
            pending: pendingDocs,
          } : undefined,
          milestonesSummary: milestones.length > 0 ? {
            total: milestones.length,
            completed: completedMilestones,
            inProgress: inProgressMilestones,
            nextMilestone: nextMilestone?.name || nextMilestone?.title || undefined,
          } : undefined,
          partiesCount: parties.length || undefined,
          hasSolicitor,
        };
      });

      setUserTransactions(summaries);
      logger.info(`Loaded ${summaries.length} transactions for Oscar context`);
      return summaries;
    } catch (err) {
      logger.error('Failed to load transactions for Oscar:', err);
      return [];
    }
  };

  // Filter available documents when transaction context changes
  useEffect(() => {
    if (context?.type === 'transaction' && context.id) {
      const filtered = allUserDocuments.filter(doc => doc.transactionId === context.id);
      setAvailableDocuments(filtered);
    } else {
      // No context: show all user documents
      setAvailableDocuments(allUserDocuments);
    }
    setSelectedDocument(null);
  }, [context?.id, allUserDocuments]);

  // Auto-select initial document from URL params
  useEffect(() => {
    if (initialDocumentId && availableDocuments.length > 0 && !initialDocHandled) {
      const match = availableDocuments.find(d => d.id === initialDocumentId);
      if (match) {
        setSelectedDocument(match);
        setInput('Please check this document');
        setInitialDocHandled(true);
      }
    }
  }, [initialDocumentId, availableDocuments, initialDocHandled]);

  const loadAllUserDocuments = async (transactions: TransactionSummaryInput[]) => {
    try {
      await icpService.ensureDocumentStorageActor();
      const allDocs: DocumentOption[] = [];

      for (const tx of transactions) {
        try {
          const docs = await (await icpService.requireDocumentStorage()).getTransactionDocuments(tx.id);
          const onChainDocs = (docs || [])
            .filter((doc: any) => doc.storageLocation === 'onchain' && Number(doc.uploadedChunks) > 0)
            .map((doc: any) => ({
              id: Number(doc.id),
              fileName: doc.fileName,
              docType: doc.docType || 'Document',
              contentType: doc.contentType || 'application/octet-stream',
              transactionId: tx.id,
              propertyAddress: tx.propertyAddress,
            }));
          allDocs.push(...onChainDocs);
        } catch (err) {
          logger.warn(`Failed to load documents for transaction ${tx.id}:`, err);
        }
      }

      setAllUserDocuments(allDocs);

      // Merge on-chain document counts back into userTransactions
      const docCountsByTx = new Map<string, number>();
      for (const doc of allDocs) {
        if (doc.transactionId) {
          docCountsByTx.set(doc.transactionId, (docCountsByTx.get(doc.transactionId) || 0) + 1);
        }
      }
      if (docCountsByTx.size > 0) {
        setUserTransactions(prev => prev.map(tx => {
          const onChainCount = docCountsByTx.get(tx.id) || 0;
          if (onChainCount > 0 && (!tx.documentSummary || tx.documentSummary.total === 0)) {
            return {
              ...tx,
              documentSummary: {
                total: onChainCount,
                uploaded: onChainCount,
                verified: 0,
                pending: onChainCount,
              },
            };
          }
          return tx;
        }));
      }

      logger.info(`Loaded ${allDocs.length} on-chain documents across ${transactions.length} transactions`);
    } catch (err) {
      logger.warn('Failed to load user documents for Oscar:', err);
    }
  };

  const handleSend = async (message: string = input) => {
    if (!message.trim() || isLoading || !isInitialized) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: BigInt(Date.now() * 1000000),
    };

    // Add user message locally and notify parent
    onSendMessage(userMessage);
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      // Build context for Oscar
      const transactionContext = context?.type === 'transaction' ? context.id : undefined;

      // Pass user transactions for context (avoids cross-canister auth issues)
      const response: ChatResponse = await oscarService.chat(
        message,
        transactionContext,
        true,
        userTransactions
      );

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.message,
        timestamp: BigInt(Date.now() * 1000000),
      };

      // Add Oscar's response and notify parent
      onSendMessage(assistantMessage);
      setSuggestions(response.suggestedFollowups);

      // Log any actions that were executed
      if (response.actions.length > 0) {
        const actionSummary = response.actions
          .map(a => `${a.action}: ${a.result}`)
          .join('\n');
        logger.info('Actions executed:', actionSummary);
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to send message';
      setError(errorMessage);
      logger.error('Failed to send message to Oscar:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    handleSend(suggestion);
  };

  return (
    <div className="flex-1 flex flex-col h-screen bg-[#f5f3ef]">
      {/* Context Banner */}
      {context && (
        <div className="bg-gradient-to-r from-teal-600 to-teal-700 text-white px-6 py-3 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5" />
            <div>
              <p className="text-sm font-medium">
                Context: {(context.type ?? '').charAt(0).toUpperCase() + (context.type ?? '').slice(1)}
              </p>
              {context.title && (
                <p className="text-xs text-teal-100">{context.title}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClearContext}
            className="p-1 hover:bg-white/10 rounded transition-colors"
            aria-label="Clear context"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Messages Area */}
      <div
        ref={chatContainerRef}
        className={`flex-1 overflow-y-auto px-6 py-8 ${messages.length === 0 ? 'flex items-center justify-center' : ''}`}
        style={{ maxWidth: '900px', margin: '0 auto', width: '100%' }}
      >
        {/* Welcome Message (New Conversation) - Centered */}
        {!isInitialized && !error && (
          <div className="text-center text-stone-500">
            <div className="w-16 h-16 bg-gradient-to-br from-teal-500 to-teal-600 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse shadow-lg shadow-teal-500/20">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <p className="text-lg font-medium">Connecting to Oscar...</p>
          </div>
        )}

        {isInitialized && messages.length === 0 && (
          <div className="text-center text-stone-700">
            <div className="w-16 h-16 bg-gradient-to-br from-teal-500 to-teal-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-teal-500/20">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold mb-2 text-stone-900">Hi! I'm Oscar</h2>
            <p className="text-stone-500 mb-8">
              Your AI assistant for property conveyancing on PropXchain
            </p>
            <div className="max-w-md mx-auto text-left space-y-3">
              <p className="text-sm text-stone-500">I can help you with:</p>
              <ul className="space-y-2 text-sm text-stone-600">
                <li className="flex items-start gap-2">
                  <span className="text-teal-600">•</span>
                  <span>Transaction status and updates</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-teal-600">•</span>
                  <span>Document requirements and verification</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-teal-600">•</span>
                  <span>Timeline and next steps</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-teal-600">•</span>
                  <span>General conveyancing questions</span>
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.map((message) => (
          <OscarMessage key={message.id} message={message} />
        ))}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex items-center gap-2 text-stone-500 my-4">
            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm">
              <Sparkles className="w-4 h-4 text-teal-600 animate-pulse" />
            </div>
            <div className="bg-white rounded-lg px-4 py-3 shadow-sm border border-stone-100">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-lg text-sm my-4">
            <strong>Error:</strong> {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && !isLoading && (
        <div className="px-6 pb-4" style={{ maxWidth: '900px', margin: '0 auto', width: '100%' }}>
          <OscarSuggestions
            suggestions={suggestions}
            onSelect={handleSuggestionClick}
          />
        </div>
      )}

      {/* Input Area (Fixed at bottom) */}
      <div className="border-t border-stone-200 bg-[#faf8f5] px-6 py-4">
        <div style={{ maxWidth: '900px', margin: '0 auto', width: '100%' }}>
          <OscarInput
            value={input}
            onChange={setInput}
            onSend={() => handleSend()}
            disabled={isLoading || !isInitialized}
          />
        </div>
      </div>
    </div>
  );
};

export default OscarChatWindow;
