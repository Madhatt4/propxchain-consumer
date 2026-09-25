import { supabase } from '../lib/supabase';
import { icpService } from './icp.service';
import { logger } from '@/utils/logger';
import type { ConveyancerQuote, RequestQuotesPayload } from '../components/providers/types';

// In-memory dedupe for quote_received audit events within a session. Survives
// repeated getQuotesForTransaction polls but not page reloads. A future
// audit_logged_at column on conveyancer_quotes would cover the reload case;
// for Tier 1, append-only ledger tolerates the occasional duplicate.
const auditedQuoteIds = new Set<string>();

interface ConveyancerQuoteRow {
  id: string;
  transaction_id: string;
  conveyancer_id: string;
  conveyancer_panel?: { practice_name?: string } | null;
  status: ConveyancerQuote['status'];
  property_address: string;
  title_number?: string | null;
  tenure?: string | null;
  transaction_type: string;
  legal_fee?: number | null;
  disbursements_estimate?: number | null;
  vat?: number | null;
  estimated_weeks?: number | null;
  conditions?: string | null;
  quoted_at?: string | null;
  accepted_at?: string | null;
  created_at: string;
}

function mapQuoteRow(row: ConveyancerQuoteRow): ConveyancerQuote {
  return {
    id: row.id,
    transactionId: row.transaction_id,
    conveyancerId: row.conveyancer_id,
    conveyancerName: row.conveyancer_panel?.practice_name || 'Unknown',
    status: row.status,
    propertyAddress: row.property_address,
    titleNumber: row.title_number ?? undefined,
    tenure: row.tenure ?? undefined,
    transactionType: row.transaction_type,
    legalFee: row.legal_fee ?? undefined,
    disbursementsEstimate: row.disbursements_estimate ?? undefined,
    vat: row.vat ?? undefined,
    estimatedWeeks: row.estimated_weeks ?? undefined,
    conditions: row.conditions ?? undefined,
    quotedAt: row.quoted_at ?? undefined,
    acceptedAt: row.accepted_at ?? undefined,
    createdAt: row.created_at,
  };
}

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Canonical JSON of structured fields. Fixed key order via object literal
// (ES2015+ preserves insertion order). Future verifiers reproduce the same
// string by re-rendering with the same key order, then re-hash to verify
// against the on-chain record.
function canonicalQuoteJson(quote: ConveyancerQuote): string {
  return JSON.stringify({
    conveyancerId: quote.conveyancerId,
    legalFee: quote.legalFee ?? null,
    disbursementsEstimate: quote.disbursementsEstimate ?? null,
    vat: quote.vat ?? null,
    estimatedWeeks: quote.estimatedWeeks ?? null,
    conditions: quote.conditions ?? null,
    quotedAt: quote.quotedAt ?? null,
  });
}

function totalAmountPence(quote: ConveyancerQuote): bigint {
  const sum = (quote.legalFee ?? 0) + (quote.disbursementsEstimate ?? 0) + (quote.vat ?? 0);
  return BigInt(Math.round(sum));
}

interface AuditResult {
  ok?: null;
  err?: string;
}

async function auditQuoteRequested(txId: string, conveyancerId: string): Promise<void> {
  try {
    const actor = icpService.transactionManager;
    if (!actor) {
      logger.warn('[conveyancerAudit] actor unavailable, skipping quote_requested', { txId, conveyancerId });
      return;
    }
    const result = (await actor.recordQuoteRequested(txId, conveyancerId)) as AuditResult;
    if ('err' in result && result.err) {
      logger.error('[conveyancerAudit] recordQuoteRequested err', { txId, conveyancerId, err: result.err });
    }
  } catch (err) {
    logger.error('[conveyancerAudit] recordQuoteRequested threw', { txId, conveyancerId, err: String(err) });
  }
}

async function auditQuoteReceived(quote: ConveyancerQuote): Promise<void> {
  try {
    const actor = icpService.transactionManager;
    if (!actor) return;
    if (auditedQuoteIds.has(quote.id)) return;
    const amount = totalAmountPence(quote);
    if (amount === 0n) {
      logger.warn('[conveyancerAudit] skipping quote_received with zero amount', { quoteId: quote.id });
      return;
    }
    const quoteHash = await sha256Hex(canonicalQuoteJson(quote));
    const result = (await actor.recordQuoteReceived(
      quote.transactionId,
      quote.conveyancerId,
      quoteHash,
      amount,
    )) as AuditResult;
    if ('err' in result && result.err) {
      logger.error('[conveyancerAudit] recordQuoteReceived err', { quoteId: quote.id, err: result.err });
      return;
    }
    auditedQuoteIds.add(quote.id);
  } catch (err) {
    logger.error('[conveyancerAudit] recordQuoteReceived threw', { quoteId: quote.id, err: String(err) });
  }
}

async function auditConveyancerSelected(quote: ConveyancerQuote): Promise<void> {
  try {
    const actor = icpService.transactionManager;
    if (!actor) return;
    const amount = totalAmountPence(quote);
    if (amount === 0n) {
      logger.warn('[conveyancerAudit] skipping conveyancer_selected with zero amount', { quoteId: quote.id });
      return;
    }
    const quoteHash = await sha256Hex(canonicalQuoteJson(quote));
    const result = (await actor.recordConveyancerSelected(
      quote.transactionId,
      quote.conveyancerId,
      quoteHash,
      amount,
    )) as AuditResult;
    if ('err' in result && result.err) {
      logger.error('[conveyancerAudit] recordConveyancerSelected err', { quoteId: quote.id, err: result.err });
    }
  } catch (err) {
    logger.error('[conveyancerAudit] recordConveyancerSelected threw', { quoteId: quote.id, err: String(err) });
  }
}

async function requestQuotes(payload: RequestQuotesPayload): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.functions.invoke('request-conveyancer-quotes', {
    body: payload,
  });
  if (error) return { success: false, error: error.message };

  for (const conveyancerId of payload.conveyancerIds) {
    void auditQuoteRequested(payload.transactionId, conveyancerId);
  }

  return { success: true, ...data };
}

async function getQuotesForTransaction(transactionId: string): Promise<ConveyancerQuote[]> {
  const { data, error } = await supabase
    .from('conveyancer_quotes')
    .select('*, conveyancer_panel!inner(practice_name)')
    .eq('transaction_id', transactionId)
    .order('created_at', { ascending: true });

  if (error || !data) return [];

  const quotes = (data as ConveyancerQuoteRow[]).map(mapQuoteRow);

  for (const quote of quotes) {
    if (quote.status === 'quoted' && !auditedQuoteIds.has(quote.id)) {
      void auditQuoteReceived(quote);
    }
  }

  return quotes;
}

async function acceptQuote(quoteId: string): Promise<{ success: boolean; error?: string; emailSent?: boolean }> {
  // Server-side accept: marks the quote accepted, auto-declines the losers,
  // issues the winner's one-time join code and emails their activation link.
  const { data, error } = await supabase.functions.invoke('accept-conveyancer-quote', {
    body: { quoteId },
  });
  if (error) return { success: false, error: error.message };

  // The on-chain conveyancer_selected audit stays client-side — it must be
  // signed by the accepting party's own principal, not a service identity.
  const { data: quoteRow } = await supabase
    .from('conveyancer_quotes')
    .select('*, conveyancer_panel!inner(practice_name)')
    .eq('id', quoteId)
    .single();
  if (quoteRow) {
    void auditConveyancerSelected(mapQuoteRow(quoteRow as ConveyancerQuoteRow));
  }

  return { success: true, emailSent: (data as { emailSent?: boolean } | null)?.emailSent };
}

async function declineQuote(quoteId: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('conveyancer_quotes')
    .update({ status: 'declined' })
    .eq('id', quoteId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export const conveyancerQuoteService = {
  requestQuotes,
  getQuotesForTransaction,
  acceptQuote,
  declineQuote,
};

// Exposed for unit tests + debug observability — not part of the public API.
export const __testing__ = {
  sha256Hex,
  canonicalQuoteJson,
  totalAmountPence,
  mapQuoteRow,
  auditQuoteRequested,
  auditQuoteReceived,
  auditConveyancerSelected,
  auditedQuoteIds,
};
