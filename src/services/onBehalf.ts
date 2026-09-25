// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Actions taken in a client's name (spec docs/plans/2026-09-06-agent-crm-spec.md,
 * R1.6). The save sites of the pack forms, the listing and the title number call
 * `recordOnBehalf` after a successful write, naming the side the artefact
 * belongs to. Whether the viewer acts for that side comes from the data, not
 * from a page: the form pages have their own routes, so nothing mounted
 * elsewhere can be relied on to have registered anything. The lookup is
 * cached briefly per deal; the platform checks the mandate again and puts
 * kind|role and a hash on the ledger; nothing entered by the agent is sent.
 * Best-effort throughout: a failed record is logged, never thrown, so a
 * ledger blip cannot undo a save that already happened.
 */
import { supabase } from '../lib/supabase';
import { logger } from '@/utils/logger';
import { useAuthStore } from '@/stores/authStore';
import { listDelegations } from './delegation.service';
import type { DealSide } from './shareParty.service';

export type OnBehalfKind = 'fill_pack_form' | 'upload_document' | 'order_searches' | 'draft_enquiry_note' | 'draft_declaration' | 'chase';

const TTL_MS = 60_000;
const cache = new Map<string, { userId: string; at: number; sides: Promise<DealSide[]> }>();

async function viewerOrgIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase.from('organisation_memberships').select('organisation_id').eq('user_id', userId);
  if (error) throw new Error(error.message);
  return ((data ?? []) as { organisation_id: string }[]).map((r) => r.organisation_id);
}

async function computeSides(transactionId: string, userId: string): Promise<DealSide[]> {
  const [orgIds, rows] = await Promise.all([viewerOrgIds(userId), listDelegations(transactionId)]);
  if (orgIds.length === 0) return [];
  const sides = new Set<DealSide>();
  for (const r of rows) if (r.state === 'active' && orgIds.includes(r.granteeOrgId)) sides.add(r.role);
  return [...sides];
}

/** The sides the viewer's agencies act for on this deal, from the data; empty for everyone else. Cached per deal and per signed-in user, so a sign-in as someone else on the same browser never inherits a mandate. */
export function actingSidesFor(transactionId: string): Promise<DealSide[]> {
  const userId = useAuthStore.getState().supabaseUser?.id ?? null;
  if (!userId) return Promise.resolve([]);
  const hit = cache.get(transactionId);
  if (hit && hit.userId === userId && Date.now() - hit.at < TTL_MS) return hit.sides;
  const sides = computeSides(transactionId, userId).catch((err: unknown) => {
    logger.warn('mandate lookup failed', err);
    cache.delete(transactionId);
    return [] as DealSide[];
  });
  cache.set(transactionId, { userId, at: Date.now(), sides });
  return sides;
}

/** After a grant or a withdrawal, so the next record sees it. No argument clears every deal. */
export function forgetActingFor(transactionId?: string): void {
  if (transactionId) cache.delete(transactionId);
  else cache.clear();
}

/** Records the action when the viewer acts for `side` on this deal; otherwise nothing happens. */
export async function recordOnBehalf(transactionId: string, side: DealSide, kind: OnBehalfKind, subject: string): Promise<boolean> {
  if (!transactionId) return false;
  const sides = await actingSidesFor(transactionId);
  if (!sides.includes(side)) return false;
  try {
    const { data, error } = await supabase.functions.invoke<{ ok: boolean }>('agent-delegation', {
      body: { action: 'on_behalf', transactionId, role: side, kind, subject },
    });
    if (error || !data?.ok) {
      logger.warn('on-behalf record failed', error);
      return false;
    }
    return true;
  } catch (err) {
    logger.warn('on-behalf record threw', err);
    return false;
  }
}
