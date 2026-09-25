/**
 * Public quote submission page for conveyancers.
 * Route: /quote/:token — no auth required.
 */

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import QuoteScopeBlock from './QuoteScopeBlock';
import type { QuoteScope } from '@/types/quoteScope.types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const EDGE_FN = `${SUPABASE_URL}/functions/v1/submit-conveyancer-quote`;

type PageState =
  | 'loading'
  | 'ready'
  | 'expired'
  | 'already-submitted'
  | 'invalid'
  | 'submitted'
  | 'error';

interface PropertyDetails {
  address: string;
  price?: number;
  transactionId?: string;
  solicitorFirm?: string;
  scope?: QuoteScope | null;
  [key: string]: unknown;
}

interface FormValues {
  legalFee: string;
  disbursements: string;
  vat: string;
  weeks: string;
  conditions: string;
}

const toPence = (value: string): number =>
  Math.round(parseFloat(value || '0') * 100);

// ── Icon helpers ────────────────────────────────────────────────────────────

function CheckCircleIcon(): JSX.Element {
  return (
    <svg className="w-16 h-16 text-teal-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function XCircleIcon(): JSX.Element {
  return (
    <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ClockIcon(): JSX.Element {
  return (
    <svg className="w-16 h-16 text-amber-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

// ── Status screens ────────────────────────────────────────────────────────────

interface StatusCardProps {
  icon: JSX.Element;
  title: string;
  body: string;
}

function StatusCard({ icon, title, body }: StatusCardProps): JSX.Element {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0B1120] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#0F1729] border border-gray-200 dark:border-[#1E293B] rounded-2xl shadow-sm p-10 max-w-md w-full text-center">
        {icon}
        <h1 className="text-xl font-semibold text-gray-800 dark:text-[#E5E7EB] mb-2">{title}</h1>
        <p className="text-gray-500 dark:text-[#94A3B8] text-sm leading-relaxed">{body}</p>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function QuoteFormPage(): JSX.Element {
  const { token } = useParams<{ token: string }>();

  const [state, setState] = useState<PageState>('loading');
  const [property, setProperty] = useState<PropertyDetails | null>(null);
  const [submitError, setSubmitError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [form, setForm] = useState<FormValues>({
    legalFee: '',
    disbursements: '',
    vat: '',
    weeks: '',
    conditions: '',
  });

  // ── Validate token on mount ──────────────────────────────────────────────
  useEffect(() => {
    if (!token) {
      setState('invalid');
      return;
    }

    const validate = async (): Promise<void> => {
      try {
        const res = await fetch(`${EDGE_FN}?token=${encodeURIComponent(token)}`, {
          headers: { apikey: SUPABASE_ANON_KEY },
        });

        if (res.status === 410) { setState('expired'); return; }
        if (res.status === 409) { setState('already-submitted'); return; }
        if (res.status === 404) { setState('invalid'); return; }
        if (!res.ok) { setState('error'); return; }

        const data = await res.json() as PropertyDetails;
        setProperty(data);
        setState('ready');
      } catch {
        setState('error');
      }
    };

    void validate();
  }, [token]);

  // ── Auto-calculate VAT at 20% of legal fee ───────────────────────────────
  const handleLegalFeeChange = useCallback((value: string): void => {
    const fee = parseFloat(value) || 0;
    const autoVat = fee > 0 ? (fee * 0.2).toFixed(2) : '';
    setForm(prev => ({ ...prev, legalFee: value, vat: autoVat }));
  }, []);

  const handleFieldChange = useCallback((field: keyof FormValues, value: string): void => {
    setForm(prev => ({ ...prev, [field]: value }));
  }, []);

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!token) return;

    setSubmitError('');
    setIsSubmitting(true);

    try {
      const body = {
        token,
        legalFee: toPence(form.legalFee),
        disbursementsEstimate: toPence(form.disbursements),
        vat: toPence(form.vat),
        estimatedWeeks: parseInt(form.weeks, 10),
        conditions: form.conditions.trim() || null,
      };

      const res = await fetch(EDGE_FN, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify(body),
      });

      if (res.status === 410) { setState('expired'); return; }
      if (res.status === 409) { setState('already-submitted'); return; }

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Submission failed.' })) as { message?: string };
        setSubmitError(err.message ?? 'Submission failed. Please try again.');
        return;
      }

      setState('submitted');
    } catch {
      setSubmitError('Network error. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [token, form]);

  // ── State renders ────────────────────────────────────────────────────────

  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0B1120] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-[#94A3B8] text-sm">Loading quote request…</p>
        </div>
      </div>
    );
  }

  if (state === 'expired') {
    return (
      <StatusCard
        icon={<ClockIcon />}
        title="Quote link has expired"
        body="This quote request is no longer accepting responses. Please contact PropXchain if you believe this is an error."
      />
    );
  }

  if (state === 'already-submitted') {
    return (
      <StatusCard
        icon={<CheckCircleIcon />}
        title="Quote already submitted"
        body="A quote has already been received for this request. Thank you for your response."
      />
    );
  }

  if (state === 'invalid') {
    return (
      <StatusCard
        icon={<XCircleIcon />}
        title="Invalid quote link"
        body="This link is not valid. Please check the URL or contact PropXchain for a new invitation."
      />
    );
  }

  if (state === 'error') {
    return (
      <StatusCard
        icon={<XCircleIcon />}
        title="Something went wrong"
        body="We couldn't load this quote request. Please try refreshing the page or contact PropXchain for assistance."
      />
    );
  }

  if (state === 'submitted') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0B1120] flex items-center justify-center p-4">
        <div className="bg-white dark:bg-[#0F1729] border border-gray-200 dark:border-[#1E293B] rounded-2xl shadow-sm p-10 max-w-md w-full text-center">
          <CheckCircleIcon />
          <h1 className="text-xl font-semibold text-gray-800 dark:text-[#E5E7EB] mb-2">Quote submitted</h1>
          <p className="text-gray-500 dark:text-[#94A3B8] text-sm leading-relaxed">
            Thank you. Your quote has been received and will be reviewed by the client's solicitor.
            We'll be in touch if your quote is selected.
          </p>
        </div>
      </div>
    );
  }

  // ── Ready: show form ─────────────────────────────────────────────────────

  const legalFeeNum = parseFloat(form.legalFee) || 0;
  const disbNum = parseFloat(form.disbursements) || 0;
  const vatNum = parseFloat(form.vat) || 0;
  const total = legalFeeNum + disbNum + vatNum;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0B1120] py-10 px-4">
      {/* Header */}
      <div className="max-w-2xl mx-auto mb-8 text-center">
        <p className="text-teal-600 text-xs font-semibold tracking-widest uppercase mb-2">PropXchain</p>
        <h1 className="text-2xl font-serif text-gray-900 dark:text-[#F1F5F9]" style={{ fontFamily: 'Georgia, serif' }}>
          Conveyancing Quote Request
        </h1>
        <p className="text-gray-500 dark:text-[#94A3B8] text-sm mt-2">
          Please review the property details below and submit your quote.
        </p>
      </div>

      <div className="max-w-2xl mx-auto space-y-6">
        {/* Property details card */}
        {property && (
          <div className="bg-white dark:bg-[#0F1729] border border-gray-200 dark:border-[#1E293B] rounded-xl p-6">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Property Details</h2>
            <dl className="space-y-3">
              {property.address && (
                <div className="flex justify-between text-sm">
                  <dt className="text-gray-500 dark:text-[#94A3B8]">Address</dt>
                  <dd className="text-gray-800 dark:text-[#E5E7EB] font-medium text-right max-w-xs">{property.address}</dd>
                </div>
              )}
              {property.price !== undefined && (
                <div className="flex justify-between text-sm">
                  <dt className="text-gray-500 dark:text-[#94A3B8]">Sale Price</dt>
                  <dd className="text-gray-800 dark:text-[#E5E7EB] font-medium">
                    £{property.price.toLocaleString('en-GB')}
                  </dd>
                </div>
              )}
              {property.transactionId && (
                <div className="flex justify-between text-sm">
                  <dt className="text-gray-500 dark:text-[#94A3B8]">Reference</dt>
                  <dd className="text-gray-600 dark:text-[#94A3B8] font-mono text-xs">{property.transactionId}</dd>
                </div>
              )}
              {property.solicitorFirm && (
                <div className="flex justify-between text-sm">
                  <dt className="text-gray-500 dark:text-[#94A3B8]">Instructed by</dt>
                  <dd className="text-gray-800 dark:text-[#E5E7EB]">{property.solicitorFirm}</dd>
                </div>
              )}
            </dl>
          </div>
        )}

        <QuoteScopeBlock scope={property?.scope ?? null} />

        {/* Quote form card */}
        <form onSubmit={handleSubmit} noValidate>
          <div className="bg-white dark:bg-[#0F1729] border border-gray-200 dark:border-[#1E293B] rounded-xl p-6">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-5">Your Quote</h2>

            <div className="space-y-5">
              {/* Legal Fee */}
              <div>
                <label htmlFor="legalFee" className="block text-sm font-medium text-gray-700 dark:text-[#CBD5E1] mb-1">
                  Legal Fee (£) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-3 flex items-center text-gray-400 text-sm">£</span>
                  <input
                    id="legalFee"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={form.legalFee}
                    onChange={e => handleLegalFeeChange(e.target.value)}
                    className="w-full pl-7 pr-4 py-2.5 text-sm border border-gray-300 dark:border-[#334155] rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Disbursements */}
              <div>
                <label htmlFor="disbursements" className="block text-sm font-medium text-gray-700 dark:text-[#CBD5E1] mb-1">
                  Disbursements Estimate (£) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-3 flex items-center text-gray-400 text-sm">£</span>
                  <input
                    id="disbursements"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={form.disbursements}
                    onChange={e => handleFieldChange('disbursements', e.target.value)}
                    className="w-full pl-7 pr-4 py-2.5 text-sm border border-gray-300 dark:border-[#334155] rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    placeholder="0.00"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">Searches, Land Registry fees, bank transfer charges, etc.</p>
              </div>

              {/* VAT */}
              <div>
                <label htmlFor="vat" className="block text-sm font-medium text-gray-700 dark:text-[#CBD5E1] mb-1">
                  VAT (£)
                  <span className="ml-1 text-xs font-normal text-gray-400">— auto-calculated at 20% of legal fee, editable</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-3 flex items-center text-gray-400 text-sm">£</span>
                  <input
                    id="vat"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.vat}
                    onChange={e => handleFieldChange('vat', e.target.value)}
                    className="w-full pl-7 pr-4 py-2.5 text-sm border border-gray-300 dark:border-[#334155] rounded-lg bg-gray-50 dark:bg-[#0B1120] focus:bg-white dark:focus:bg-[#0F1729] focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Timeline */}
              <div>
                <label htmlFor="weeks" className="block text-sm font-medium text-gray-700 dark:text-[#CBD5E1] mb-1">
                  Estimated Timeline (weeks) <span className="text-red-500">*</span>
                </label>
                <input
                  id="weeks"
                  type="number"
                  min="1"
                  max="104"
                  step="1"
                  required
                  value={form.weeks}
                  onChange={e => handleFieldChange('weeks', e.target.value)}
                  className="w-full px-4 py-2.5 text-sm border border-gray-300 dark:border-[#334155] rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  placeholder="e.g. 8"
                />
              </div>

              {/* Conditions / Notes */}
              <div>
                <label htmlFor="conditions" className="block text-sm font-medium text-gray-700 dark:text-[#CBD5E1] mb-1">
                  Conditions / Notes
                  <span className="ml-1 text-xs font-normal text-gray-400">optional</span>
                </label>
                <textarea
                  id="conditions"
                  rows={4}
                  value={form.conditions}
                  onChange={e => handleFieldChange('conditions', e.target.value)}
                  className="w-full px-4 py-2.5 text-sm border border-gray-300 dark:border-[#334155] rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 resize-y"
                  placeholder="Any conditions, assumptions, or additional notes about your quote…"
                />
              </div>
            </div>

            {/* Total summary */}
            {(legalFeeNum > 0 || disbNum > 0) && (
              <div className="mt-6 pt-5 border-t border-gray-100 dark:border-[#1E293B]">
                <div className="flex justify-between text-sm text-gray-500 dark:text-[#94A3B8] mb-1">
                  <span>Legal Fee</span>
                  <span>£{legalFeeNum.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-500 dark:text-[#94A3B8] mb-1">
                  <span>Disbursements</span>
                  <span>£{disbNum.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-500 dark:text-[#94A3B8] mb-2">
                  <span>VAT</span>
                  <span>£{vatNum.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-base font-semibold text-gray-800 dark:text-[#E5E7EB]">
                  <span>Total estimate</span>
                  <span className="text-teal-700">£{total.toFixed(2)}</span>
                </div>
              </div>
            )}

            {/* Error */}
            {submitError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {submitError}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-6 w-full py-3 px-6 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
            >
              {isSubmitting ? 'Submitting…' : 'Submit Quote'}
            </button>
          </div>
        </form>

        <p className="text-center text-xs text-gray-400 pb-8">
          This quote request was sent via PropXchain — the digital property conveyancing platform.
        </p>
      </div>
    </div>
  );
}
