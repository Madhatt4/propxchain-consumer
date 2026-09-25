// PropXchain - Open Source Blockchain Property Conveyancing Platform
// Copyright (C) 2026 PropXchain Contributors
// SPDX-License-Identifier: Proprietary

/**
 * Conveyancer Brief tab — reviews and sends the AI-composed "work arising"
 * email to this transaction's instructed conveyancer. Draft-then-send is a
 * hard rule enforced server-side (see conveyancerBrief.service.ts):
 * composing NEVER sends, and only an explicit, confirmed `send` reaches a
 * real solicitor's inbox.
 *
 * Render-only this iteration — the draft cannot be edited before sending.
 * Editing is a later iteration (per the task brief).
 */
import { useCallback, useEffect, useState } from 'react';
import { Mail } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ConfirmEditDialog } from '@/components/common/ConfirmEditDialog';
import {
  ConveyancerBriefError,
  composeConveyancerBrief,
  getConveyancerBriefDraft,
  isNoWorkArising,
  sendConveyancerBrief,
} from '@/services/conveyancerBrief.service';
import type { ConveyancerBriefDraft } from '@/services/conveyancerBrief.service';
import type { TransactionTabProps } from './transactionTabs.config';

type ViewState =
  | { kind: 'loading' }
  | { kind: 'unavailable' }
  | { kind: 'empty' }
  | { kind: 'no_work_arising' }
  | { kind: 'draft'; draft: ConveyancerBriefDraft }
  | { kind: 'sent' };

function isUnauthorized(err: unknown): boolean {
  return err instanceof ConveyancerBriefError && err.status === 403;
}

/** 409 covers already_sent / already_sending / conflict — all "can't send right now". */
function sendConflictMessage(err: ConveyancerBriefError): string {
  if (err.code === 'already_sent') return 'This brief has already been sent to your conveyancer.';
  if (err.code === 'already_sending') return 'A send is already in progress for this brief.';
  return "This brief can't be sent right now — try again shortly.";
}

function sendFailureMessage(err: ConveyancerBriefError): string {
  if (err.code === 'conveyancer_email_unavailable') {
    return "Your conveyancer's email address could not be found. Your draft is unchanged — contact support.";
  }
  return 'The email could not be sent. Your draft is unchanged — you can try again.';
}

function ErrorBanner({ message }: { message: string }): JSX.Element {
  return (
    <p
      role="alert"
      className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
    >
      {message}
    </p>
  );
}

function BriefHeader(): JSX.Element {
  return (
    <CardHeader>
      <CardTitle className="flex items-center gap-2 text-lg">
        <Mail className="h-5 w-5 text-teal-600" /> Conveyancer brief
      </CardTitle>
    </CardHeader>
  );
}

export function ConveyancerBriefTab({ transactionId }: TransactionTabProps): JSX.Element {
  const [view, setView] = useState<ViewState>({ kind: 'loading' });
  const [error, setError] = useState<string | null>(null);
  const [isComposing, setIsComposing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  /**
   * `isInitialLoad` distinguishes the first fetch (nothing on screen yet, so a
   * failure has nowhere to fall back to but `empty`) from a resync — e.g. the
   * re-fetch after a 409 on send, below. A resync failure (a transient 500,
   * say) must not wipe a perfectly good draft off the screen; it keeps the
   * current view and surfaces the error alongside it instead.
   */
  const load = useCallback(async (isInitialLoad = true): Promise<void> => {
    setError(null);
    try {
      const draft = await getConveyancerBriefDraft(transactionId);
      setView(draft ? { kind: 'draft', draft } : { kind: 'empty' });
    } catch (e) {
      if (isUnauthorized(e)) {
        setView({ kind: 'unavailable' });
        return;
      }
      if (isInitialLoad) {
        setView({ kind: 'empty' });
      }
      setError(e instanceof Error ? e.message : 'Could not load the conveyancer brief.');
    }
  }, [transactionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCompose = async (): Promise<void> => {
    setError(null);
    setIsComposing(true);
    try {
      const result = await composeConveyancerBrief(transactionId);
      setView(isNoWorkArising(result) ? { kind: 'no_work_arising' } : { kind: 'draft', draft: result });
    } catch (e) {
      if (isUnauthorized(e)) {
        setView({ kind: 'unavailable' });
      } else if (e instanceof ConveyancerBriefError && e.status === 429) {
        setError('You have composed a brief recently — try again in a little while.');
      } else {
        setError(e instanceof Error ? e.message : 'Could not compose the brief.');
      }
    } finally {
      setIsComposing(false);
    }
  };

  const handleConfirmSend = async (): Promise<void> => {
    if (view.kind !== 'draft') return;
    const { briefId } = view.draft;
    setConfirmOpen(false);
    setError(null);
    setIsSending(true);
    try {
      await sendConveyancerBrief(briefId);
      setView({ kind: 'sent' });
    } catch (e) {
      if (isUnauthorized(e)) {
        setView({ kind: 'unavailable' });
      } else if (e instanceof ConveyancerBriefError && e.status === 409) {
        // Resync with the server's ground truth first — load() clears `error`
        // at its own start, so setting the conflict message before awaiting it
        // would just have it wiped out again. Setting it after means it survives
        // regardless of whether the resync itself succeeds or fails.
        await load(false);
        setError(sendConflictMessage(e));
      } else if (e instanceof ConveyancerBriefError && e.status === 404) {
        setError('This draft no longer exists — compose a new one.');
        setView({ kind: 'empty' });
      } else if (e instanceof ConveyancerBriefError && e.status === 429) {
        setError('Sending is rate limited — try again in a little while.');
      } else if (e instanceof ConveyancerBriefError && e.status === 502) {
        setError(sendFailureMessage(e));
      } else {
        setError(e instanceof Error ? e.message : 'Could not send the brief.');
      }
    } finally {
      setIsSending(false);
    }
  };

  if (view.kind === 'loading') {
    return <p className="text-sm text-muted-foreground">Loading your conveyancer brief…</p>;
  }

  if (view.kind === 'unavailable') {
    return (
      <Card>
        <BriefHeader />
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Available once you&apos;ve instructed a conveyancer — accept a quote from your Conveyancer panel to
            unlock this.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (view.kind === 'sent') {
    return (
      <Card>
        <BriefHeader />
        <CardContent>
          <p role="status" className="text-sm text-foreground">
            Sent to your conveyancer.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (view.kind === 'no_work_arising') {
    return (
      <Card>
        <BriefHeader />
        <CardContent className="space-y-3">
          {error && <ErrorBanner message={error} />}
          <p className="text-sm text-muted-foreground">
            Nothing to raise with your conveyancer yet — your completed scans haven&apos;t surfaced any work
            arising. Check again once more scans complete.
          </p>
          <Button variant="outline" onClick={() => void handleCompose()} disabled={isComposing}>
            {isComposing ? 'Checking…' : 'Check again'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (view.kind === 'empty') {
    return (
      <Card>
        <BriefHeader />
        <CardContent className="space-y-3">
          {error && <ErrorBanner message={error} />}
          <p className="text-sm text-muted-foreground">
            Compose a work-arising email from your completed scans, for your instructed conveyancer to review.
            Nothing sends until you say so.
          </p>
          <Button onClick={() => void handleCompose()} disabled={isComposing}>
            {isComposing ? 'Composing…' : 'Compose brief'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // view.kind === 'draft'
  const { draft } = view;
  const sendDisabled = isSending || draft.status === 'sending';

  return (
    <Card>
      <BriefHeader />
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          This draft is render-only for now — editing before sending is coming in a later update.
        </p>
        {error && <ErrorBanner message={error} />}

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Subject</p>
          <p className="text-sm font-medium text-foreground">{draft.subject}</p>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {draft.itemCount} item{draft.itemCount === 1 ? '' : 's'} of work arising
          </p>
          <div
            data-testid="brief-body"
            className="mt-2 whitespace-pre-line rounded-lg border border-border p-4 text-sm leading-relaxed text-foreground/90"
          >
            {draft.bodyMd}
          </div>
        </div>

        {draft.notAvailable.length > 0 && (
          <div className="rounded-lg border border-warning/40 bg-warning/5 p-4">
            <p className="mb-2 text-sm font-semibold text-foreground">Evidence not yet available</p>
            <ul className="list-disc space-y-1 pl-5">
              {draft.notAvailable.map((item) => (
                <li key={item} className="text-sm text-foreground/90">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        <Button onClick={() => setConfirmOpen(true)} disabled={sendDisabled}>
          {sendDisabled ? 'Sending…' : 'Send to conveyancer'}
        </Button>
      </CardContent>

      <ConfirmEditDialog
        open={confirmOpen}
        title="Send to your conveyancer?"
        message="This emails your instructed conveyancer with the work-arising items above. It cannot be recalled once sent."
        confirmLabel="Yes, send"
        tone="primary"
        onConfirm={() => void handleConfirmSend()}
        onCancel={() => setConfirmOpen(false)}
      />
    </Card>
  );
}

export default ConveyancerBriefTab;
