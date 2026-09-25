import React from 'react';
import { MessageSquare, Trash2, Clock } from 'lucide-react';
import type { Conversation, Message } from '../../types/oscar.types';

interface ConversationListProps {
  conversations: Conversation[];
  currentConversationId: string | null;
  onSelectConversation: (conversationId: string, messages: Message[]) => void;
  onDeleteConversation: (conversationId: string) => void;
  loading: boolean;
}

const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  currentConversationId,
  onSelectConversation,
  onDeleteConversation,
  loading,
}) => {
  // Format timestamp to readable date/time
  const formatTimestamp = (timestamp: bigint): string => {
    const ms = Number(timestamp) / 1000000; // Convert nanoseconds to milliseconds
    const date = new Date(ms);

    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = diff / (1000 * 60 * 60);

    if (hours < 1) {
      return 'Just now';
    } else if (hours < 24) {
      return `${Math.floor(hours)}h ago`;
    } else if (hours < 48) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  // Get preview text from first user message or default text
  const getPreviewText = (messages: Message[]): string => {
    const firstUserMessage = messages.find(m => m.role === 'user');
    if (firstUserMessage) {
      return firstUserMessage.content.slice(0, 60) + (firstUserMessage.content.length > 60 ? '...' : '');
    }
    return 'New conversation';
  };

  // Handle delete with confirmation
  const handleDelete = (e: React.MouseEvent, conversationId: string) => {
    e.stopPropagation(); // Prevent triggering the select action

    if (window.confirm('Are you sure you want to delete this conversation? This action cannot be undone.')) {
      onDeleteConversation(conversationId);
    }
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <div
            key={i}
            className="p-3 rounded-lg bg-stone-100 animate-pulse"
          >
            <div className="h-4 bg-stone-200 rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-stone-200 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="text-center py-8 px-4">
        <MessageSquare className="w-12 h-12 text-stone-400 mx-auto mb-3 opacity-50" />
        <p className="text-sm text-stone-500">No conversations yet</p>
        <p className="text-xs text-stone-400 mt-1">
          Start a new conversation to get help from Oscar
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {conversations.map((conversation) => {
        const isActive = currentConversationId === conversation.id;
        const preview = getPreviewText(conversation.messages);
        const timestamp = formatTimestamp(conversation.lastActivity);

        return (
          <div
            key={conversation.id}
            className={`
              group relative p-3 rounded-lg cursor-pointer transition-all
              ${isActive
                ? 'bg-white border-l-3 border-teal-600 shadow-sm'
                : 'hover:bg-white hover:shadow-sm border-l-3 border-transparent'
              }
            `}
            onClick={() => onSelectConversation(conversation.id, conversation.messages)}
          >
            {/* Conversation Info */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <MessageSquare className={`w-4 h-4 shrink-0 ${isActive ? 'text-teal-600' : 'text-stone-400'}`} />
                <span className={`text-sm font-medium truncate ${isActive ? 'text-stone-900' : 'text-stone-600'}`}>
                  {preview}
                </span>
              </div>

              {/* Delete Button */}
              <button
                onClick={(e) => handleDelete(e, conversation.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-50 rounded"
                aria-label="Delete conversation"
              >
                <Trash2 className="w-3 h-3 text-red-400 hover:text-red-500" />
              </button>
            </div>

            {/* Metadata */}
            <div className="flex items-center justify-between text-xs text-stone-400">
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>{timestamp}</span>
              </div>
              <span>{conversation.messages.length} messages</span>
            </div>

            {/* Token Usage (if available) */}
            {conversation.metadata && conversation.metadata.totalTokens > 0 && (
              <div className="mt-2 text-xs text-stone-500">
                {conversation.metadata.totalTokens.toLocaleString()} tokens used
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ConversationList;
