import React, { useEffect } from 'react';
import { X, PlusCircle, Sparkles, Settings } from 'lucide-react';
import { Button } from '../ui/button';
import ConversationList from './ConversationList';
import QuickAccessPanel from './QuickAccessPanel';
import type { Message, Conversation } from '../../types/oscar.types';
import { logger } from '@/utils/logger';

interface ConversationContext {
  type?: 'transaction' | 'document' | 'message';
  id?: string;
  title?: string;
}

interface OscarMobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  conversations: Conversation[];
  loading: boolean;
  currentConversationId: string | null;
  activeContext: ConversationContext | null;
  onNewConversation: () => void;
  onLoadConversation: (conversationId: string, messages: Message[]) => void;
  onDeleteConversation: (conversationId: string) => void;
  onContextChange: (context: ConversationContext) => void;
}

const OscarMobileMenu: React.FC<OscarMobileMenuProps> = ({
  isOpen,
  onClose,
  conversations,
  loading,
  currentConversationId,
  activeContext,
  onNewConversation,
  onLoadConversation,
  onDeleteConversation,
  onContextChange,
}) => {
  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handleNewConversation = () => {
    onNewConversation();
    onClose();
  };

  const handleSelectConversation = (conversationId: string, messages: Message[]) => {
    onLoadConversation(conversationId, messages);
    onClose();
  };

  const handleSelectContext = (type: 'transaction' | 'document' | 'message', title?: string) => {
    onContextChange({ type, title });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Dark overlay backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-out menu from left */}
      <div
        className={`
          fixed top-0 left-0 h-full w-[280px] bg-stone-50 dark:bg-[#0F172A] shadow-lg z-50
          transform transition-transform duration-300 ease-in-out md:hidden
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          flex flex-col
        `}
      >
        {/* Header with close button */}
        <div className="flex items-center justify-between p-4 border-b border-stone-200 dark:border-[#334155]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-teal-600 dark:from-[#6366F1] dark:to-[#8B5CF6] rounded-lg flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-stone-900 dark:text-white">Oscar</h1>
              <p className="text-xs text-stone-500 dark:text-gray-400">AI Assistant</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-stone-100 dark:hover:bg-[#1E293B] transition-colors"
            aria-label="Close menu"
          >
            <X className="w-6 h-6 text-stone-500 dark:text-gray-400" />
          </button>
        </div>

        {/* New Conversation Button */}
        <div className="p-4">
          <Button
            onClick={handleNewConversation}
            className="w-full bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 dark:from-[#6366F1] dark:to-[#8B5CF6] dark:hover:from-[#5558E3] dark:hover:to-[#7C4FE8] text-white border-none font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            New Conversation
          </Button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Recent Conversations Section */}
          <div className="p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-gray-400 mb-3">
              Recent Conversations
            </h3>

            <ConversationList
              conversations={conversations}
              currentConversationId={currentConversationId}
              onSelectConversation={handleSelectConversation}
              onDeleteConversation={onDeleteConversation}
              loading={loading}
            />
          </div>

          {/* Divider */}
          <div className="border-t border-stone-200 dark:border-[#334155] my-2"></div>

          {/* Quick Access Section */}
          <div className="p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-gray-400 mb-3">
              Quick Access
            </h3>

            <QuickAccessPanel
              activeContext={activeContext}
              onSelectContext={handleSelectContext}
            />
          </div>
        </div>

        {/* Bottom Section - Settings */}
        <div className="p-4 border-t border-stone-200 dark:border-[#334155]">
          <button
            className="w-full flex items-center gap-3 p-3 rounded-lg text-stone-600 dark:text-gray-300 hover:bg-stone-100 dark:hover:bg-[#1E293B] hover:text-stone-900 dark:hover:text-white transition-all"
            onClick={() => {
              // TODO: Phase 6 - Implement settings modal/page
              logger.info('Settings clicked');
              onClose();
            }}
          >
            <Settings className="w-4 h-4" />
            <span className="text-sm font-medium">Settings</span>
          </button>
        </div>
      </div>
    </>
  );
};

export default OscarMobileMenu;
