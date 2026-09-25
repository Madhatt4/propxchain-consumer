// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * useMoveNarratorPreview — run the Move Narrator on demand against a
 * transaction's CURRENT state, without waiting for a real blocker change.
 *
 * Admin/dev affordance to see the AI card (inline banner + toast) in seconds.
 * It uses an EMPTY recipient, so a preview never sends a real email/SMS to the
 * customer — it only produces the in-app card. The orchestration mirrors the
 * automatic path in useMoveNarrator (fire → poll → deliver → record).
 */

import { useCallback, useState } from 'react';

import { useToast } from '@/hooks/use-toast';
import { logger } from '@/utils/logger';
import { getNextStep } from '../services/next-step.service';
import {
  deliverNarration,
  fireNarration,
  getNarrationStatus,
  isNarrationSettled,
  type MoveNarratorTransaction,
} from '../services/moveNarrator.service';
import { appendNotification } from '../services/moveNarratorNotifications';

const POLL_INTERVAL_MS = 10_000;
const MAX_POLLS = 36; // ~6 minute ceiling — runs commonly take 1–3 min, sometimes more

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface UseMoveNarratorPreviewParams {
  txId: string;
  role: 'buyer' | 'seller';
  propertyAddress: string;
}

export interface UseMoveNarratorPreviewReturn {
  runPreview: () => Promise<void>;
  isRunning: boolean;
}

export function useMoveNarratorPreview({
  txId,
  role,
  propertyAddress,
}: UseMoveNarratorPreviewParams): UseMoveNarratorPreviewReturn {
  const { toast } = useToast();
  const [isRunning, setIsRunning] = useState(false);

  const runPreview = useCallback(async (): Promise<void> => {
    if (isRunning || !txId) return;
    setIsRunning(true);
    try {
      const result = await getNextStep(txId);
      if ('err' in result) {
        toast({ title: 'Could not preview', description: 'No next-step state for this transaction yet.' });
        return;
      }
      const transaction: MoveNarratorTransaction = {
        txId,
        url: `${typeof window !== 'undefined' ? window.location.origin : ''}/transaction/${txId}`,
        role,
        propertyAddress,
        previousBlocker: '',
      };
      toast({ title: '✨ Generating AI update…', description: 'Usually a minute or two.' });

      const sessionId = await fireNarration(transaction, result.ok);

      let settled = false;
      for (let i = 0; i < MAX_POLLS; i += 1) {
        const { status, verdict } = await getNarrationStatus(sessionId, txId);
        if (isNarrationSettled(status, verdict)) {
          settled = true;
          break;
        }
        await delay(POLL_INTERVAL_MS);
      }
      if (!settled) {
        toast({ title: 'Still working', description: 'Taking longer than usual — it will appear in the bell shortly.' });
        return;
      }

      // Email/SMS are addressed server-side to the signed-in user; here we only
      // consume the in-app card.
      const { notification } = await deliverNarration(sessionId, txId);
      if (!notification) {
        toast({ title: 'No card produced', description: 'The run finished without an in-app card.' });
        return;
      }
      appendNotification({
        txId,
        title: notification.title,
        body: notification.body,
        txUrl: notification.txUrl,
        urgency: notification.urgency,
      });
      // The inline banner + bell pick this up via the store event; the banner
      // also toasts the card itself, so we don't toast it again here.
    } catch (err) {
      logger.warn('[moveNarrator] preview failed', err);
      toast({ title: 'Preview failed', description: 'Could not generate the AI update — see console for details.' });
    } finally {
      setIsRunning(false);
    }
  }, [isRunning, txId, role, propertyAddress, toast]);

  return { runPreview, isRunning };
}
