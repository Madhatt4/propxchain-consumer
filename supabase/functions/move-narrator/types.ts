/**
 * Shared types for the move-narrator edge function.
 *
 * The NextStep* shapes mirror src/services/next-step.service.ts so the frontend
 * can forward a getNextStep recommendation verbatim.
 */

export type NextStepUrgency = 'blocking' | 'soon' | 'later';

export interface NextStepOption {
  action: string;
  displayLabel: string;
  whyThis: string;
  estimatedDelayIfSkipped?: number;
  panelMatchCount?: number;
}

export interface NextStepRecommendation {
  blocker: string;
  blockerLabel: string;
  options: NextStepOption[];
  urgency: NextStepUrgency;
  why: string;
  partial: boolean;
}

export interface TransactionContext {
  txId: string;
  url: string;
  role: 'buyer' | 'seller';
  propertyAddress: string;
  /** The blocker BEFORE this change, so the narrator can say what just progressed. */
  previousBlocker: string;
}

export interface Recipient {
  email?: string;
  /** E.164 mobile, e.g. +447700900123 — required for SMS delivery. */
  mobile?: string;
}

export interface InAppNotification {
  title: string;
  body: string;
  txUrl: string;
  urgency: string;
}

export interface NarrationOutputs {
  notification: InAppNotification | null;
  emailMarkdown: string | null;
  sms: string | null;
}

export interface ChannelResult {
  channel: 'in_app' | 'email' | 'sms';
  status: 'sent' | 'skipped' | 'error' | 'returned_to_client';
  detail?: string;
}

export type FireAction = { action: 'fire'; transaction: TransactionContext; getNextStep: NextStepRecommendation };
/**
 * `txId` is optional and telemetry-only: it lets the server attribute the
 * `narrator_verdict` event (emitted once the run settles) to a transaction
 * without re-deriving it from the Anthropic session. The client already holds
 * it from the `fire` call that started this session. Absent txId just means
 * that one telemetry emit is skipped — it never affects poll behaviour.
 */
export type StatusAction = { action: 'status'; sessionId: string; txId?: string };
/**
 * No `recipient` field by design. The delivery address is derived from the
 * authenticated session server-side (see index.ts `recipientFromUser`) so a
 * caller can never direct PropXchain-branded email or SMS at a third party.
 *
 * `txId` is optional and telemetry-only — see StatusAction above.
 */
export type DeliverAction = { action: 'deliver'; sessionId: string; txId?: string };
export type NarratorRequest = FireAction | StatusAction | DeliverAction;

/**
 * Server-to-server nudge path for the transaction-monitor cron (chunk 2).
 * Bearer-secret gated in index.ts, never accepted on the user-JWT path — see
 * `validateMonitorFireRequest` in validate.ts and `runMonitorFire` in
 * monitor.ts. Deliberately NOT a member of `NarratorRequest`: it is routed
 * and validated separately, before any end-user session exists.
 */
export type MonitorFireAction = {
  action: 'monitor_fire';
  txId: string;
  previousBlocker: string;
  blocker: string;
  urgency: NextStepUrgency;
};
