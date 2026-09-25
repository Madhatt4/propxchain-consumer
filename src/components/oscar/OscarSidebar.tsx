import React, { useState, useEffect } from 'react';
import { PlusCircle, Settings, Sparkles } from 'lucide-react';
import { Message, Conversation } from '../../types/oscar.types';
import { Button } from '../ui/button';
import { oscarService } from '../../services/oscar/oscarService';
import { AuthClient } from '@propxchain/core-client';
import { logger } from '@/utils/logger';
import ConversationList from './ConversationList';
import QuickAccessPanel from './QuickAccessPanel';

interface ConversationContext {
  type?: 'transaction' | 'document' | 'message';
  id?: string;
  title?: string;
}

interface OscarSidebarProps {
  onNewConversation: () => void;
  onLoadConversation: (conversationId: string, messages: Message[]) => void;
  onContextChange: (context: ConversationContext) => void;
  currentConversationId: string | null;
  activeContext: ConversationContext | null;
}

const OscarSidebar: React.FC<OscarSidebarProps> = ({
  onNewConversation,
  onLoadConversation,
  onContextChange,
  currentConversationId,
  activeContext,
}) => {
  const [recentConversations, setRecentConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);

  // Load recent conversations from Oscar service
  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    setLoading(true);
    try {
      // Initialize Oscar service if not already initialized
      const authClient = new AuthClient();
      await oscarService.initialize(authClient);

      // Get conversation list
      const conversations = await oscarService.getConversationList();
      setRecentConversations(conversations);
    } catch (error) {
      logger.error('Failed to load conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAccess = (type: 'transaction' | 'document' | 'message', title?: string) => {
    onContextChange({ type, title });
  };

  const handleSelectConversation = (conversationId: string, messages: Message[]) => {
    onLoadConversation(conversationId, messages);
  };

  const handleDeleteConversation = async (conversationId: string) => {
    try {
      await oscarService.deleteConversation(conversationId);
      // Reload conversations after deletion
      await loadConversations();
      // Clear the current conversation view
      onNewConversation();
    } catch (error) {
      logger.error('Failed to delete conversation:', error);
    }
  };

  const handleNewConversation = async () => {
    onNewConversation();
    // Reload conversations to refresh the list
    await loadConversations();
  };

  return (
    <div className="w-[280px] h-full bg-[#faf8f5] border-r border-stone-200 flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-stone-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-teal-600 rounded-lg flex items-center justify-center shadow-lg shadow-teal-500/20">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-stone-900">Oscar</h1>
            <p className="text-xs text-stone-500">AI Assistant</p>
          </div>
        </div>

        {/* New Conversation Button */}
        <Button
          onClick={handleNewConversation}
          className="w-full bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white border-none font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg shadow-teal-500/20"
        >
          <PlusCircle className="w-4 h-4" />
          New Conversation
        </Button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto bg-[#f5f3ef]">
        {/* Recent Conversations Section */}
        <div className="p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-3">
            Recent Conversations
          </h3>

          <ConversationList
            conversations={recentConversations}
            currentConversationId={currentConversationId}
            onSelectConversation={handleSelectConversation}
            onDeleteConversation={handleDeleteConversation}
            loading={loading}
          />
        </div>

        {/* Divider */}
        <div className="border-t border-stone-200 my-2"></div>

        {/* Quick Access Section */}
        <div className="p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-3">
            Quick Access
          </h3>

          <QuickAccessPanel
            activeContext={activeContext}
            onSelectContext={handleQuickAccess}
          />
        </div>
      </div>

      {/* Bottom Section - Settings */}
      <div className="p-4 border-t border-stone-200 bg-[#faf8f5]">
        <button
          className="w-full flex items-center gap-3 p-3 rounded-lg text-stone-600 hover:bg-stone-100 hover:text-stone-900 transition-all"
          onClick={() => {
            // TODO: Phase 6 - Implement settings modal/page
            logger.info('Settings clicked');
          }}
        >
          <Settings className="w-4 h-4" />
          <span className="text-sm font-medium">Settings</span>
        </button>
      </div>
    </div>
  );
};

export default OscarSidebar;
