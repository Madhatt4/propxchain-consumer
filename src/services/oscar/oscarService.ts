import type {
  ChatResponse,
  Conversation,
  TransactionSummaryInput
} from '../../types/oscar.types';
import { logger } from '../../utils/logger';
import { getStorePrincipalId } from '../../stores/authStore';

// Route Oscar through the Render backend which has the Anthropic API key.
// The Oscar canister is kept for future on-chain persistence but is not called here.
const API_BASE_URL =
  import.meta.env.VITE_OSCAR_BACKEND_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  '';

class OscarService {
  private initialized: boolean = false;

  /**
   * Initialize Oscar service.
   * Accepts an optional parameter (ignored) so callers that previously
   * passed an AuthClient don't break.
   */
  async initialize(_unused?: unknown): Promise<void> {
    if (this.initialized) {
      return;
    }

    const principalId = getStorePrincipalId();
    if (!principalId) {
      throw new Error('Authentication required. Please log in with Internet Identity.');
    }

    if (!API_BASE_URL) {
      logger.warn('Oscar backend URL not configured. Set VITE_OSCAR_BACKEND_URL or VITE_API_BASE_URL in .env');
      throw new Error('Oscar backend URL not configured');
    }

    this.initialized = true;
    logger.info('Oscar service initialized (Render backend:', API_BASE_URL, ')');
  }

  /**
   * Reset the service (for logout)
   */
  reset(): void {
    this.initialized = false;
  }

  /**
   * Send chat message to the Render backend which proxies to Anthropic.
   */
  async chat(
    message: string,
    transactionContext?: string,
    _includeHistory: boolean = true,
    userTransactions: TransactionSummaryInput[] = []
  ): Promise<ChatResponse> {
    if (!this.initialized) {
      throw new Error('Oscar service not initialized');
    }

    const principalId = getStorePrincipalId() || '';
    const userName = localStorage.getItem('userName') || 'User';
    const userRole = localStorage.getItem('userType') || 'user';

    const body = {
      principalId,
      message,
      transactionContext: transactionContext || undefined,
      userContext: {
        userName,
        userRole,
        transactions: userTransactions,
        unreadNotifications: 0,
        pendingDocuments: userTransactions.reduce(
          (sum, tx) => sum + (tx.documentSummary?.pending || 0), 0
        ),
      },
    };

    logger.info('Oscar chat: calling Render backend');

    const response = await fetch(`${API_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Oscar backend error (${response.status}): ${errorText}`);
    }

    const data = await response.json();

    // Normalize the response to match ChatResponse shape
    return {
      message: data.message || data.response || '',
      actions: data.actions || [],
      suggestedFollowups: data.suggestedFollowups || data.suggestions || [],
      tokensUsed: data.tokensUsed || 0,
    };
  }

  async getConversation(): Promise<Conversation | null> {
    // Conversation history is managed server-side by Render
    return null;
  }

  async clearConversation(): Promise<void> {
    if (!this.initialized) {
      throw new Error('Oscar service not initialized');
    }

    const principalId = getStorePrincipalId() || '';

    try {
      await fetch(`${API_BASE_URL}/api/chat/clear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ principalId }),
      });
    } catch (err) {
      logger.warn('Failed to clear conversation on backend:', err);
    }
  }

  async getConversationList(): Promise<Conversation[]> {
    return [];
  }

  async loadConversation(_conversationId: string): Promise<Conversation | null> {
    return null;
  }

  async deleteConversation(_conversationId: string): Promise<void> {
    await this.clearConversation();
  }

  async hasActiveConversation(): Promise<boolean> {
    return false;
  }
}

export const oscarService = new OscarService();
