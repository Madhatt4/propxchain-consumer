// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

export type MessageType = 'chase' | 'enquiry' | 'response' | 'notification' | 'general';
export type MessagePriority = 'low' | 'normal' | 'high' | 'urgent';
export type EmailPreference = 'immediate' | 'digest' | 'never';

export interface Thread {
  id: string;
  transactionId: string;
  subject: string;
  participants: string[];
  createdBy: string;
  createdAt: Date;
  lastMessageAt: Date;
  messageCount: number;
  isArchived: boolean;
}

export interface Message {
  id: string;
  threadId: string;
  transactionId: string;
  sender: string;
  senderName: string;
  senderRole: string;
  recipients: string[];
  messageType: MessageType;
  priority: MessagePriority;
  subject: string;
  content: string;
  replyToId?: string;
  createdAt: Date;
  readBy: string[];
  aiGenerated: boolean;
}

export interface ThreadWithUnread {
  thread: Thread;
  unreadCount: number;
  lastMessage?: Message;
}

export interface CreateThreadInput {
  transactionId: string;
  subject: string;
  recipients: string[];
  initialMessage: string;
  messageType: MessageType;
  priority: MessagePriority;
  senderName: string;
  senderRole: string;
  aiGenerated: boolean;
}

export interface SendMessageInput {
  threadId: string;
  content: string;
  messageType: MessageType;
  priority: MessagePriority;
  senderName: string;
  senderRole: string;
  replyToId?: string;
  aiGenerated: boolean;
}

export interface UserMessagePreferences {
  principal: string;
  emailPreference: EmailPreference;
  muteUntil?: Date;
}

export interface ChaseRecipient {
  principal: string;
  name: string;
  email?: string;
  role: 'buyer' | 'seller' | 'solicitor' | 'estate_agent' | 'mortgage_broker' | 'other';
  roleDisplay: string;
  canChase: boolean;
  hasEmail: boolean;
  lastActive?: Date;
}

export interface ComposeMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMessageSent?: (message: Message) => void;
  transactionId?: string;
  recipient?: ChaseRecipient;
  draftContent?: string;
  draftSubject?: string;
  messageType?: MessageType;
  mode?: 'new' | 'reply';
  threadId?: string;
}

export interface RecipientSelectorProps {
  transactionId?: string;
  selectedRecipient?: ChaseRecipient;
  onSelectRecipient: (recipient: ChaseRecipient | undefined) => void;
  excludePrincipal?: string;
  disabled?: boolean;
}

// Helper functions to convert Candid types
export const convertCandidThread = (candid: any): Thread => ({
  id: candid.id,
  transactionId: candid.transactionId,
  subject: candid.subject,
  participants: candid.participants.map((p: any) => p.toText?.() || p.toString()),
  createdBy: candid.createdBy.toText?.() || candid.createdBy.toString(),
  createdAt: new Date(Number(candid.createdAt) / 1_000_000),
  lastMessageAt: new Date(Number(candid.lastMessageAt) / 1_000_000),
  messageCount: Number(candid.messageCount),
  isArchived: candid.isArchived,
});

export const convertCandidMessage = (candid: any): Message => ({
  id: candid.id,
  threadId: candid.threadId,
  transactionId: candid.transactionId,
  sender: candid.sender.toText?.() || candid.sender.toString(),
  senderName: candid.senderName,
  senderRole: candid.senderRole,
  recipients: candid.recipients.map((p: any) => p.toText?.() || p.toString()),
  messageType: Object.keys(candid.messageType)[0] as MessageType,
  priority: Object.keys(candid.priority)[0] as MessagePriority,
  subject: candid.subject,
  content: candid.content,
  replyToId: candid.replyToId?.[0] || undefined,
  createdAt: new Date(Number(candid.createdAt) / 1_000_000),
  readBy: candid.readBy.map((p: any) => p.toText?.() || p.toString()),
  aiGenerated: candid.aiGenerated,
});

export const convertCandidThreadWithUnread = (candid: any): ThreadWithUnread => ({
  thread: convertCandidThread(candid.thread),
  unreadCount: Number(candid.unreadCount),
  lastMessage: candid.lastMessage?.[0] ? convertCandidMessage(candid.lastMessage[0]) : undefined,
});

export const getRoleDisplayName = (role: ChaseRecipient['role']): string => {
  const roleNames: Record<ChaseRecipient['role'], string> = {
    buyer: 'Buyer',
    seller: 'Seller',
    solicitor: 'Solicitor',
    estate_agent: 'Estate Agent',
    mortgage_broker: 'Mortgage Broker',
    other: 'Participant',
  };
  return roleNames[role] || 'Unknown';
};
