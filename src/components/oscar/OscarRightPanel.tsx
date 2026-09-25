import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AuthClient } from '@propxchain/core-client';
import { Sparkles, Send } from 'lucide-react';
import { logger } from '../../utils/logger';
import { getStorePrincipalId } from '../../stores/authStore';
import { oscarService } from '../../services/oscar/oscarService';
import { getGreetingContext } from '../../utils/oscarGreeting';
import { useSplitPanel } from '../../contexts/SplitPanelContext';
import type { Message, ChatResponse } from '../../types/oscar.types';

interface OscarRightPanelProps {
  transactionId?: string;
}

const OscarRightPanel: React.FC<OscarRightPanelProps> = ({ transactionId }) => {
  // Get transactions from context (loaded once at provider level)
  const { transactions } = useSplitPanel();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Transform Transaction[] to TransactionSummaryInput[] for Oscar service
  const userTransactions = useMemo(() => {
    const principalId = getStorePrincipalId() || '';
    return transactions.map((tx: any) => {
      const createdAt = Number(tx.createdAt) / 1_000_000;
      const daysActive = Math.floor((Date.now() - createdAt) / (24 * 60 * 60 * 1000));

      const buyerStr = tx.buyer?.toText?.() || tx.buyer?.toString?.() || tx.buyer;
      const sellerStr = tx.seller?.toText?.() || tx.seller?.toString?.() || tx.seller;
      let role = 'party';
      if (buyerStr === principalId) role = 'buyer';
      else if (sellerStr === principalId) role = 'seller';

      const status = typeof tx.status === 'object' ? Object.keys(tx.status)[0] : tx.status;
      let phase = 1;
      if (status === 'exchanged') phase = 4;
      else if (status === 'completion_initiated') phase = 5;
      else if (status === 'blockchain_completed' || status === 'land_registry_registered') phase = 6;

      return {
        id: tx.id,
        propertyAddress: tx.propertyAddress || 'Unknown',
        status,
        phase,
        role,
        daysActive,
        alertLevel: daysActive > 90 ? 'red' : daysActive > 45 ? 'amber' : 'green',
      };
    });
  }, [transactions]);

  // Generate context-aware greeting for empty state
  const greetingContext = useMemo(() => {
    return getGreetingContext(transactions);
  }, [transactions]);

  useEffect(() => {
    initializeOscar();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const initializeOscar = async () => {
    try {
      const authClient = new AuthClient();
      await oscarService.initialize(authClient);
      setIsInitialized(true);
      logger.info('Oscar service initialized successfully');
    } catch (err) {
      logger.error('Failed to initialize Oscar service:', err);
      setError('Failed to connect to Oscar');
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading || !isInitialized) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: BigInt(Date.now() * 1000000),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      const response: ChatResponse = await oscarService.chat(
        input,
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

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err: any) {
      setError(err.message || 'Failed to send message');
      logger.error('Failed to send message to Oscar:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#faf8f5] dark:bg-[#0F172A] border-l border-stone-200 dark:border-[#334155]">
      {/* Header */}
      <div className="p-4 border-b border-stone-200 dark:border-[#334155]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-teal-600 rounded-lg flex items-center justify-center shadow-lg shadow-teal-500/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-stone-900 dark:text-stone-100 font-semibold">Oscar</h2>
            <p className="text-stone-500 dark:text-stone-400 text-xs">AI Assistant</p>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 bg-[#f5f3ef] dark:bg-[#1E293B]">
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
            <h3 className="text-stone-900 dark:text-stone-100 font-semibold mb-2">Hi! I'm Oscar</h3>
            <p className="text-stone-500 dark:text-stone-400 text-sm mb-4">
              {greetingContext}
            </p>
            <div className="text-left text-xs text-stone-400 space-y-1">
              <p>• Transaction status</p>
              <p>• Document requirements</p>
              <p>• Next steps guidance</p>
            </div>
          </div>
        )}

        {/* Message List */}
        {messages.map((message) => (
          <div
            key={message.id}
            className={`mb-4 ${message.role === 'user' ? 'text-right' : 'text-left'}`}
          >
            <div
              className={`inline-block max-w-[85%] px-3 py-2 rounded-lg text-sm ${
                message.role === 'user'
                  ? 'bg-gradient-to-r from-teal-600 to-teal-700 text-white shadow-lg shadow-teal-500/20'
                  : 'bg-white dark:bg-[#1E293B] text-stone-700 dark:text-stone-300 shadow-sm border border-stone-100 dark:border-[#334155]'
              }`}
            >
              {message.content}
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="mb-4 text-left">
            <div className="inline-block bg-white dark:bg-[#1E293B] px-3 py-2 rounded-lg shadow-sm border border-stone-100 dark:border-[#334155]">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mb-4 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/50 rounded-lg text-red-600 dark:text-red-400 text-xs">
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-stone-200 dark:border-[#334155] bg-[#faf8f5] dark:bg-[#0F172A]">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask Oscar..."
            disabled={isLoading || !isInitialized}
            className="flex-1 bg-white dark:bg-[#1E293B] border border-stone-200 dark:border-[#334155] rounded-lg px-3 py-2 text-sm text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !isInitialized || !input.trim()}
            className="p-2 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 disabled:bg-stone-300 disabled:cursor-not-allowed rounded-lg transition-colors shadow-lg shadow-teal-500/20"
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default OscarRightPanel;
