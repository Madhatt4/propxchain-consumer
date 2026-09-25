// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import React, { useState, useEffect } from 'react';
import { logger } from '@/utils/logger';
import { getStorePrincipalId } from '@/stores/authStore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';
import { RecipientSelector } from './RecipientSelector';
import { messageService } from '../../services/message.service';
import { icpService } from '../../services/icp.service';
import {
  ComposeMessageModalProps,
  MessageType,
  MessagePriority,
  Message,
  ChaseRecipient,
} from '../../types/message.types';
import {
  Send,
  Loader2,
  AlertCircle,
  Mail,
  Bot,
  AlertTriangle,
  Home,
  ChevronDown,
} from 'lucide-react';

interface TransactionOption {
  id: string;
  propertyAddress: string;
  status: string;
}

export const ComposeMessageModal: React.FC<ComposeMessageModalProps> = ({
  isOpen,
  onClose,
  onMessageSent,
  transactionId: initialTransactionId,
  recipient: initialRecipient,
  draftContent,
  draftSubject,
  messageType: initialMessageType = 'general',
  mode = 'new',
  threadId,
}) => {
  const [recipient, setRecipient] = useState<ChaseRecipient | undefined>(initialRecipient);
  const [subject, setSubject] = useState(draftSubject || '');
  const [content, setContent] = useState(draftContent || '');
  const [messageType, setMessageType] = useState<MessageType>(initialMessageType);
  const [priority, setPriority] = useState<MessagePriority>('normal');
  const [sendEmailNotification, setSendEmailNotification] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Transaction selection state
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | undefined>(initialTransactionId);
  const [transactions, setTransactions] = useState<TransactionOption[]>([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const [showTransactionDropdown, setShowTransactionDropdown] = useState(false);

  const currentPrincipal = getStorePrincipalId();
  const userName = localStorage.getItem('userName') || 'User';
  const userRole = localStorage.getItem('userType') || 'user';

  // Load user's transactions when modal opens
  useEffect(() => {
    const loadTransactions = async () => {
      if (!isOpen || initialTransactionId || mode === 'reply') return;

      setIsLoadingTransactions(true);
      try {
        await icpService.initialize();
        // getAllTransactions is admin-gated → returns empty for regular users.
        // getMyTransactions filters server-side via hasAccess (createdBy/buyer/seller/accessList).
        const userTxs = await icpService.getMyTransactions();

        const txOptions: TransactionOption[] = userTxs.map((tx: any) => ({
          id: tx.id,
          propertyAddress: tx.propertyAddress || 'Unknown Property',
          status: tx.status || 'active',
        }));

        setTransactions(txOptions);
      } catch (err) {
        logger.error('Error loading transactions:', err);
      } finally {
        setIsLoadingTransactions(false);
      }
    };

    loadTransactions();
  }, [isOpen, initialTransactionId, currentPrincipal, mode]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setRecipient(initialRecipient);
      setSubject(draftSubject || '');
      setContent(draftContent || '');
      setMessageType(initialMessageType);
      setPriority('normal');
      setSendEmailNotification(true);
      setError(null);
      setSelectedTransactionId(initialTransactionId);
      setShowTransactionDropdown(false);
    }
  }, [isOpen, initialRecipient, draftContent, draftSubject, initialMessageType, initialTransactionId]);

  // Clear recipient when transaction changes
  useEffect(() => {
    if (selectedTransactionId !== initialTransactionId) {
      setRecipient(undefined);
    }
  }, [selectedTransactionId, initialTransactionId]);

  const transactionId = selectedTransactionId || initialTransactionId;

  const handleSend = async () => {
    if (mode === 'new') {
      if (!transactionId) {
        setError('Please select a transaction');
        return;
      }
      if (!recipient) {
        setError('Please select a recipient');
        return;
      }
      if (!subject.trim()) {
        setError('Please enter a subject');
        return;
      }
    }
    if (!content.trim()) {
      setError('Please enter a message');
      return;
    }

    setIsSending(true);
    setError(null);

    try {
      await messageService.initialize();

      let sentMessage: Message;

      if (mode === 'reply' && threadId) {
        sentMessage = await messageService.sendMessage({
          threadId,
          content: content.trim(),
          messageType,
          priority,
          senderName: userName,
          senderRole: userRole,
          aiGenerated: !!draftContent,
        });
      } else if (mode === 'new' && recipient && transactionId) {
        const thread = await messageService.createThread({
          transactionId,
          subject: subject.trim(),
          recipients: [recipient.principal],
          initialMessage: content.trim(),
          messageType,
          priority,
          senderName: userName,
          senderRole: userRole,
          aiGenerated: !!draftContent,
        });
        const messages = await messageService.getThreadMessages(thread.id);
        sentMessage = messages[0];
      } else {
        throw new Error('Invalid message configuration');
      }

      onMessageSent?.(sentMessage);
      onClose();
    } catch (err) {
      logger.error('Error sending message:', err);
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  const isAiDraft = !!draftContent;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === 'reply' ? 'Reply to Message' : 'New Message'}
            {isAiDraft && (
              <span className="flex items-center gap-1 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-2 py-1 rounded-full">
                <Bot className="w-3 h-3" />
                AI Draft
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            {mode === 'reply'
              ? 'Send a reply to this conversation'
              : 'Send a message to a transaction stakeholder or any principal'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Transaction selector */}
          {mode === 'new' && !initialTransactionId && (
            <div className="relative">
              <p id="compose-transaction-label" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Transaction
              </p>
              <button
                type="button"
                aria-labelledby="compose-transaction-label"
                onClick={() => !isSending && setShowTransactionDropdown(!showTransactionDropdown)}
                disabled={isSending || isLoadingTransactions}
                className={`
                  w-full flex items-center justify-between gap-2 px-4 py-3 rounded-lg border
                  ${isSending || isLoadingTransactions
                    ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 cursor-not-allowed'
                    : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 hover:border-emerald-500 cursor-pointer'
                  }
                  transition-colors
                `}
              >
                {isLoadingTransactions ? (
                  <span className="flex items-center gap-2 text-slate-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading transactions...
                  </span>
                ) : selectedTransactionId ? (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                      <Home className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium text-slate-900 dark:text-white">
                        {transactions.find(t => t.id === selectedTransactionId)?.propertyAddress || selectedTransactionId}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {selectedTransactionId}
                      </p>
                    </div>
                  </div>
                ) : (
                  <span className="text-slate-500 dark:text-slate-400">
                    Select a transaction...
                  </span>
                )}
                <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${showTransactionDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showTransactionDropdown && (
                <>
                  <div className="absolute z-50 w-full mt-2 bg-white dark:bg-slate-900 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 max-h-64 overflow-y-auto">
                    {transactions.length === 0 ? (
                      <div className="p-4 text-center text-slate-500 dark:text-slate-400 text-sm">
                        No transactions found
                      </div>
                    ) : (
                      transactions.map((tx) => (
                        <button
                          key={tx.id}
                          type="button"
                          onClick={() => {
                            setSelectedTransactionId(tx.id);
                            setShowTransactionDropdown(false);
                          }}
                          className={`
                            w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors
                            ${selectedTransactionId === tx.id ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''}
                          `}
                        >
                          <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                            <Home className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                          </div>
                          <div className="flex-1 text-left min-w-0">
                            <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                              {tx.propertyAddress}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {tx.id} - {tx.status}
                            </p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                  <div className="fixed inset-0 z-40" onClick={() => setShowTransactionDropdown(false)} />
                </>
              )}
            </div>
          )}

          {/* Recipient selector */}
          {mode === 'new' && (
            <div>
              <p className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                To
              </p>
              <RecipientSelector
                transactionId={transactionId}
                selectedRecipient={recipient}
                onSelectRecipient={setRecipient}
                excludePrincipal={currentPrincipal || undefined}
                disabled={isSending}
              />
            </div>
          )}

          {/* Subject */}
          {mode === 'new' && (
            <div>
              <label htmlFor="compose-subject" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Subject
              </label>
              <input
                id="compose-subject"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Enter message subject..."
                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                disabled={isSending}
              />
            </div>
          )}

          {/* Message type */}
          <div>
            <p className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Message Type
            </p>
            <div className="flex flex-wrap gap-2">
              {(['general', 'chase', 'enquiry'] as MessageType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setMessageType(type)}
                  disabled={isSending}
                  className={`
                    px-3 py-1.5 rounded-full text-sm font-medium transition-colors
                    ${messageType === type
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }
                  `}
                >
                  {type === 'general' ? 'General' : type === 'chase' ? 'Chase' : 'Enquiry'}
                </button>
              ))}
            </div>
          </div>

          {/* Priority */}
          <div>
            <p className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Priority
            </p>
            <div className="flex flex-wrap gap-2">
              {(['normal', 'high', 'urgent'] as MessagePriority[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  disabled={isSending}
                  className={`
                    px-3 py-1.5 rounded-full text-sm font-medium transition-colors
                    ${priority === p
                      ? p === 'urgent'
                        ? 'bg-red-500 text-white'
                        : p === 'high'
                        ? 'bg-orange-500 text-white'
                        : 'bg-emerald-500 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }
                  `}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Message content */}
          <div>
            <label htmlFor="compose-message" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Message
            </label>
            <textarea
              id="compose-message"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Type your message..."
              rows={6}
              className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              disabled={isSending}
            />
            {isAiDraft && (
              <p className="mt-1 text-xs text-purple-600 dark:text-purple-400 flex items-center gap-1">
                <Bot className="w-3 h-3" />
                This message was drafted by Oscar. Please review and edit before sending.
              </p>
            )}
          </div>

          {/* Email notification toggle */}
          {mode === 'new' && recipient?.hasEmail && (
            <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
              <input
                type="checkbox"
                id="sendEmail"
                checked={sendEmailNotification}
                onChange={(e) => setSendEmailNotification(e.target.checked)}
                disabled={isSending}
                className="w-4 h-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
              />
              <label htmlFor="sendEmail" className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <Mail className="w-4 h-4" />
                Also send email notification to {recipient.name}
              </label>
            </div>
          )}

          {/* No email warning */}
          {mode === 'new' && recipient && !recipient.hasEmail && (
            <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 rounded-lg text-sm">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>
                {recipient.name} doesn&apos;t have an email address on file. They will only see this message when they log in.
              </span>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              disabled={isSending}
              className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={isSending || !content.trim() || (mode === 'new' && (!transactionId || !recipient || !subject.trim()))}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-lg transition-colors"
            >
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Send Message
                </>
              )}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
