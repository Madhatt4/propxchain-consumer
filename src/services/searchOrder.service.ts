import { supabase } from '../lib/supabase';
import type { SearchItem } from './searchProviderData';

export interface SearchOrder {
  id: string;
  transactionId: string;
  provider: string;
  packageType: string;
  searches: SearchItem[];
  subtotalPence: number;
  vatPence: number;
  priority: boolean;
  priorityFeePence: number;
  totalPence: number;
  status: string;
  orderedBy: string;
  postcode: string;
  localAuthority: string | null;
  createdAt: string;
}

interface CreateOrderPayload {
  transactionId: string;
  provider: string;
  packageType: 'standard' | 'custom' | 'lineItem';
  searches: SearchItem[];
  subtotalPence: number;
  vatPence: number;
  priority: boolean;
  priorityFeePence: number;
  totalPence: number;
  orderedBy: 'buyer' | 'seller';
  postcode: string;
  localAuthority: string | null;
  /**
   * Defaults to 'requested', because at insert time nobody has paid: the
   * supplier order is placed by the worker's confirm-payment route, and the
   * row is promoted to 'ordered' by payment-worker's /verify-session once
   * Stripe reports the money moved. Writing 'ordered' here left every
   * abandoned checkout claiming a search had been bought. Only a path where
   * nothing is owed (demo mode) passes 'ordered' outright.
   */
  status?: 'ordered' | 'requested';
}

async function createOrder(
  payload: CreateOrderPayload,
): Promise<{ success: boolean; orderId?: string; error?: string }> {
  const { data, error } = await supabase
    .from('search_orders')
    .insert({
      transaction_id: payload.transactionId,
      provider: payload.provider,
      package_type: payload.packageType,
      searches: payload.searches,
      subtotal_pence: payload.subtotalPence,
      vat_pence: payload.vatPence,
      priority: payload.priority,
      priority_fee_pence: payload.priorityFeePence,
      total_pence: payload.totalPence,
      status: payload.status ?? 'requested',
      ordered_by: payload.orderedBy,
      postcode: payload.postcode,
      local_authority: payload.localAuthority,
    })
    .select('id')
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, orderId: data.id };
}

/**
 * Email OneSearch about a `lineItem` costing request.
 *
 * Full-catalogue products have no agreed trade price, so they can't be ordered
 * and paid for — the request reaches OneSearch as an email or not at all. The
 * `search_orders` row on its own reached nobody, so a failure here means the
 * customer's request is genuinely lost and must be surfaced, not swallowed.
 *
 * The edge function builds the email from the stored row and is idempotent on
 * `notified_at`, so retrying a failure is safe.
 */
async function notifyCostingRequest(
  orderId: string,
): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.functions.invoke('onesearch-costing-request', {
    body: { orderId },
  });
  if (error) return { success: false, error: error.message };
  if (!data?.success) return { success: false, error: data?.error ?? 'unknown_error' };
  return { success: true };
}

async function getOrdersForTransaction(transactionId: string): Promise<SearchOrder[]> {
  const { data, error } = await supabase
    .from('search_orders')
    .select('*')
    .eq('transaction_id', transactionId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    transactionId: row.transaction_id,
    provider: row.provider,
    packageType: row.package_type,
    searches: row.searches as SearchItem[],
    subtotalPence: row.subtotal_pence,
    vatPence: row.vat_pence,
    priority: row.priority,
    priorityFeePence: row.priority_fee_pence,
    totalPence: row.total_pence,
    status: row.status,
    orderedBy: row.ordered_by,
    postcode: row.postcode,
    localAuthority: row.local_authority,
    createdAt: row.created_at,
  }));
}

export const searchOrderService = {
  createOrder,
  notifyCostingRequest,
  getOrdersForTransaction,
};
