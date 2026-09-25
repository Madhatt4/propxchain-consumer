// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Upload a PDF of enquiries; the server transcribes it into typed drafts
 * (nothing is raised); the uploader edits, ticks and raises the ones they
 * confirm. Each raise is a normal raise with transcribed=true.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  ENQUIRY_CATEGORIES, EnquiryError, MAX_PDF_BYTES, fileToBase64, raiseEnquiry, transcribeEnquiries,
  type Enquiry, type EnquiryCategory, type EnquiryDraft,
} from '@/services/enquiries.service';
import { categoryLabel } from './enquiryLabels';

interface Props { transactionId: string; onRaised: (e: Enquiry) => void }
interface DraftRow extends EnquiryDraft { include: boolean }

export function EnquiryUpload({ transactionId, onRaised }: Props): JSX.Element {
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [status, setStatus] = useState<'idle' | 'reading' | 'raising'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | undefined>();
  const selected = rows.filter((r) => r.include && r.question.trim());

  const onFile = async (file: File | undefined): Promise<void> => {
    setError(null); setRows([]);
    if (!file) return;
    if (file.type !== 'application/pdf') { setError('Please choose a PDF.'); return; }
    if (file.size > MAX_PDF_BYTES) { setError('That PDF is over 9 MB.'); return; }
    setStatus('reading'); setFilename(file.name);
    try {
      const pdfBase64 = await fileToBase64(file);
      const r = await transcribeEnquiries({ transactionId, pdfBase64, filename: file.name });
      setRows(r.drafts.map((d) => ({ ...d, include: true })));
      if (r.drafts.length === 0) setError('No enquiries were found in that PDF.');
    } catch (e) {
      setError(e instanceof EnquiryError && e.status === 402 ? 'PDF transcription is part of the seller’s Premium tier.' : 'Could not read that PDF right now.');
    } finally { setStatus('idle'); }
  };
  const raiseAll = async (): Promise<void> => {
    setStatus('raising'); setError(null);
    const remaining: DraftRow[] = [];
    for (const r of rows) {
      if (!r.include || !r.question.trim()) { remaining.push(r); continue; }
      try { onRaised(await raiseEnquiry({ transactionId, category: r.category, question: r.question.trim(), transcribed: true })); }
      catch { remaining.push(r); setError('Some enquiries could not be raised; they are still listed below.'); }
    }
    setRows(remaining); setStatus('idle');
  };
  const update = (i: number, patch: Partial<DraftRow>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Enquiries PDF</span>
        <input aria-label="Enquiries PDF" type="file" accept="application/pdf" disabled={status !== 'idle'} onChange={(e) => onFile(e.target.files?.[0])} />
      </label>
      {status === 'reading' && <p className="text-sm text-muted-foreground">Reading {filename}…</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {rows.length > 0 && (
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[auto_200px_1fr] sm:items-start">
              <input type="checkbox" aria-label={`Include ${r.question}`} checked={r.include} onChange={(e) => update(i, { include: e.target.checked })} className="mt-2" />
              <select aria-label={`Category ${i + 1}`} className="rounded-md border bg-background p-2 text-sm" value={r.category} onChange={(e) => update(i, { category: e.target.value as EnquiryCategory })}>
                {ENQUIRY_CATEGORIES.map((c) => <option key={c} value={c}>{categoryLabel(c)}</option>)}
              </select>
              <textarea aria-label={`Enquiry ${i + 1}`} className="min-h-[56px] w-full rounded-md border bg-background p-2 text-sm" value={r.question} onChange={(e) => update(i, { question: e.target.value })} />
            </div>
          ))}
          <Button type="button" disabled={selected.length === 0 || status !== 'idle'} onClick={raiseAll}>
            {status === 'raising' ? 'Raising…' : `Raise ${selected.length} ${selected.length === 1 ? 'enquiry' : 'enquiries'}`}
          </Button>
        </div>
      )}
    </div>
  );
}
