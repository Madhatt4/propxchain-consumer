import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Menu } from 'lucide-react';
import OscarSidebar from '../components/oscar/OscarSidebar';
import OscarChatWindow from '../components/oscar/OscarChatWindow';
import OscarMobileMenu from '../components/oscar/OscarMobileMenu';
import ContextDataPanel from '../components/oscar/ContextDataPanel';
import TransactionDetailsPanel from '../components/oscar/TransactionDetailsPanel';
import { oscarService } from '../services/oscar/oscarService';
import { Message, Conversation } from '../types/oscar.types';
import { logger } from '@/utils/logger';
import { useAuthStore } from '../stores/authStore';

interface ConversationContext {
  type?: 'transaction' | 'document' | 'message';
  id?: string;
  title?: string;
}

const OscarDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [context, setContext] = useState<ConversationContext | null>(null);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [isNewConversation, setIsNewConversation] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [initialDocumentId, setInitialDocumentId] = useState<number | undefined>(undefined);

  // Authentication check - Oscar requires Internet Identity
  useEffect(() => {
    const authState = useAuthStore.getState();
    const principalId = authState.principalId;

    // Oscar is only available to Internet Identity users
    if (!principalId || !authState.isAuthenticated) {
      // Redirect to login with message about Internet Identity requirement
      navigate('/login', {
        state: {
          message: 'Oscar AI Assistant requires Internet Identity authentication. Please log in with Internet Identity to access Oscar.'
        }
      });
      return;
    }

    // Read URL params for deep-linked document
    const docId = searchParams.get('docId');
    const txId = searchParams.get('txId');
    if (docId && txId) {
      setContext({ type: 'transaction', id: txId });
      setInitialDocumentId(Number(docId));
      // Clear params so they don't persist on refresh
      setSearchParams({}, { replace: true });
    }

    // Load conversations on mount
    loadConversations();
  }, [navigate]);

  // Load conversations from Oscar service
  const loadConversations = async () => {
    setLoadingConversations(true);
    try {
      await oscarService.initialize();
      const conversationList = await oscarService.getConversationList();
      setConversations(conversationList);
    } catch (error) {
      logger.error('Failed to load conversations:', error);
    } finally {
      setLoadingConversations(false);
    }
  };

  // Handle new conversation
  const handleNewConversation = () => {
    setMessages([]);
    setContext(null);
    setCurrentConversationId(null);
    setIsNewConversation(true);
  };

  // Handle loading existing conversation
  const handleLoadConversation = (conversationId: string, conversationMessages: Message[]) => {
    setMessages(conversationMessages);
    setCurrentConversationId(conversationId);
    setIsNewConversation(false);
  };

  // Handle sending new message
  const handleSendMessage = (message: Message) => {
    setMessages(prev => [...prev, message]);
    setIsNewConversation(false);
  };

  // Handle context change from quick access
  const handleContextChange = (newContext: ConversationContext) => {
    setContext(newContext);
  };

  // Handle clearing context
  const handleClearContext = () => {
    setContext(null);
  };

  // Handle asking Oscar a question with context (from details panel)
  const handleAskOscarWithContext = (question: string) => {
    // Create user message
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: question,
      timestamp: BigInt(Date.now() * 1000000),
    };
    handleSendMessage(userMessage);
  };

  // Handle delete conversation with reload
  const handleDeleteConversation = async (conversationId: string) => {
    try {
      await oscarService.deleteConversation(conversationId);
      await loadConversations();
      handleNewConversation();
    } catch (error) {
      logger.error('Failed to delete conversation:', error);
    }
  };

  return (
    <div className="h-screen bg-stone-50 dark:bg-[#0F172A] overflow-hidden flex">
      {/* Oscar Mobile Menu (drawer) */}
      <OscarMobileMenu
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        conversations={conversations}
        loading={loadingConversations}
        currentConversationId={currentConversationId}
        activeContext={context}
        onNewConversation={handleNewConversation}
        onLoadConversation={handleLoadConversation}
        onDeleteConversation={handleDeleteConversation}
        onContextChange={handleContextChange}
      />

      {/* Desktop Sidebar - Hidden on mobile */}
      <div className="hidden md:block flex-shrink-0">
        <OscarSidebar
          onNewConversation={handleNewConversation}
          onLoadConversation={handleLoadConversation}
          onContextChange={handleContextChange}
          currentConversationId={currentConversationId}
          activeContext={context}
        />
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header with Burger Menu */}
        <div className="md:hidden flex items-center justify-between p-4 bg-white dark:bg-[#0F172A] border-b border-stone-200 dark:border-[#334155]">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 rounded-lg hover:bg-stone-100 dark:hover:bg-[#1E293B] transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-6 h-6 text-stone-600 dark:text-gray-300" />
          </button>
          <h1 className="text-lg font-bold text-stone-900 dark:text-white">Oscar AI</h1>
          <div className="w-10" /> {/* Spacer for centering */}
        </div>

        {/* Split or Full Chat View */}
        <div className="flex-1 flex min-h-0">
          {/* Context Panel - shows list or details depending on selection */}
          {context && context.type && (
            <div className="w-[400px] flex-shrink-0 hidden md:block">
              {/* Show details panel when a specific item is selected */}
              {context.id && context.type === 'transaction' ? (
                <TransactionDetailsPanel
                  transactionId={context.id}
                  onClose={handleClearContext}
                  onAskOscar={handleAskOscarWithContext}
                />
              ) : (
                /* Show list panel when only type is selected */
                <ContextDataPanel
                  context={context}
                  onClose={handleClearContext}
                  onSelectItem={(item, type) => {
                    // When user selects an item, set it as the active context with its ID
                    setContext({
                      type: type as 'transaction' | 'document' | 'message',
                      id: item.id,
                      title: item.propertyAddress || item.name || `${type} ${item.id.slice(0, 8)}...`,
                    });
                  }}
                />
              )}
            </div>
          )}

          {/* Chat Window */}
          <div className="flex-1 min-w-0">
            <OscarChatWindow
              messages={messages}
              onSendMessage={handleSendMessage}
              context={context}
              onClearContext={handleClearContext}
              conversationId={currentConversationId}
              isNewConversation={isNewConversation}
              initialDocumentId={initialDocumentId}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default OscarDashboard;
