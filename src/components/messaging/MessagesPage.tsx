// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { logger } from '@/utils/logger';
import { messageService } from '../../services/message.service';
import { ComposeMessageModal } from './ComposeMessageModal';
import {
  ThreadWithUnread,
  Message,
} from '../../types/message.types';
import {
  MessageSquare,
  Plus,
  Inbox,
  Send as SendIcon,
  Archive,
  Search,
  Loader2,
  Mail,
  Clock,
  AlertCircle,
  ChevronRight,
  User,
  RefreshCw,
  ArrowLeft,
} from 'lucide-react';
import AppTopBar from '@/components/navigation/AppTopBar';
import { getStorePrincipalId, getStoreIsAuthenticated } from '../../stores/authStore';

type Tab = 'inbox' | 'sent' | 'archived';

export const MessagesPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const transactionFilter = searchParams.get('transaction');

  const [activeTab, setActiveTab] = useState<Tab>('inbox');
  const [threads, setThreads] = useState<ThreadWithUnread[]>([]);
  const [selectedThread, setSelectedThread] = useState<ThreadWithUnread | null>(null);
  const [threadMessages, setThreadMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isMobileView, setIsMobileView] = useState(false);
  const [showMobileMessages, setShowMobileMessages] = useState(false);

  // Check auth
  useEffect(() => {
    const principalId = getStorePrincipalId();
    const isAuthenticated = getStoreIsAuthenticated();
    if (!principalId || !isAuthenticated) {
      navigate('/login');
    }
  }, [navigate]);

  // Detect mobile breakpoint — matches lg (1024px)
  useEffect(() => {
    const checkMobile = (): void => setIsMobileView(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleSelectThread = (thread: ThreadWithUnread): void => {
    setSelectedThread(thread);
    if (isMobileView) setShowMobileMessages(true);
  };

  const handleBackToList = (): void => {
    setShowMobileMessages(false);
  };

  // Load threads when filter or tab changes
  useEffect(() => {
    loadThreads();
  }, [transactionFilter, activeTab]);

  const loadThreads = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Reinitialize to ensure we have the current user's authenticated agent
      await messageService.reinitialize();

      let loadedThreads: ThreadWithUnread[];
      if (transactionFilter) {
        loadedThreads = await messageService.getTransactionThreads(transactionFilter);
      } else {
        loadedThreads = await messageService.getMyThreads();
      }

      // Filter by tab
      const filteredThreads = loadedThreads.filter(t => {
        if (activeTab === 'archived') return t.thread.isArchived;
        return !t.thread.isArchived;
      });

      setThreads(filteredThreads);

      // Get unread count
      const count = await messageService.getUnreadCount();
      setUnreadCount(count);
    } catch (err) {
      logger.error('Error loading messages:', err);
      setError('Failed to load messages. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Load thread messages when selected
  useEffect(() => {
    if (selectedThread) {
      loadThreadMessages(selectedThread.thread.id);
    }
  }, [selectedThread]);

  const loadThreadMessages = async (threadId: string) => {
    setIsLoadingMessages(true);

    try {
      const messages = await messageService.getThreadMessages(threadId);
      setThreadMessages(messages);

      // Mark as read
      await messageService.markThreadAsRead(threadId);

      // Update unread count
      const count = await messageService.getUnreadCount();
      setUnreadCount(count);
    } catch (err) {
      logger.error('Error loading thread messages:', err);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleMessageSent = () => {
    setShowComposeModal(false);
    loadThreads();
  };

  const handleArchiveThread = async (threadId: string) => {
    try {
      await messageService.archiveThread(threadId);
      loadThreads();
      if (selectedThread?.thread.id === threadId) {
        setSelectedThread(null);
        setThreadMessages([]);
      }
    } catch (err) {
      logger.error('Error archiving thread:', err);
    }
  };

  // Filter threads by search
  const filteredThreads = threads.filter(t =>
    t.thread.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.lastMessage?.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="min-h-screen">
      <AppTopBar title="Messages" backTo="/dashboard" backLabel="Back to dashboard" />

      {/* Main Content */}
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 lg:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 lg:gap-3">
              <MessageSquare className="w-6 h-6 lg:w-8 lg:h-8 text-emerald-500" />
              <div>
                <h1 className="text-lg lg:text-2xl font-bold text-slate-900 dark:text-white">Messages</h1>
                <p className="text-xs lg:text-sm text-slate-500 dark:text-slate-400 hidden sm:block">
                  {transactionFilter ? `Filtered by ${transactionFilter}` : 'All conversations'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowComposeModal(true)}
              className="flex items-center gap-2 px-3 py-2 lg:px-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors text-sm lg:text-base"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New Message</span>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-2 lg:gap-4 mt-3 lg:mt-4 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('inbox')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                activeTab === 'inbox'
                  ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <Inbox className="w-4 h-4" />
              Inbox
              {unreadCount > 0 && (
                <span className="bg-emerald-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('sent')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                activeTab === 'sent'
                  ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <SendIcon className="w-4 h-4" />
              Sent
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('archived')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                activeTab === 'archived'
                  ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <Archive className="w-4 h-4" />
              Archived
            </button>
            <div className="flex-1" />
            <button
              type="button"
              onClick={loadThreads}
              aria-label="Refresh messages"
              className="flex items-center gap-2 px-3 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 py-2 lg:py-6">
        <div className="flex gap-0 lg:gap-6 h-[calc(100vh-240px)] lg:h-[calc(100vh-220px)]">
          {/* Thread list — full-width on mobile, 1/3 on desktop; hidden when viewing messages on mobile */}
          <div className={`${isMobileView && showMobileMessages ? 'hidden' : 'flex'} ${isMobileView ? 'w-full' : 'w-1/3'} lg:flex lg:w-1/3 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex-col`}>
            {/* Search */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-700">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search messages..."
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Thread list */}
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                </div>
              ) : error ? (
                <div className="p-4 text-center">
                  <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
                  <p className="text-sm text-slate-500 dark:text-slate-400">{error}</p>
                  <button
                    type="button"
                    onClick={loadThreads}
                    className="mt-2 text-sm text-emerald-500 hover:underline"
                  >
                    Try again
                  </button>
                </div>
              ) : filteredThreads.length === 0 ? (
                <div className="p-8 text-center">
                  <Mail className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-500 dark:text-slate-400">No messages yet</p>
                  <button
                    type="button"
                    onClick={() => setShowComposeModal(true)}
                    className="mt-3 text-emerald-500 hover:underline text-sm"
                  >
                    Send your first message
                  </button>
                </div>
              ) : (
                filteredThreads.map((thread) => (
                  <button
                    key={thread.thread.id}
                    type="button"
                    onClick={() => handleSelectThread(thread)}
                    className={`w-full p-4 text-left border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${
                      selectedThread?.thread.id === thread.thread.id
                        ? 'bg-emerald-50 dark:bg-emerald-900/20'
                        : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                        <User className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className={`text-sm font-medium truncate ${
                            thread.unreadCount > 0
                              ? 'text-slate-900 dark:text-white'
                              : 'text-slate-700 dark:text-slate-300'
                          }`}>
                            {thread.thread.subject}
                          </h3>
                          {thread.unreadCount > 0 && (
                            <span className="bg-emerald-500 text-white text-xs px-2 py-0.5 rounded-full flex-shrink-0">
                              {thread.unreadCount}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-1">
                          {thread.lastMessage?.content || 'No messages'}
                        </p>
                        <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
                          <Clock className="w-3 h-3" />
                          {formatDate(thread.thread.lastMessageAt)}
                          <span className="text-slate-300">|</span>
                          {thread.thread.transactionId}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Message view — full-width on mobile, flex-1 on desktop; hidden when viewing thread list on mobile */}
          <div className={`${isMobileView && !showMobileMessages ? 'hidden' : 'flex'} ${isMobileView ? 'w-full' : 'flex-1'} lg:flex lg:flex-1 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex-col`}>
            {selectedThread ? (
              <>
                {/* Thread header */}
                <div className="p-3 lg:p-4 border-b border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {/* Back button — visible below lg */}
                      <button
                        type="button"
                        onClick={handleBackToList}
                        className="lg:hidden p-2 -ml-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-lg"
                        aria-label="Back to thread list"
                      >
                        <ArrowLeft className="w-5 h-5" />
                      </button>
                      <div className="min-w-0">
                        <h2 className="text-base lg:text-lg font-semibold text-slate-900 dark:text-white truncate">
                          {selectedThread.thread.subject}
                        </h2>
                        <p className="text-xs lg:text-sm text-slate-500 dark:text-slate-400 truncate">
                          {selectedThread.thread.transactionId} - {selectedThread.thread.messageCount} messages
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleArchiveThread(selectedThread.thread.id)}
                      className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors flex-shrink-0"
                      title="Archive thread"
                      aria-label="Archive thread"
                    >
                      <Archive className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Messages — extra bottom padding on mobile for fixed reply bar */}
                <div className="flex-1 overflow-y-auto p-3 lg:p-4 space-y-3 lg:space-y-4 pb-20 lg:pb-4">
                  {isLoadingMessages ? (
                    <div className="flex items-center justify-center h-32">
                      <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                    </div>
                  ) : (
                    threadMessages.map((message) => {
                      const isOwnMessage = message.sender === getStorePrincipalId();
                      return (
                        <div
                          key={message.id}
                          className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[85%] lg:max-w-[70%] rounded-xl p-3 lg:p-4 ${
                              isOwnMessage
                                ? 'bg-emerald-500 text-white'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-medium text-sm">
                                {message.senderName}
                              </span>
                              <span className={`text-xs ${isOwnMessage ? 'text-emerald-100' : 'text-slate-500 dark:text-slate-400'}`}>
                                {message.senderRole}
                              </span>
                            </div>
                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                            <p className={`text-xs mt-2 ${isOwnMessage ? 'text-emerald-100' : 'text-slate-400'}`}>
                              {formatDate(message.createdAt)}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Reply box — sticky bottom on mobile, inline on desktop */}
                <div className="p-3 lg:p-4 border-t border-slate-200 dark:border-slate-700 lg:relative fixed bottom-0 left-0 right-0 lg:left-auto lg:right-auto lg:bottom-auto bg-white dark:bg-slate-800 z-10">
                  <button
                    type="button"
                    onClick={() => setShowComposeModal(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors min-h-[44px]"
                  >
                    <SendIcon className="w-4 h-4" />
                    Reply to Thread
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <MessageSquare className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-500 dark:text-slate-400">Select a conversation to view messages</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

        {/* Compose Modal */}
        <ComposeMessageModal
          isOpen={showComposeModal}
          onClose={() => setShowComposeModal(false)}
          onMessageSent={handleMessageSent}
          transactionId={transactionFilter || undefined}
          threadId={selectedThread?.thread.id}
          mode={selectedThread ? 'reply' : 'new'}
        />
      </div>
    </div>
  );
};

export default MessagesPage;
