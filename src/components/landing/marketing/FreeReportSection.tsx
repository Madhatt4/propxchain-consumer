// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Free Home Mover Report — the landing page's lead capture. Replaces the
 * plain "notify me" waitlist: the visitor tells us who they are and when
 * they're moving, gives an address, and gets the full property intelligence
 * report rendered inline, on the spot. Same backend as the old form (the
 * PropXchain waitlist Worker via services/waitlist.ts) with the extra
 * segmentation fields; the report itself is the existing
 * PropertyIntelligenceCard fed by free open-government APIs, so it costs
 * nothing to produce.
 *
 * On wide screens a short narrated promo video sits beside the form so
 * visitors can watch the tour before filling it in; it stacks above the form
 * on narrow screens. The video is a repo asset (`/videos/propxchain-promo.mp4`)
 * with a poster frame and `preload="none"` so it costs nothing until played.
 * Versioned filename doubles as a cache-buster against the cache-first SW.
 */

import { useEffect, useRef, useState, type FormEvent } from 'react';

import { PropertyIntelligenceCard } from '@/components/transaction/PropertyIntelligenceCard';
import { postcodeService } from '@/services/postcodeService';
import {
  addToWaitlist,
  isValidEmail,
  type WaitlistRole,
  type WaitlistTimeline,
} from '@/services/waitlist';

const ROLE_OPTIONS: ReadonlyArray<{ value: WaitlistRole; label: string }> = [
  { value: 'seller', label: 'Selling' },
  { value: 'buyer', label: 'Buying' },
  { value: 'agent', label: 'Estate agent' },
  { value: 'conveyancer', label: 'Conveyancer' },
  { value: 'other', label: 'Just curious' },
];

const TIMELINE_OPTIONS: ReadonlyArray<{ value: WaitlistTimeline; label: string }> = [
  { value: 'now', label: 'Moving now' },
  { value: '1_3_months', label: '1 to 3 months' },
  { value: '3_6_months', label: '3 to 6 months' },
  { value: 'researching', label: 'Just researching' },
];

interface ChipGroupProps<T extends string> {
  legend: string;
  options: ReadonlyArray<{ value: T; label: string }>;
  selected: T | null;
  onSelect: (value: T) => void;
}

function ChipGroup<T extends string>({ legend, options, selected, onSelect }: ChipGroupProps<T>): JSX.Element {
  return (
    <fieldset className="border-0 p-0 m-0 text-left">
      <legend className="font-micro uppercase text-[0.65rem] tracking-[0.12em] text-white/60 mb-2.5">
        {legend}
      </legend>
      <div className="flex flex-wrap gap-2" role="group" aria-label={legend}>
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className="seg-chip"
            aria-pressed={selected === opt.value}
            onClick={() => onSelect(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

interface FormState {
  role: WaitlistRole | null;
  timeline: WaitlistTimeline | null;
  name: string;
  email: string;
  houseNumber: string;
  postcode: string;
}

const EMPTY_FORM: FormState = {
  role: null,
  timeline: null,
  name: '',
  email: '',
  houseNumber: '',
  postcode: '',
};

/** First failing check wins — one clear instruction beats a wall of red. */
function validate(form: FormState): string | null {
  if (!form.role) return 'Tell us who you are: pick one of the options above.';
  if (!form.timeline) return 'Pick a timeframe so we know how soon you need us.';
  if (!form.name.trim()) return 'Please enter your name.';
  if (!isValidEmail(form.email.trim())) return 'Please enter a valid email address.';
  if (!form.houseNumber.trim()) return 'Please enter your house name or number.';
  if (!postcodeService.isValidPostcodeFormat(form.postcode)) {
    return 'Please enter a full UK postcode, for example SG19 1AB.';
  }
  return null;
}

type Status = 'idle' | 'submitting' | 'success' | 'error';

interface SubmittedAddress {
  postcode: string;
  houseNumber: string;
}

export function FreeReportSection(): JSX.Element {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState<SubmittedAddress | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]): void =>
    setForm((prev) => ({ ...prev, [key]: value }));

  useEffect(() => {
    if (submitted) reportRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [submitted]);

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    const problem = validate(form);
    if (problem) {
      setStatus('error');
      setMessage(problem);
      return;
    }
    setStatus('submitting');
    setMessage('');
    const postcode = postcodeService.formatPostcode(form.postcode);
    const result = await addToWaitlist({
      name: form.name.trim(),
      email: form.email.trim(),
      role: form.role,
      postcode,
      houseNumber: form.houseNumber.trim(),
      timeline: form.timeline,
      source: 'home_mover_report',
    });
    if (result.ok) {
      setStatus('success');
      setMessage(
        result.duplicate
          ? 'Welcome back — your report is below, and you’re on the launch list.'
          : 'Your report is below. You’re on the launch list too.',
      );
      setSubmitted({
        postcode,
        houseNumber: form.houseNumber.trim(),
      });
    } else {
      setStatus('error');
      setMessage('Something went wrong saving your details. Please try again or email info@propxchain.com');
    }
  };

  const inputCls = 'cta-input w-full px-4 py-3 text-sm';

  return (
    <section id="report" className="section-pad divider-top" style={{ background: 'var(--ink)' }} data-screen-label="Free report">
      <div className="wrap sec-inner">
        <div className="liquid-glass rounded-xl px-6 py-12 md:px-14 reveal">
          <div className="text-center mb-10">
            <span className="eyebrow center mb-5">Free Home Mover Report</span>
            <h2
              className="font-display font-black text-white mt-4"
              style={{ fontSize: 'clamp(2rem,4vw,3.2rem)', lineHeight: 1.05, letterSpacing: '-0.03em' }}
            >
              Know the property before you commit.
            </h2>
            <p className="lead" style={{ textAlign: 'center', marginTop: '1.2rem' }}>
              Flood risk, planning history, sold prices, energy rating and heritage status for any address
              in England and Wales. Pulled live from official sources, free, in seconds. You join the
              launch list at the same time.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-10 lg:gap-12 items-start max-w-5xl mx-auto">
            {/* Walkthrough: a short screen recording of getting the report, so a
                visitor can watch the process before filling the form in. */}
            <div className="text-left">
              <p className="font-micro uppercase text-[0.65rem] tracking-[0.12em] text-white/60 mb-2.5">
                Watch the 80-second tour
              </p>
              <div className="rounded-xl overflow-hidden border border-white/10 shadow-xl">
                <video
                  className="w-full block aspect-video bg-black"
                  controls
                  preload="none"
                  playsInline
                  poster="/videos/propxchain-promo-poster.jpg"
                >
                  <source src="/videos/propxchain-promo.mp4" type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              </div>
              <p className="text-xs text-white/50 mt-2.5">
                Your property, your deal, your control — see how PropXchain works, then grab your free report alongside.
              </p>
            </div>

            <form className="flex flex-col gap-7" onSubmit={handleSubmit} noValidate>
              <ChipGroup legend="I am" options={ROLE_OPTIONS} selected={form.role} onSelect={(v) => set('role', v)} />
              <ChipGroup
                legend="Timeframe"
                options={TIMELINE_OPTIONS}
                selected={form.timeline}
                onSelect={(v) => set('timeline', v)}
              />

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="hmr-name" className="sr-only">Full name</label>
                  <input id="hmr-name" type="text" autoComplete="name" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Full name" className={inputCls} />
                </div>
                <div>
                  <label htmlFor="hmr-email" className="sr-only">Email address</label>
                  <input id="hmr-email" type="email" autoComplete="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="you@email.com" className={inputCls} />
                </div>
                <div>
                  <label htmlFor="hmr-house" className="sr-only">House name or number</label>
                  <input id="hmr-house" type="text" autoComplete="address-line1" value={form.houseNumber} onChange={(e) => set('houseNumber', e.target.value)} placeholder="House name or number" className={inputCls} />
                </div>
                <div>
                  <label htmlFor="hmr-postcode" className="sr-only">Postcode</label>
                  <input id="hmr-postcode" type="text" autoComplete="postal-code" value={form.postcode} onChange={(e) => set('postcode', e.target.value)} placeholder="Postcode" className={inputCls} />
                </div>
              </div>

              <div className="flex flex-col items-center gap-3">
                <button
                  type="submit"
                  disabled={status === 'submitting'}
                  className="btn-primary px-10 py-3.5 text-sm disabled:opacity-60"
                >
                  {status === 'submitting' ? 'Fetching your report…' : 'Get my free report'}
                </button>
                <p className="text-xs text-white/50">
                  No spam. One launch email, and your report stays on this page.
                </p>
              </div>

              {message && (
                <p
                  role="status"
                  className={`text-sm text-center ${status === 'error' ? 'text-[#F87171]' : 'text-[color:var(--t)]'}`}
                >
                  {message}
                </p>
              )}
            </form>
          </div>
        </div>

        {submitted && (
          <div ref={reportRef} className="mt-10 reveal in">
            <PropertyIntelligenceCard
              postcode={submitted.postcode}
              addressLine={submitted.houseNumber}
              downloadable
            />
          </div>
        )}
      </div>
    </section>
  );
}
