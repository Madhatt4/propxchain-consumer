// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';

import {
  sendViewingRequest,
  validateViewingRequest,
  type ViewingRequestErrors,
  type ViewingRequestInput,
} from '@/services/viewingRequest.service';

const INPUT_CLASS =
  'mt-1 block min-h-11 w-full rounded-md border border-[#D1D5DB] bg-white px-3 py-2 font-[DM_Sans] text-sm text-[#1A1A1A] focus:border-[#0D9488] focus:outline-none focus:ring-1 focus:ring-[#0D9488]';
const LABEL_CLASS = 'block font-[DM_Sans] text-sm font-medium text-[#374151]';
const ERROR_CLASS = 'mt-1 font-[DM_Sans] text-sm text-[#B91C1C]';

type TextFieldName = 'name' | 'email' | 'phone' | 'preferredTimes';

interface TextInputProps {
  name: TextFieldName;
  label: string;
  type: string;
  autoComplete?: string;
  maxLength: number;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}

function TextInput({ name, label, type, autoComplete, maxLength, value, error, onChange }: TextInputProps): JSX.Element {
  const id = `viewing-request-${name}`;
  return (
    <div>
      <label htmlFor={id} className={LABEL_CLASS}>{label}</label>
      <input
        id={id}
        type={type}
        autoComplete={autoComplete}
        maxLength={maxLength}
        value={value}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(e) => onChange(e.target.value)}
        className={INPUT_CLASS}
      />
      {error && <p id={`${id}-error`} className={ERROR_CLASS}>{error}</p>}
    </div>
  );
}

function emptyRequest(slug: string): ViewingRequestInput {
  return { slug, name: '', email: '', phone: '', preferredTimes: '', message: '', marketingConsent: false, website: '' };
}

export interface RequestViewingFormProps {
  slug: string;
  agencyName: string;
}

export function RequestViewingForm({ slug, agencyName }: RequestViewingFormProps): JSX.Element {
  const [request, setRequest] = useState<ViewingRequestInput>(() => emptyRequest(slug));
  const [errors, setErrors] = useState<ViewingRequestErrors>({});
  const send = useMutation({ mutationFn: () => sendViewingRequest(request) });
  const set = <K extends keyof ViewingRequestInput>(field: K) => (value: ViewingRequestInput[K]): void => setRequest((current) => ({ ...current, [field]: value }));
  const submit = (e: FormEvent): void => {
    e.preventDefault();
    const found = validateViewingRequest(request);
    setErrors(found);
    if (Object.keys(found).length === 0) send.mutate();
  };

  if (send.isSuccess) {
    return (
      <section aria-labelledby="request-viewing-heading" className="mx-4 rounded-lg border border-[#E5E7EB] bg-white p-4">
        <h2 id="request-viewing-heading" className="font-[DM_Sans] text-lg font-semibold text-[#1A1A1A]">Request a viewing</h2>
        <p role="status" className="mt-2 font-[DM_Sans] text-sm text-[#1A1A1A]">
          Thank you. {agencyName} has your request and will contact you to arrange a viewing.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="request-viewing-heading" className="mx-4 rounded-lg border border-[#E5E7EB] bg-white p-4">
      <h2 id="request-viewing-heading" className="font-[DM_Sans] text-lg font-semibold text-[#1A1A1A]">Request a viewing</h2>
      <p className="mt-1 font-[DM_Sans] text-sm text-[#6B7280]">
        Your details go to {agencyName}, the estate agent for this property, so they can arrange your viewing.{' '}
        <Link to="/privacy" className="text-[#0D9488] underline">How PropXchain handles your details</Link>.
      </p>
      <form onSubmit={submit} noValidate className="mt-4 space-y-4">
        <TextInput name="name" label="Your name" type="text" autoComplete="name" maxLength={120} value={request.name} error={errors.name} onChange={set('name')} />
        <TextInput name="email" label="Email" type="email" autoComplete="email" maxLength={254} value={request.email} error={errors.email} onChange={set('email')} />
        <TextInput name="phone" label="Phone (optional)" type="tel" autoComplete="tel" maxLength={30} value={request.phone} error={errors.phone} onChange={set('phone')} />
        <TextInput name="preferredTimes" label="When could you view? (optional)" type="text" maxLength={300} value={request.preferredTimes} onChange={set('preferredTimes')} />
        <div>
          <label htmlFor="viewing-request-message" className={LABEL_CLASS}>Message (optional)</label>
          <textarea id="viewing-request-message" rows={3} maxLength={2000} value={request.message} onChange={(e) => set('message')(e.target.value)} className={INPUT_CLASS} />
        </div>
        <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label htmlFor="viewing-request-website">Website</label>
          <input id="viewing-request-website" type="text" tabIndex={-1} autoComplete="off" value={request.website} onChange={(e) => set('website')(e.target.value)} />
        </div>
        <label className="flex min-h-11 items-start gap-2 font-[DM_Sans] text-sm text-[#374151]">
          <input type="checkbox" checked={request.marketingConsent} onChange={(e) => set('marketingConsent')(e.target.checked)} className="mt-1 h-4 w-4 accent-[#0D9488]" />
          <span>{agencyName} may email me about other properties. You can unsubscribe at any time.</span>
        </label>
        {send.error instanceof Error && <p role="alert" className={ERROR_CLASS}>{send.error.message}</p>}
        <button
          type="submit"
          disabled={send.isPending}
          className="inline-flex min-h-11 items-center rounded-md bg-[#0D9488] px-5 py-2.5 font-[DM_Sans] text-sm font-medium text-white hover:bg-[#0F766E] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {send.isPending ? 'Sending…' : 'Request a viewing'}
        </button>
      </form>
    </section>
  );
}
