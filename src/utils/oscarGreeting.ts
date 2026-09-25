/**
 * Oscar Greeting Generation Utility
 *
 * Generates context-aware greetings based on the user's transaction status.
 * Part of Phase 4: Context-Aware Responses
 */

import { isTransactionStatus, type TransactionStatus } from '@/types/transactionStatus';

/**
 * Maps raw transaction status codes to friendly display text.
 * Handles both string statuses and ICP Candid-style variant objects.
 *
 * @param status - Raw status string or variant object (e.g., {Active: null})
 * @returns Friendly display text (e.g., "in progress")
 */
export function formatStatusForDisplay(status: string | object): string {
  // Handle ICP Candid-style variant objects: {Active: null} -> 'Active'
  let normalizedStatus: string;
  if (typeof status === 'object' && status !== null) {
    const keys = Object.keys(status);
    normalizedStatus = keys.length > 0 ? keys[0] : 'unknown';
  } else {
    normalizedStatus = String(status);
  }

  // Map to friendly display text (case-insensitive matching)
  const statusLower = normalizedStatus.toLowerCase();

  const statusMap: Record<TransactionStatus, string> = {
    active: 'in progress',
    exchanged: 'exchanged',
    completion_initiated: 'completing',
    blockchain_completed: 'completed',
    land_registry_registered: 'registered',
  };

  return isTransactionStatus(statusLower) ? statusMap[statusLower] : statusLower;
}

/**
 * Generates a context-aware greeting based on the user's transactions.
 *
 * @param transactions - Array of transaction objects (any shape, status extracted)
 * @param userName - Optional user name for personalization
 * @returns Greeting string with transaction summary
 *
 * @example
 * // No transactions
 * generateOscarGreeting([])
 * // => "Hi! I'm Oscar, your conveyancing assistant. No active transactions yet. Ready to start one?"
 *
 * @example
 * // With transactions
 * generateOscarGreeting([{status: 'Active'}, {status: {DocumentCollection: null}}])
 * // => "Hi! I'm Oscar. You have 2 active: 1 in progress, 1 awaiting documents. How can I help?"
 */
export function generateOscarGreeting(transactions: any[], userName?: string): string {
  const greeting = userName ? `Hi, ${userName}! I'm Oscar` : "Hi! I'm Oscar";

  // No transactions case
  if (!transactions || transactions.length === 0) {
    return `${greeting}, your conveyancing assistant. No active transactions yet. Ready to start one?`;
  }

  // Count transactions by friendly status
  const statusCounts: Record<string, number> = {};

  for (const tx of transactions) {
    // Extract status - handle both direct string and variant object
    const rawStatus = tx.status;
    const friendlyStatus = formatStatusForDisplay(rawStatus);
    statusCounts[friendlyStatus] = (statusCounts[friendlyStatus] || 0) + 1;
  }

  // Build status summary: "1 awaiting documents, 2 in progress"
  const statusParts = Object.entries(statusCounts)
    .map(([status, count]) => `${count} ${status}`)
    .join(', ');

  const transactionWord = transactions.length === 1 ? 'transaction' : 'transactions';

  return `${greeting}. You have ${transactions.length} active ${transactionWord}: ${statusParts}. How can I help?`;
}

/**
 * Returns just the context portion of the greeting (for use in split display).
 * Excludes "Hi! I'm Oscar" prefix.
 *
 * @param transactions - Array of transaction objects
 * @returns Context-only portion of the greeting
 */
export function getGreetingContext(transactions: any[]): string {
  if (!transactions || transactions.length === 0) {
    return "Your AI assistant for property conveyancing. No active transactions yet - ready to start one?";
  }

  // Count transactions by friendly status
  const statusCounts: Record<string, number> = {};

  for (const tx of transactions) {
    const rawStatus = tx.status;
    const friendlyStatus = formatStatusForDisplay(rawStatus);
    statusCounts[friendlyStatus] = (statusCounts[friendlyStatus] || 0) + 1;
  }

  // Build status summary
  const statusParts = Object.entries(statusCounts)
    .map(([status, count]) => `${count} ${status}`)
    .join(', ');

  const transactionWord = transactions.length === 1 ? 'transaction' : 'transactions';

  return `You have ${transactions.length} active ${transactionWord}: ${statusParts}. How can I help?`;
}
