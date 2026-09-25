// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import { Actor, HttpAgent } from '@propxchain/core-client';
import { icpService } from './icp.service';
import {
  ThreadCryptoService,
  isEncryptedContent,
  ENCRYPTED_PLACEHOLDER,
} from './threadCrypto.service';
import { getStorePrincipalId } from '../stores/authStore';
import { logger } from '@/utils/logger';
import {
  Thread,
  ThreadWithUnread,
  Message,
  CreateThreadInput,
  SendMessageInput,
  UserMessagePreferences,
  ChaseRecipient,
  EmailPreference,
  convertCandidThreadWithUnread,
  convertCandidMessage,
  convertCandidThread,
} from '../types/message.types';

// Message Manager canister ID — fallback to mainnet ID matches icp.service.ts pattern,
// since CI build env doesn't inject VITE_MESSAGE_MANAGER_CANISTER_ID.
const MESSAGE_MANAGER_CANISTER_ID = import.meta.env.VITE_MESSAGE_MANAGER_CANISTER_ID || '37una-maaaa-aaaaa-qd3mq-cai';

// IDL Factory for message_manager
const messageManagerIdlFactory = ({ IDL }: { IDL: any }) => {
  const MessageType = IDL.Variant({
    chase: IDL.Null,
    enquiry: IDL.Null,
    response: IDL.Null,
    notification: IDL.Null,
    general: IDL.Null,
  });

  const MessagePriority = IDL.Variant({
    low: IDL.Null,
    normal: IDL.Null,
    high: IDL.Null,
    urgent: IDL.Null,
  });

  const EmailPreference = IDL.Variant({
    immediate: IDL.Null,
    digest: IDL.Null,
    never: IDL.Null,
  });

  const Thread = IDL.Record({
    id: IDL.Text,
    transactionId: IDL.Text,
    subject: IDL.Text,
    participants: IDL.Vec(IDL.Principal),
    createdBy: IDL.Principal,
    createdAt: IDL.Int,
    lastMessageAt: IDL.Int,
    messageCount: IDL.Nat,
    isArchived: IDL.Bool,
  });

  const Message = IDL.Record({
    id: IDL.Text,
    threadId: IDL.Text,
    transactionId: IDL.Text,
    sender: IDL.Principal,
    senderName: IDL.Text,
    senderRole: IDL.Text,
    recipients: IDL.Vec(IDL.Principal),
    messageType: MessageType,
    priority: MessagePriority,
    subject: IDL.Text,
    content: IDL.Text,
    replyToId: IDL.Opt(IDL.Text),
    createdAt: IDL.Int,
    readBy: IDL.Vec(IDL.Principal),
    aiGenerated: IDL.Bool,
  });

  const ThreadWithUnread = IDL.Record({
    thread: Thread,
    unreadCount: IDL.Nat,
    lastMessage: IDL.Opt(Message),
  });

  const CreateThreadInput = IDL.Record({
    transactionId: IDL.Text,
    subject: IDL.Text,
    recipients: IDL.Vec(IDL.Principal),
    initialMessage: IDL.Text,
    messageType: MessageType,
    priority: MessagePriority,
    senderName: IDL.Text,
    senderRole: IDL.Text,
    aiGenerated: IDL.Bool,
  });

  const SendMessageInput = IDL.Record({
    threadId: IDL.Text,
    content: IDL.Text,
    messageType: MessageType,
    priority: MessagePriority,
    senderName: IDL.Text,
    senderRole: IDL.Text,
    replyToId: IDL.Opt(IDL.Text),
    aiGenerated: IDL.Bool,
  });

  const UserMessagePreferences = IDL.Record({
    principal: IDL.Principal,
    emailPreference: EmailPreference,
    muteUntil: IDL.Opt(IDL.Int),
  });

  const CreateEncryptedThreadInput = IDL.Record({
    transactionId: IDL.Text,
    subject: IDL.Text,
    recipients: IDL.Vec(IDL.Principal),
    messageType: MessageType,
    priority: MessagePriority,
    senderName: IDL.Text,
    senderRole: IDL.Text,
    aiGenerated: IDL.Bool,
  });

  const Result = (ok: any, err: any) => IDL.Variant({ ok, err });

  return IDL.Service({
    createThread: IDL.Func([CreateThreadInput], [Result(Thread, IDL.Text)], []),
    createEncryptedThread: IDL.Func([CreateEncryptedThreadInput], [Result(Thread, IDL.Text)], []),
    getThreadKey: IDL.Func([IDL.Text, IDL.Vec(IDL.Nat8)], [Result(IDL.Vec(IDL.Nat8), IDL.Text)], []),
    getThreadVerificationKey: IDL.Func([], [IDL.Vec(IDL.Nat8)], []),
    getMyThreads: IDL.Func([], [IDL.Vec(ThreadWithUnread)], ['query']),
    getTransactionThreads: IDL.Func([IDL.Text], [IDL.Vec(ThreadWithUnread)], ['query']),
    archiveThread: IDL.Func([IDL.Text], [Result(IDL.Bool, IDL.Text)], []),
    sendMessage: IDL.Func([SendMessageInput], [Result(Message, IDL.Text)], []),
    getThreadMessages: IDL.Func([IDL.Text], [Result(IDL.Vec(Message), IDL.Text)], ['query']),
    markAsRead: IDL.Func([IDL.Text], [Result(IDL.Bool, IDL.Text)], []),
    markThreadAsRead: IDL.Func([IDL.Text], [Result(IDL.Nat, IDL.Text)], []),
    getUnreadCount: IDL.Func([], [IDL.Nat], ['query']),
    getUnreadMessages: IDL.Func([], [IDL.Vec(Message)], ['query']),
    getMySentMessages: IDL.Func([], [IDL.Vec(Message)], ['query']),
    updateEmailPreference: IDL.Func([EmailPreference], [IDL.Bool], []),
    getMyPreferences: IDL.Func([], [IDL.Opt(UserMessagePreferences)], ['query']),
    getThread: IDL.Func([IDL.Text], [IDL.Opt(Thread)], ['query']),
    getMessage: IDL.Func([IDL.Text], [IDL.Opt(Message)], ['query']),
    getStats: IDL.Func([], [IDL.Record({ threadCount: IDL.Nat, messageCount: IDL.Nat })], ['query']),
    getCycles: IDL.Func([], [IDL.Nat], ['query']),
  });
};

class MessageService {
  private actor: any = null;
  private agent: HttpAgent | null = null;
  private initialized: boolean = false;

  // vetKD per-thread encryption (#20 Part B, ADR 0011). All NEW message
  // content is encrypted client-side; the canister stores ciphertext only.
  private crypto: ThreadCryptoService = new ThreadCryptoService(
    async (threadId: string, transportPublicKey: Uint8Array): Promise<Uint8Array> => {
      await this.ensureActor();
      const result = await this.actor.getThreadKey(threadId, transportPublicKey);
      if ('err' in result) {
        throw new Error(result.err);
      }
      return Uint8Array.from(result.ok);
    },
    async (): Promise<Uint8Array> => {
      await this.ensureActor();
      const bytes = await this.actor.getThreadVerificationKey();
      return Uint8Array.from(bytes);
    }
  );

  async initialize(): Promise<void> {
    if (this.initialized && this.actor) {
      return;
    }

    try {
      await icpService.initialize();

      // Use the authenticated agent so canister calls identify the correct caller
      const authAgent = await icpService.getAuthenticatedAgent();
      if (authAgent) {
        this.agent = authAgent;
      } else {
        logger.warn('No authenticated agent available, falling back to anonymous');
        this.agent = new HttpAgent({ host: 'https://ic0.app' });
      }

      if (MESSAGE_MANAGER_CANISTER_ID) {
        this.actor = Actor.createActor(messageManagerIdlFactory, {
          agent: this.agent,
          canisterId: MESSAGE_MANAGER_CANISTER_ID,
        });
        this.initialized = true;
        logger.info('Message service initialized with authenticated agent');
      } else {
        logger.warn('Message manager canister ID not configured');
      }
    } catch (error) {
      logger.error('Failed to initialize message service:', error);
      throw error;
    }
  }

  /**
   * Force re-initialization with current auth state.
   * Call when user logs in/out or identity changes.
   */
  async reinitialize(): Promise<void> {
    this.initialized = false;
    this.actor = null;
    this.agent = null;
    this.crypto.reset();
    await this.initialize();
  }

  private async ensureActor(): Promise<void> {
    if (!this.actor) {
      await this.initialize();
    }
    if (!this.actor) {
      throw new Error('Message service not initialized. Canister ID may not be configured.');
    }
  }

  /**
   * Create a thread with an encrypted initial message. The per-thread key
   * derives from the threadId (which must exist first), so this is a
   * two-step: createEncryptedThread → encrypt → sendMessage (ADR 0011).
   */
  async createThread(input: CreateThreadInput): Promise<Thread> {
    await this.ensureActor();

    const { Principal } = await import('@propxchain/core-client');
    const { initialMessage, ...threadFields } = input;
    const candidInput = {
      ...threadFields,
      recipients: input.recipients.map((p) => Principal.fromText(p)),
      messageType: { [input.messageType]: null },
      priority: { [input.priority]: null },
    };

    const result = await this.actor.createEncryptedThread(candidInput);

    if ('err' in result) {
      throw new Error(result.err);
    }

    const thread = convertCandidThread(result.ok);

    await this.sendMessage({
      threadId: thread.id,
      content: initialMessage,
      messageType: input.messageType,
      priority: input.priority,
      senderName: input.senderName,
      senderRole: input.senderRole,
      replyToId: undefined,
      aiGenerated: input.aiGenerated,
    });

    return thread;
  }

  /**
   * Thread-list previews show a lock placeholder for encrypted content
   * instead of decrypting — deriving a key per listed thread would cost
   * the canister ~26B cycles each (ADR 0011). Decryption happens when the
   * thread is opened (getThreadMessages).
   */
  private maskEncryptedPreview(threadWithUnread: ThreadWithUnread): ThreadWithUnread {
    const last = threadWithUnread.lastMessage;
    if (last && isEncryptedContent(last.content)) {
      return {
        ...threadWithUnread,
        lastMessage: { ...last, content: ENCRYPTED_PLACEHOLDER },
      };
    }
    return threadWithUnread;
  }

  async getMyThreads(): Promise<ThreadWithUnread[]> {
    await this.ensureActor();
    const threads = await this.actor.getMyThreads();
    return threads.map(convertCandidThreadWithUnread).map((t: ThreadWithUnread) => this.maskEncryptedPreview(t));
  }

  async getTransactionThreads(transactionId: string): Promise<ThreadWithUnread[]> {
    await this.ensureActor();
    const threads = await this.actor.getTransactionThreads(transactionId);
    return threads.map(convertCandidThreadWithUnread).map((t: ThreadWithUnread) => this.maskEncryptedPreview(t));
  }

  async sendMessage(input: SendMessageInput): Promise<Message> {
    await this.ensureActor();

    // Encrypt before anything leaves the client — the canister only ever
    // sees vetkd:v1:<base64> ciphertext for new messages.
    const ciphertext = await this.crypto.encryptContent(input.threadId, input.content);

    const candidInput = {
      ...input,
      content: ciphertext,
      messageType: { [input.messageType]: null },
      priority: { [input.priority]: null },
      replyToId: input.replyToId ? [input.replyToId] : [],
    };

    const result = await this.actor.sendMessage(candidInput);

    if ('err' in result) {
      throw new Error(result.err);
    }

    const message = convertCandidMessage(result.ok);
    return { ...message, content: input.content };
  }

  async getThreadMessages(threadId: string): Promise<Message[]> {
    await this.ensureActor();

    const result = await this.actor.getThreadMessages(threadId);

    if ('err' in result) {
      throw new Error(result.err);
    }

    const messages: Message[] = result.ok.map(convertCandidMessage);
    return Promise.all(
      messages.map(async (m) => ({
        ...m,
        content: await this.crypto.decryptContent(threadId, m.content),
      }))
    );
  }

  async markAsRead(messageId: string): Promise<boolean> {
    await this.ensureActor();

    const result = await this.actor.markAsRead(messageId);
    return 'ok' in result ? result.ok : false;
  }

  async markThreadAsRead(threadId: string): Promise<number> {
    await this.ensureActor();

    const result = await this.actor.markThreadAsRead(threadId);
    return 'ok' in result ? Number(result.ok) : 0;
  }

  async getUnreadCount(): Promise<number> {
    await this.ensureActor();
    const count = await this.actor.getUnreadCount();
    return Number(count);
  }

  async getStats(): Promise<{ threadCount: number; messageCount: number }> {
    await this.ensureActor();
    const stats = await this.actor.getStats();
    return {
      threadCount: Number(stats.threadCount),
      messageCount: Number(stats.messageCount),
    };
  }

  async archiveThread(threadId: string): Promise<boolean> {
    await this.ensureActor();

    const result = await this.actor.archiveThread(threadId);
    return 'ok' in result ? result.ok : false;
  }

  async updateEmailPreference(preference: EmailPreference): Promise<boolean> {
    await this.ensureActor();
    return await this.actor.updateEmailPreference({ [preference]: null });
  }

  async getMyPreferences(): Promise<UserMessagePreferences | null> {
    await this.ensureActor();

    const result = await this.actor.getMyPreferences();

    if (result.length === 0) {
      return null;
    }

    const prefs = result[0];
    return {
      principal: prefs.principal.toText(),
      emailPreference: Object.keys(prefs.emailPreference)[0] as EmailPreference,
      muteUntil: prefs.muteUntil.length > 0 ? new Date(Number(prefs.muteUntil[0]) / 1_000_000) : undefined,
    };
  }

  async getChaseableStakeholders(transactionId: string): Promise<ChaseRecipient[]> {
    try {
      const transaction = await icpService.getTransaction(transactionId);
      if (!transaction) {
        return [];
      }

      const currentPrincipal = getStorePrincipalId();
      const stakeholders: ChaseRecipient[] = [];

      const getDisplayName = (fullName: string): string => {
        if (!fullName || fullName === 'Unknown') return 'Unknown';
        const parts = fullName.trim().split(/\s+/);
        // GDPR: Show first name only, last initial if available
        if (parts.length > 1) {
          return `${parts[0]} ${parts[parts.length - 1][0]}.`;
        }
        return parts[0];
      };

      // Developers register via Supabase only and don't get a UserProfile in
      // user_management, so getUserProfile returns null for their org principal.
      // Fall back to a short-form principal so the recipient is at least
      // identifiable (same shape used by the manual-entry path).
      const principalShortForm = (p: string): string => `${p.slice(0, 8)}…${p.slice(-5)}`;

      const addStakeholder = async (
        principal: string | undefined,
        role: ChaseRecipient['role'],
        roleDisplay: string
      ) => {
        if (!principal) return;

        try {
          const profile = await icpService.getUserProfile(principal);

          stakeholders.push({
            principal,
            name: profile?.name ? getDisplayName(profile.name) : principalShortForm(principal),
            email: profile?.email || undefined,
            role,
            roleDisplay,
            canChase: principal !== currentPrincipal,
            hasEmail: !!profile?.email,
            lastActive: profile?.createdAt ? new Date(profile.createdAt) : undefined,
          });
        } catch {
          stakeholders.push({
            principal,
            name: principalShortForm(principal),
            email: undefined,
            role,
            roleDisplay,
            canChase: principal !== currentPrincipal,
            hasEmail: false,
          });
        }
      };

      const principalToString = (p: any): string | undefined => {
        if (!p) return undefined;
        if (typeof p === 'string') return p;
        if (p.toText) return p.toText();
        if (p.toString) return p.toString();
        return undefined;
      };

      const buyerPrincipal = principalToString(transaction.buyer);
      const sellerPrincipal = principalToString(transaction.seller);

      logger.info('[MessageService] Transaction stakeholders:', {
        buyer: buyerPrincipal,
        seller: sellerPrincipal,
        solicitor: transaction.solicitor,
        accessList: transaction.accessList,
      });

      await addStakeholder(buyerPrincipal, 'buyer', 'Buyer');
      await addStakeholder(sellerPrincipal, 'seller', 'Seller');

      if (transaction.solicitor && transaction.solicitor.length > 0) {
        const solicitorPrincipal = principalToString(transaction.solicitor[0]);
        await addStakeholder(solicitorPrincipal, 'solicitor', 'Solicitor/Conveyancer');
      }

      if (transaction.accessList && transaction.accessList.length > 0) {
        for (const principal of transaction.accessList) {
          const principalStr = principalToString(principal);
          if (!principalStr || stakeholders.some((s) => s.principal === principalStr)) {
            continue;
          }
          await addStakeholder(principalStr, 'other', 'Participant');
        }
      }

      logger.info('[MessageService] Found stakeholders:', stakeholders.map(s => ({ name: s.name, role: s.roleDisplay })));

      return stakeholders;
    } catch (error) {
      logger.error('Error getting chaseable stakeholders:', error);
      return [];
    }
  }

  async sendChaseMessage(params: {
    transactionId: string;
    recipient: ChaseRecipient;
    subject: string;
    content: string;
    senderName: string;
    senderRole: string;
    sendEmailNotification?: boolean;
  }): Promise<{ thread: Thread; message: Message }> {
    const { transactionId, recipient, subject, content, senderName, senderRole } = params;

    const thread = await this.createThread({
      transactionId,
      subject,
      recipients: [recipient.principal],
      initialMessage: content,
      messageType: 'chase',
      priority: 'normal',
      senderName,
      senderRole,
      aiGenerated: true,
    });

    const messages = await this.getThreadMessages(thread.id);
    const message = messages[0];

    return { thread, message };
  }
}

export const messageService = new MessageService();
