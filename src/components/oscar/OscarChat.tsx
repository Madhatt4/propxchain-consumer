import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Sparkles, X, Trash2 } from 'lucide-react';
import { logger } from '../../utils/logger';
import { getStorePrincipalId } from '../../stores/authStore';
import { oscarService } from '../../services/oscar/oscarService';
import { getGreetingContext } from '../../utils/oscarGreeting';
import { useSplitPanel } from '../../contexts/SplitPanelContext';
import { OscarMessage } from './OscarMessage';
import { OscarInput } from './OscarInput';
import { OscarSuggestions } from './OscarSuggestions';
import type { Message, ChatResponse } from '../../types/oscar.types';

interface OscarChatProps {
  transactionId?: string;
  onClose?: () => void;
}

export const OscarChat: React.FC<OscarChatProps> = ({
  transactionId,
  onClose,
}) => {
  const { transactions } = useSplitPanel();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const userTransactions = useMemo(() => {
    const principalId = getStorePrincipalId() || '';
    return transactions.map((tx: any) => {
      const createdAt = Number(tx.createdAt) / 1_000_000;
      const daysActive = Math.floor(
        (Date.now() - createdAt) / (24 * 60 * 60 * 1000)
      );

      const buyerStr =
        tx.buyer?.toText?.() || tx.buyer?.toString?.() || tx.buyer;
      const sellerStr =
        tx.seller?.toText?.() || tx.seller?.toString?.() || tx.seller;
      let role = 'party';
      if (buyerStr === principalId) role = 'buyer';
      else if (sellerStr === principalId) role = 'seller';

      const status =
        typeof tx.status === 'object'
          ? Object.keys(tx.status)[0]
          : tx.status;
      let phase = 1;
      if (status === 'exchanged') phase = 4;
      else if (status === 'completion_initiated') phase = 5;
      else if (
        status === 'blockchain_completed' ||
        status === 'land_registry_registered'
      )
        phase = 6;

      const docs = tx.documents || [];
      const uploadedDocs = docs.filter(
        (d: any) => d.status === 'uploaded' || d.hash
      ).length;
      const verifiedDocs = docs.filter(
        (d: any) => d.status === 'verified' || d.verified
      ).length;
      const pendingDocs = Math.max(0, docs.length - verifiedDocs);

      const milestones = tx.milestones || [];
      const completedMilestones = milestones.filter(
        (m: any) => m.completed || m.status === 'completed'
      ).length;
      const inProgressMilestones = milestones.filter(
        (m: any) => m.status === 'in_progress'
      ).length;
      const nextMilestone = milestones.find(
        (m: any) => !m.completed && m.status !== 'completed'
      );

      const parties = tx.parties || [];
      const hasSolicitor = !!(
        tx.solicitor || parties.some((p: any) => p.role === 'solicitor')
      );

      return {
        id: tx.id,
        propertyAddress: tx.propertyAddress || 'Unknown',
        status,
        phase,
        role,
        daysActive,
        alertLevel:
          daysActive > 90 ? 'red' : daysActive > 45 ? 'amber' : 'green',
        amount: tx.amount ? Number(tx.amount) : undefined,
        postcode: tx.postcode || undefined,
        propertyType: tx.propertyType
          ? typeof tx.propertyType === 'object'
            ? Object.keys(tx.propertyType)[0]
            : tx.propertyType
          : undefined,
        transactionType: tx.transactionType
          ? typeof tx.transactionType === 'object'
            ? Object.keys(tx.transactionType)[0]
            : tx.transactionType
          : undefined,
        mode: tx.mode
          ? typeof tx.mode === 'object'
            ? Object.keys(tx.mode)[0]
            : tx.mode
          : undefined,
        titleNumber: tx.titleNumber || undefined,
        inviteCode: tx.inviteCode || undefined,
        createdAt:
          createdAt > 0 ? new Date(createdAt).toISOString() : undefined,
        deposit: tx.deposit ? Number(tx.deposit) : undefined,
        mortgageAmount: tx.mortgageAmount
          ? Number(tx.mortgageAmount)
          : undefined,
        documentSummary:
          docs.length > 0
            ? {
                total: docs.length,
                uploaded: uploadedDocs,
                verified: verifiedDocs,
                pending: pendingDocs,
              }
            : undefined,
        milestonesSummary:
          milestones.length > 0
            ? {
                total: milestones.length,
                completed: completedMilestones,
                inProgress: inProgressMilestones,
                nextMilestone:
                  nextMilestone?.name || nextMilestone?.title || undefined,
              }
            : undefined,
        partiesCount: parties.length || undefined,
        hasSolicitor,
      };
    });
  }, [transactions]);

  const greetingContext = useMemo(
    () => getGreetingContext(transactions),
    [transactions]
  );

  useEffect(() => {
    initializeAndLoad();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const initializeAndLoad = async (): Promise<void> => {
    try {
      await oscarService.initialize();
      setIsInitialized(true);
      await loadConversation();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Failed to connect to Oscar.';
      logger.error('Failed to initialize Oscar service:', err);
      setError(msg);
    }
  };

  const loadConversation = async (): Promise<void> => {
    try {
      const conversation = await oscarService.getConversation();
      if (conversation) {
        setMessages(conversation.messages);
      }
    } catch (err) {
      logger.error('Failed to load conversation:', err);
    }
  };

  const handleSend = async (message: string = input): Promise<void> => {
    if (!message.trim() || isLoading || !isInitialized) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: BigInt(Date.now() * 1000000),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      const response: ChatResponse = await oscarService.chat(
        message,
        transactionId,
        true,
        userTransactions
      );

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.message,
        timestamp: BigInt(Date.now() * 1000000),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setSuggestions(response.suggestedFollowups);

      if (response.actions.length > 0) {
        const actionSummary = response.actions.map((a) => a.result).join('\n');
        logger.info('Actions executed:', actionSummary);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Failed to send message';
      setError(msg);
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion: string): void => {
    handleSend(suggestion);
  };

  const handleClear = async (): Promise<void> => {
    if (!isInitialized) return;
    try {
      await oscarService.clearConversation();
      setMessages([]);
      setSuggestions([]);
    } catch (err) {
      logger.error('Failed to clear conversation:', err);
    }
  };

  return (
    <div className="fixed bottom-20 right-4 w-[380px] h-[560px] bg-[#faf8f5] dark:bg-[#0F172A] rounded-2xl shadow-2xl flex flex-col border border-stone-200 dark:border-[#334155] z-50 overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-teal-600 to-teal-700 rounded-t-2xl">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-white/20 backdrop-blur rounded-lg flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-white font-semibold text-sm">Oscar</h3>
            <p className="text-teal-100 text-xs">AI Assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleClear}
            className="p-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            title="Clear conversation"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#f5f3ef] dark:bg-[#1E293B]">
        {!isInitialized && !error && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-12 h-12 bg-gradient-to-br from-teal-500 to-teal-600 rounded-full flex items-center justify-center mb-4 animate-pulse shadow-lg shadow-teal-500/20">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <p className="text-stone-500 dark:text-stone-400 text-sm">Connecting...</p>
          </div>
        )}
        {isInitialized && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-12 h-12 bg-gradient-to-br from-teal-500 to-teal-600 rounded-full flex items-center justify-center mb-4 shadow-lg shadow-teal-500/20">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-stone-900 dark:text-stone-100 font-semibold mb-2">
              Hi! I'm Oscar
            </h3>
            <p className="text-stone-500 dark:text-stone-400 text-sm mb-4">{greetingContext}</p>
            <div className="text-left text-xs text-stone-400 space-y-1">
              <p>&#8226; Transaction status</p>
              <p>&#8226; Document requirements</p>
              <p>&#8226; Next steps guidance</p>
            </div>
          </div>
        )}

        {messages.map((message) => (
          <OscarMessage key={message.id} message={message} />
        ))}

        {isLoading && (
          <div className="mb-4 text-left">
            <div className="inline-block bg-white dark:bg-[#1E293B] px-3 py-2 rounded-lg shadow-sm border border-stone-100 dark:border-[#334155]">
              <div className="flex items-center gap-1">
                <div
                  className="w-2 h-2 bg-teal-500 rounded-full animate-bounce"
                  style={{ animationDelay: '0ms' }}
                />
                <div
                  className="w-2 h-2 bg-teal-500 rounded-full animate-bounce"
                  style={{ animationDelay: '150ms' }}
                />
                <div
                  className="w-2 h-2 bg-teal-500 rounded-full animate-bounce"
                  style={{ animationDelay: '300ms' }}
                />
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm border border-red-200 dark:border-red-700/50">
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && !isLoading && (
        <OscarSuggestions
          suggestions={suggestions}
          onSelect={handleSuggestionClick}
        />
      )}

      {/* Input */}
      <OscarInput
        value={input}
        onChange={setInput}
        onSend={() => handleSend()}
        disabled={isLoading || !isInitialized}
      />
    </div>
  );
};
