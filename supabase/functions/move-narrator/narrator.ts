/**
 * Anthropic Claude Managed Agent calls for the PropXchain Move Narrator.
 *
 * Wraps the agent so ANTHROPIC_API_KEY never leaves the server. The agent
 * (defined out-of-band, see my-agent/) drafts an in-app notification, an email
 * and an SMS from one transaction's authoritative getNextStep state.
 *
 * Secrets / config (Supabase function secrets — never in source):
 *   ANTHROPIC_API_KEY      — the API key
 *   MOVE_NARRATOR_AGENT_ID — the Claude Managed Agent id
 *   MOVE_NARRATOR_ENV_ID   — the agent's environment id
 */

import type {
  NarrationOutputs,
  NextStepRecommendation,
  TransactionContext,
} from './types.ts';

const ANTHROPIC_BASE = 'https://api.anthropic.com/v1';
const AGENT_BETA = 'managed-agents-2026-04-01';

/** Definition of done — keep in sync with my-agent/outcome.md (6 binary criteria). */
const OUTCOME_RUBRIC = `Grade every run against all six binary criteria (pass = true):
1. Grounded — uses only the blocker/options in the provided getNextStep state; invents nothing.
2. Plain English — explains what changed and what's next; jargon defined inline.
3. Who has the ball — names whose action is awaited.
4. One clear action — the single next action, or explicitly "nothing needed".
5. All three deliverables, schema-true — notification.json + email.md + sms.txt.
6. Warm tone; no timeline promises beyond delays present in the data.`;

function headers(apiKey: string): HeadersInit {
  return {
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
    'anthropic-beta': AGENT_BETA,
    'content-type': 'application/json',
  };
}

function buildTaskPayload(tx: TransactionContext, next: NextStepRecommendation): string {
  const state = { event: 'blocker_changed', transaction: tx, getNextStep: next };
  return [
    'You are narrating a single PropXchain conveyancing transaction for the customer, because its blocker just changed.',
    'The `getNextStep` block is the OUTPUT of the canister rules engine — the single source of truth. Invent nothing not in it.',
    'Write notification.json, email.md and sms.txt to /mnt/session/outputs/ per your instructions.',
    '',
    '--- TRANSACTION STATE ---',
    JSON.stringify(state, null, 2),
    '--- END STATE ---',
  ].join('\n');
}

/** Fire one graded run for a transaction whose blocker changed. Returns the session id. */
export async function fireNarration(
  apiKey: string,
  agentId: string,
  environmentId: string,
  tx: TransactionContext,
  next: NextStepRecommendation,
): Promise<string> {
  const sessionRes = await fetch(`${ANTHROPIC_BASE}/sessions`, {
    method: 'POST',
    headers: headers(apiKey),
    body: JSON.stringify({ agent: agentId, environment_id: environmentId, title: `tx ${tx.txId}: ${next.blocker}` }),
  });
  if (!sessionRes.ok) throw new Error(`session create failed: ${sessionRes.status} ${await sessionRes.text()}`);
  const sessionId = ((await sessionRes.json()) as { id: string }).id;

  const kickoffRes = await fetch(`${ANTHROPIC_BASE}/sessions/${sessionId}/events`, {
    method: 'POST',
    headers: headers(apiKey),
    body: JSON.stringify({
      events: [{
        type: 'user.define_outcome',
        description: buildTaskPayload(tx, next),
        rubric: { type: 'text', content: OUTCOME_RUBRIC },
        max_iterations: 3,
      }],
    }),
  });
  if (!kickoffRes.ok) throw new Error(`kickoff failed: ${kickoffRes.status} ${await kickoffRes.text()}`);
  return sessionId;
}

export interface SessionStatus {
  status: string;
  verdict: string | null;
}

/** Poll one run's status + grader verdict (so the frontend can wait without the key). */
export async function getSessionStatus(apiKey: string, sessionId: string): Promise<SessionStatus> {
  const res = await fetch(`${ANTHROPIC_BASE}/sessions/${sessionId}`, { headers: headers(apiKey) });
  if (!res.ok) throw new Error(`session fetch failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { status: string; outcome_evaluations?: Array<{ result?: string }> };
  const verdict = data.outcome_evaluations?.[0]?.result ?? null;
  return { status: data.status, verdict };
}

/**
 * Has a run genuinely settled — idle with a terminal grader verdict, not the
 * transient 'pending' a just-fired session reports for a few seconds? Shared
 * by index.ts's `status` poll and monitor.ts's bounded poll loop so the two
 * callers can never drift on what "settled" means.
 */
export function isSettled(s: SessionStatus): boolean {
  return s.status === 'idle' && s.verdict !== null && s.verdict !== 'pending';
}

async function downloadFile(apiKey: string, fileId: string): Promise<string> {
  const res = await fetch(`${ANTHROPIC_BASE}/files/${fileId}/content`, { headers: headers(apiKey) });
  return res.ok ? await res.text() : '';
}

async function listSessionFiles(apiKey: string, sessionId: string): Promise<Array<{ id: string; filename: string }>> {
  const res = await fetch(`${ANTHROPIC_BASE}/files?scope_id=${sessionId}`, { headers: headers(apiKey) });
  if (!res.ok) throw new Error(`files list failed: ${res.status} ${await res.text()}`);
  return ((await res.json()) as { data?: Array<{ id: string; filename: string }> }).data ?? [];
}

/**
 * Fetch the run's three output files and parse them into a NarrationOutputs.
 *
 * Output files can lag the run reaching `idle` by a few seconds, so a caller
 * that delivers the instant status flips to idle would otherwise see an empty
 * list. Retry the listing until notification.json appears (or attempts run out).
 */
export async function fetchNarrationOutputs(apiKey: string, sessionId: string): Promise<NarrationOutputs> {
  let files: Array<{ id: string; filename: string }> = [];
  for (let attempt = 0; attempt < 4; attempt += 1) {
    files = await listSessionFiles(apiKey, sessionId);
    if (files.some((f) => f.filename.trim() === 'notification.json')) break;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  const out: NarrationOutputs = { notification: null, emailMarkdown: null, sms: null };
  for (const f of files) {
    const name = f.filename.trim();
    if (name === 'notification.json') {
      try { out.notification = JSON.parse(await downloadFile(apiKey, f.id)); } catch { out.notification = null; }
    } else if (name === 'email.md') {
      out.emailMarkdown = await downloadFile(apiKey, f.id);
    } else if (name === 'sms.txt') {
      out.sms = (await downloadFile(apiKey, f.id)).trim();
    }
  }
  return out;
}
