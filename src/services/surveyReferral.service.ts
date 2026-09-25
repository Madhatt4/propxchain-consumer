import { supabase } from '../lib/supabase';

/** Payload for the optimus-survey-referral edge function. Field names mirror
 *  the table format agreed with Optimus (2026-07-23) so the
 *  mapping is auditable end-to-end. */
export interface SurveyReferralPayload {
  transactionId: string;
  customerFirstName: string;
  customerLastName?: string;
  customerEmail: string;
  customerPhone: string;
  propertyAddressLine1: string;
  propertyAddressLine2?: string;
  propertyAddressCity?: string;
  propertyAddressPostcode: string;
  propertyValue: number;
  uprn?: string;
}

export interface SurveyReferralResult {
  success: boolean;
  referralId?: string;
  error?: string;
}

export interface SurveyReferralRecord {
  id: string;
  providerId: string;
  createdAt: string;
  emailSent: boolean;
}

interface SurveyReferralRow {
  id: string;
  provider_id: string;
  created_at: string;
  email_sent: boolean;
}

/** Latest referral the current user sent for this transaction (RLS: own rows
 *  only). Null when none exists or the query fails — callers fall back to the
 *  generic completed-stage UI. */
export async function getSurveyReferralForTransaction(
  transactionId: string,
): Promise<SurveyReferralRecord | null> {
  const { data, error } = await supabase
    .from('survey_referrals')
    .select('id, provider_id, created_at, email_sent')
    .eq('transaction_id', transactionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as SurveyReferralRow;
  return {
    id: row.id,
    providerId: row.provider_id,
    createdAt: row.created_at,
    emailSent: row.email_sent,
  };
}

export async function sendSurveyReferral(
  payload: SurveyReferralPayload,
): Promise<SurveyReferralResult> {
  const { data, error } = await supabase.functions.invoke('optimus-survey-referral', {
    body: payload,
  });
  if (error) return { success: false, error: error.message };
  if (!data?.success) {
    return { success: false, error: data?.error ?? 'Referral email could not be sent' };
  }
  return { success: true, referralId: data.referralId };
}
