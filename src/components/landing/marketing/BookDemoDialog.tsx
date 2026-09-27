// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * "Book a 20-min demo" card for the developers section. Collects company,
 * name and email and hands them to the demo-request edge function; we reply
 * by email to fix a time.
 *
 * Built on the Radix primitives with explicit colours rather than
 * `ui/dialog.tsx`, whose `bg-background` follows the app theme, not the
 * landing page's own theme. Styling matches SignInDialog.
 */

import { useState, type FormEvent } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

import { isValidEmail } from '@/services/waitlist';
import { requestDemo } from '@/services/demoRequest.service';

interface BookDemoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface DemoForm {
  company: string;
  name: string;
  email: string;
  website: string;
}

type Status = 'idle' | 'sending' | 'sent';

const EMPTY_FORM: DemoForm = { company: '', name: '', email: '', website: '' };
const DESCRIPTION_ID = 'book-demo-lede';
const INPUT_CLS =
  'w-full rounded-md border border-[#D1D5DB] bg-white px-3.5 py-2.5 text-sm text-[#1A1A1A] placeholder:text-[#9CA3AF] focus:border-[#0D9488] focus:outline-none focus:ring-2 focus:ring-[#0D9488]/25';
const LABEL_CLS = 'mb-1.5 block text-xs font-medium text-[#374151]';

function validate(form: DemoForm): string | null {
  if (!form.company.trim()) return 'Please enter your company name.';
  if (!form.name.trim()) return 'Please enter your name.';
  if (!isValidEmail(form.email.trim())) return 'Please enter a valid email address.';
  return null;
}

export function BookDemoDialog({ open, onOpenChange }: BookDemoDialogProps): JSX.Element {
  const [form, setForm] = useState<DemoForm>(EMPTY_FORM);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof DemoForm, value: string): void => setForm((f) => ({ ...f, [key]: value }));

  const handleOpenChange = (next: boolean): void => {
    // Reset on close so reopening after a send starts a fresh request.
    if (!next) {
      setForm(EMPTY_FORM);
      setStatus('idle');
      setError(null);
    }
    onOpenChange(next);
  };

  const submit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    const problem = validate(form);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setStatus('sending');
    const ok = await requestDemo({
      company: form.company.trim(),
      name: form.name.trim(),
      email: form.email.trim(),
      website: form.website,
    });
    if (ok) {
      setStatus('sent');
    } else {
      setStatus('idle');
      setError('Something went wrong sending that. Please try again, or email marc@propxchain.com.');
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[150] bg-[#0A0F1E]/55 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />

        <DialogPrimitive.Content
          aria-describedby={DESCRIPTION_ID}
          className="fixed inset-x-0 bottom-0 z-[151] max-h-[92vh] overflow-y-auto rounded-t-2xl bg-white text-[#1A1A1A] shadow-[0_24px_60px_-12px_rgba(10,15,30,0.45)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[85vh] sm:w-[26rem] sm:max-w-[calc(100%-2rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:data-[state=closed]:slide-out-to-bottom-0 sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95"
        >
          <div className="flex items-center justify-between rounded-t-2xl border-b border-[#E5E7EB] bg-[#F0F5F0] px-6 py-3 sm:rounded-t-xl">
            <span className="font-fraunces text-base font-semibold tracking-tight text-[#1A1A1A]">
              PropX<span className="text-[#0D9488]">chain</span> Dev
            </span>
            <span className="font-geist-mono text-[10px] uppercase tracking-[0.16em] text-[#5F8A68]">
              20-min demo
            </span>
          </div>

          <DialogPrimitive.Close
            aria-label="Close demo request"
            className="absolute right-3 top-2.5 inline-flex h-9 w-9 items-center justify-center rounded-md text-[#6B7280] transition-colors hover:bg-[#DAE5DC] hover:text-[#1A1A1A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0D9488]"
          >
            <X className="h-4 w-4" />
          </DialogPrimitive.Close>

          <div className="px-6 pb-7 pt-6">
            <DialogPrimitive.Title className="font-fraunces text-[1.75rem] font-semibold leading-tight tracking-tight text-[#1A1A1A]">
              {status === 'sent' ? 'Thanks — we’ll be in touch.' : 'Book a demo.'}
            </DialogPrimitive.Title>

            {status === 'sent' ? (
              <p id={DESCRIPTION_ID} className="mt-2 text-sm leading-relaxed text-[#4B5563]">
                We’ll email {form.email.trim()} within one working day to find a time that suits you.
              </p>
            ) : (
              <>
                <p id={DESCRIPTION_ID} className="mt-2 text-sm leading-relaxed text-[#4B5563]">
                  Leave your details and we’ll email you to arrange a 20-minute walkthrough of the plot pipeline.
                </p>

                <form onSubmit={submit} noValidate className="mt-5 flex flex-col gap-4">
                  <div>
                    <label htmlFor="demo-company" className={LABEL_CLS}>Company</label>
                    <input id="demo-company" type="text" autoComplete="organization" value={form.company} onChange={(e) => set('company', e.target.value)} className={INPUT_CLS} />
                  </div>
                  <div>
                    <label htmlFor="demo-name" className={LABEL_CLS}>Your name</label>
                    <input id="demo-name" type="text" autoComplete="name" value={form.name} onChange={(e) => set('name', e.target.value)} className={INPUT_CLS} />
                  </div>
                  <div>
                    <label htmlFor="demo-email" className={LABEL_CLS}>Work email</label>
                    <input id="demo-email" type="email" autoComplete="email" value={form.email} onChange={(e) => set('email', e.target.value)} className={INPUT_CLS} />
                  </div>
                  {/* Honeypot: off-screen and out of the tab order, so only bots fill it. */}
                  <input
                    type="text"
                    name="website"
                    tabIndex={-1}
                    autoComplete="off"
                    aria-hidden="true"
                    value={form.website}
                    onChange={(e) => set('website', e.target.value)}
                    className="absolute -left-[9999px] h-px w-px opacity-0"
                  />

                  {error && (
                    <p role="alert" className="text-sm text-[#B91C1C]">
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={status === 'sending'}
                    className="mt-1 w-full rounded-md bg-[#0D9488] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#0F766E] disabled:opacity-60"
                  >
                    {status === 'sending' ? 'Sending…' : 'Request a demo'}
                  </button>
                </form>
              </>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
