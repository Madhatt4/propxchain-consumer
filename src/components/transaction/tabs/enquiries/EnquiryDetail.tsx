// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * One enquiry: status, audit-trail state, the fact check (rows this side may
 * read, plus "Run check"), side-private notes, the released answer, and the
 * actions the server would allow for this party: answer + release (seller's
 * conveyancer), close / withdraw (the raising side's conveyancer), note (any
 * party). The server decides; the UI only hides what would be refused.
 */
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  EnquiryError, addEnquiryNote, answerEnquiry, checkEnquiry, closeEnquiry, confirmEnquiryNote, getEnquiryAnswer,
  listEnquiryChecks, listEnquiryNotes, withdrawEnquiry,
  type Enquiry, type EnquiryAnswer, type EnquiryCheck, type EnquiryNote, type Evidence, type MyParty,
} from '@/services/enquiries.service';
import { STATUS_CLASS, categoryLabel, kindLabel, statusLabel, statusTone } from './enquiryLabels';
import { CheckResultView } from './CheckResultView';
import { EvidencePicker } from './EvidencePicker';
import { PlainEnglishLine } from './PlainEnglishLine';
import { recordOnBehalf } from '@/services/onBehalf';

interface Props { enquiry: Enquiry; party: MyParty; onChanged: (e: Enquiry) => void }

function errText(e: unknown, fallback: string): string {
  if (e instanceof EnquiryError) {
    if (e.status === 503) return 'The audit trail is not reachable right now. Nothing was changed; try again shortly.';
    if (e.status === 409) return 'This enquiry has moved on since you loaded it. Refresh to see its current state.';
    return e.reason ?? e.code;
  }
  return fallback;
}

export function EnquiryDetail({ enquiry, party, onChanged }: Props): JSX.Element {
  const isConv = party.role === 'conveyancer' && party.side !== null;
  const canAnswer = isConv && party.side === 'seller' && enquiry.status === 'raised';
  const canClose = isConv && party.side === enquiry.raised_by_side && enquiry.status === 'answered';
  const canWithdraw = isConv && party.side === enquiry.raised_by_side && enquiry.status === 'raised';
  const canNote = party.side !== null;
  // A client (seller or buyer) sees the notes box as the way to tell their
  // conveyancer what they know (spec I1); the formal reply stays the conveyancer's.
  const isAgent = party.role === 'estate_agent' && party.side !== null;
  const isClient = !isConv && !isAgent && party.side !== null;
  const notesHeading = isAgent ? `Draft what the ${party.side} knows` : isClient ? 'Tell your conveyancer' : 'Notes (your side only)';
  const noteLabel = isAgent ? 'Draft for the client' : isClient ? 'Tell your conveyancer' : 'Note';
  const noteButton = isAgent ? `Save for the ${party.side} to confirm` : isClient ? 'Send to my conveyancer' : 'Add note';

  const [answer, setAnswer] = useState<EnquiryAnswer | null>(null);
  const [notes, setNotes] = useState<EnquiryNote[]>([]);
  const [checks, setChecks] = useState<EnquiryCheck[]>([]);
  const [draft, setDraft] = useState('');
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [premium, setPremium] = useState(false);

  useEffect(() => {
    let live = true;
    Promise.all([getEnquiryAnswer(enquiry.id), listEnquiryNotes(enquiry.id), listEnquiryChecks(enquiry.id)])
      .then(([a, n, c]) => { if (live) { setAnswer(a); setNotes(n); setChecks(c); } })
      .catch((e) => { if (live) setError(errText(e, 'Could not load this enquiry')); });
    return () => { live = false; };
  }, [enquiry.id, enquiry.status]);

  const run = async (label: string, fn: () => Promise<void>): Promise<void> => {
    setBusy(label); setError(null);
    try { await fn(); } catch (e) { setError(errText(e, `Could not ${label.toLowerCase()}`)); } finally { setBusy(null); }
  };
  const runCheck = () => run('Check', async () => {
    try {
      const r = await checkEnquiry({ enquiryId: enquiry.id });
      setChecks([r.check, ...checks.filter((c) => c.id !== r.check.id)]);
    } catch (e) {
      if (e instanceof EnquiryError && e.status === 402) { setPremium(true); return; }
      throw e;
    }
  });
  const latest = checks[0] ?? null;

  return (
    <div className="space-y-4 rounded-lg border p-4" data-testid="enquiry-detail">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[statusTone(enquiry.status)]}`}>{statusLabel(enquiry.status)}</span>
        <span className="text-xs text-muted-foreground">{categoryLabel(enquiry.category)} · raised by the {enquiry.raised_by_side}'s side{enquiry.transcribed ? ' · transcribed from PDF' : ''}</span>
        {enquiry.ledger_pending && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900">Not yet on the audit trail</span>}
      </div>
      <p className="whitespace-pre-wrap">{enquiry.question}</p>
      <PlainEnglishLine enquiryId={enquiry.id} />

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium">Pack check</h4>
          {!premium && <Button type="button" size="sm" variant="outline" disabled={busy === 'Check'} onClick={runCheck}>{busy === 'Check' ? 'Checking…' : latest ? 'Run again' : 'Run check'}</Button>}
        </div>
        {premium && <p className="text-sm text-muted-foreground">The pack check is part of the seller's Premium tier.</p>}
        {latest ? <CheckResultView result={latest.result} /> : <p className="text-sm text-muted-foreground">No check yet.</p>}
      </section>

      {answer && (
        <section className="space-y-1">
          <h4 className="text-sm font-medium">Answer</h4>
          <p className="whitespace-pre-wrap">{answer.answer}</p>
          {answer.evidence.length > 0 && <ul className="flex flex-wrap gap-1 text-xs">{answer.evidence.map((e) => <li key={`${e.kind}:${e.ref}`} className="rounded-full bg-muted px-2 py-0.5">{kindLabel(e.kind)} · {e.label}</li>)}</ul>}
        </section>
      )}

      {canAnswer && (
        <section className="space-y-2">
          <h4 className="text-sm font-medium">Answer and release</h4>
          <textarea aria-label="Answer" className="min-h-[96px] w-full rounded-md border bg-background p-2" maxLength={8000} value={draft} onChange={(e) => setDraft(e.target.value)} />
          <EvidencePicker transactionId={enquiry.transaction_id} check={latest?.result ?? null} value={evidence} onChange={setEvidence} />
          <Button type="button" disabled={!draft.trim() || busy !== null} onClick={() => run('Release', async () => { onChanged(await answerEnquiry({ enquiryId: enquiry.id, answer: draft.trim(), evidence })); setDraft(''); setEvidence([]); })}>
            {busy === 'Release' ? 'Releasing…' : 'Release answer'}
          </Button>
        </section>
      )}

      <section className="space-y-2">
        <h4 className="text-sm font-medium">{notesHeading}</h4>
        {isClient && (
          <p className="text-sm text-muted-foreground">
            If you know the answer, write it here. Your conveyancer sees it and gives the formal reply; nothing goes to the other side from you.
          </p>
        )}
        {isAgent && (
          <p className="text-sm text-muted-foreground">
            You act for the {party.side}. What you write here waits for them to confirm before their conveyancer sees it.
          </p>
        )}
        {notes.map((n) => (
          <div key={n.id} className="rounded bg-muted/40 p-2 text-sm">
            <p className="whitespace-pre-wrap">{n.body}</p>
            {n.pending_confirmation && (
              <div className="mt-1 flex flex-wrap items-center gap-2" data-testid="pending-note">
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900">
                  {isClient ? 'Your agent drafted this. Confirm to send it to your conveyancer.' : `Waiting for the ${n.side} to confirm`}
                </span>
                {isClient && (
                  <Button type="button" size="sm" disabled={busy !== null} onClick={() => run('Confirm', async () => { const c = await confirmEnquiryNote(n.id); setNotes((prev) => prev.map((x) => (x.id === c.id ? c : x))); })}>
                    {busy === 'Confirm' ? 'Confirming…' : 'Confirm'}
                  </Button>
                )}
              </div>
            )}
          </div>
        ))}
        {canNote && (
          <div className="flex gap-2">
            <textarea aria-label={noteLabel} placeholder={isClient ? 'What do you know about this?' : isAgent ? `What the ${party.side} told you` : undefined} className="min-h-[56px] flex-1 rounded-md border bg-background p-2" maxLength={4000} value={note} onChange={(e) => setNote(e.target.value)} />
            <Button type="button" variant="secondary" disabled={!note.trim() || busy !== null} onClick={() => run('Add note', async () => {
              const n = await addEnquiryNote({ enquiryId: enquiry.id, body: note.trim() });
              setNotes((prev) => [...prev, n]);
              setNote('');
              // Agent CRM: the draft goes on the trail as an action in the client's name.
              if (isAgent && party.side) void recordOnBehalf(enquiry.transaction_id, party.side, 'draft_enquiry_note', n.id);
            })}>{noteButton}</Button>
          </div>
        )}
      </section>

      {(canClose || canWithdraw) && (
        <div className="flex gap-2">
          {canClose && <Button type="button" variant="outline" disabled={busy !== null} onClick={() => run('Close', async () => onChanged(await closeEnquiry(enquiry.id)))}>Close enquiry</Button>}
          {canWithdraw && <Button type="button" variant="outline" disabled={busy !== null} onClick={() => run('Withdraw', async () => onChanged(await withdrawEnquiry(enquiry.id)))}>Withdraw</Button>}
        </div>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
