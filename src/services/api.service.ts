/**
 * Centralized API Service for communicating with the backend
 * Uses environment variables for proper configuration across dev/production
 */

import { logger } from '@/utils/logger';
import { useAuthStore } from '../stores/authStore';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

interface RequestOptions extends RequestInit {
  requiresAuth?: boolean;
}

class ApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  /**
   * Get the authorization header with the JWT token
   */
  private getAuthHeader(): Record<string, string> {
    // Use principalId from auth store as bearer token for backend API calls.
    // Was a CommonJS `require`, which is not defined in the ESM browser bundle:
    // it threw on every call and the catch swallowed it, so `requiresAuth`
    // requests silently went out unauthenticated. Static import — authStore
    // does not import this module back, so there is no cycle.
    const principalId = useAuthStore.getState().principalId;
    return principalId ? { Authorization: `Bearer ${principalId}` } : {};
  }

  /**
   * Build the complete URL for API requests
   */
  private buildUrl(endpoint: string): string {
    // If baseUrl is empty, use relative URL (for Vite proxy in dev)
    // Otherwise, use absolute URL with baseUrl
    if (!this.baseUrl) {
      return endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    }
    const url = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${this.baseUrl}${url}`;
  }

  /**
   * Generic request method
   */
  private async request<T>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const { requiresAuth = false, headers = {}, ...fetchOptions } = options;

    const url = this.buildUrl(endpoint);

    const baseHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const requestHeaders: Record<string, string> = {
      ...baseHeaders,
      // Normalize HeadersInit (Record | Headers | tuple[]) into a plain record.
      ...Object.fromEntries(new Headers(headers)),
      ...(requiresAuth ? this.getAuthHeader() : {}),
    };

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers: requestHeaders,
      });

      // Try to parse JSON response
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || `Request failed with status ${response.status}`);
      }

      return data as T;
    } catch (error) {
      logger.error(`API Error [${endpoint}]:`, error);
      throw error;
    }
  }

  /**
   * GET request
   */
  async get<T>(endpoint: string, requiresAuth = false): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'GET',
      requiresAuth,
    });
  }

  /**
   * POST request
   */
  async post<T>(
    endpoint: string,
    data?: any,
    requiresAuth = false
  ): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
      requiresAuth,
    });
  }

  /**
   * PUT request
   */
  async put<T>(
    endpoint: string,
    data?: any,
    requiresAuth = false
  ): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
      requiresAuth,
    });
  }

  /**
   * PATCH request
   */
  async patch<T>(
    endpoint: string,
    data?: unknown,
    requiresAuth = false
  ): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
      requiresAuth,
    });
  }

  /**
   * DELETE request
   */
  async delete<T>(endpoint: string, requiresAuth = false): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
      requiresAuth,
    });
  }

  // ==================== Auth Endpoints ====================

  async login(email: string, password: string) {
    return this.post('/api/auth/login', { email, password });
  }

  async register(userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
  }) {
    return this.post('/api/auth/register', userData);
  }

  async logout() {
    return this.post('/api/auth/logout', {}, true);
  }

  // ==================== Blockchain Endpoints ====================

  async createBlockchainTransaction(transactionData: {
    propertyAddress: string;
    titleNumber: string;
    propertyType: string;
    parties: any[];
    financialTerms: {
      purchasePrice: number;
      deposit: number;
      completionDate: string;
      mortgageAmount: number;
    };
    specialConditions: string;
    fixturesAndFittings: string;
  }) {
    return this.post(
      '/api/blockchain/transaction/create',
      transactionData,
      true
    );
  }

  async uploadDocumentToBlockchain(documentData: {
    transactionId: string;
    documentId: string;
    documentHash: string;
    name: string;
    category: string;
  }) {
    return this.post('/api/blockchain/document/upload', documentData, true);
  }

  async verifyDocumentOnBlockchain(verificationData: {
    transactionId: string;
    documentId: string;
    verificationLevel: number;
  }) {
    return this.post('/api/blockchain/document/verify', verificationData, true);
  }

  async signContractOnBlockchain(transactionId: string) {
    return this.post('/api/blockchain/contract/sign', { transactionId }, true);
  }

  async markTransactionReady(transactionId: string) {
    return this.post(
      '/api/blockchain/transaction/ready',
      { transactionId },
      true
    );
  }

  async completeTransaction(transactionId: string) {
    return this.post(
      '/api/blockchain/transaction/complete',
      { transactionId },
      true
    );
  }

  async getBlockchainTransaction(transactionId: string) {
    return this.get(`/api/blockchain/transaction/${transactionId}`, true);
  }

  async getUserBlockchainTransactions(userId: string) {
    return this.get(`/api/blockchain/user/${userId}/transactions`, true);
  }

  async getBlockchainStats() {
    return this.get('/api/blockchain/stats', true);
  }

  // ==================== Transaction Endpoints ====================

  async getTransactions() {
    return this.get('/api/transactions', true);
  }

  async getTransaction(id: string) {
    return this.get(`/api/transactions/${id}`, true);
  }

  async createTransaction(transactionData: any) {
    return this.post('/api/transactions', transactionData, true);
  }

  async updateTransaction(id: string, updates: any) {
    return this.put(`/api/transactions/${id}`, updates, true);
  }

  async deleteTransaction(id: string) {
    return this.delete(`/api/transactions/${id}`, true);
  }

  // ==================== Health Check ====================

  async healthCheck() {
    return this.get('/health');
  }
}

// Export singleton instance
export const apiService = new ApiService();
export default apiService;
