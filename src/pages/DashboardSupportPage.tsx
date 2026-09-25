// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The Support Center: raise a ticket, and reach the ones already raised.
 *
 * The form posts to the `support-ticket` edge function, which stores the
 * ticket in Supabase and triages it. It takes the user's name and email off
 * the verified session, so neither is asked for here — a ticket can only ever
 * be raised as yourself, and an editable email field would have implied
 * otherwise.
 */
import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import DashboardSidebar from '../components/navigation/DashboardSidebar';
import DashboardHeader from '../components/navigation/DashboardHeader';
import SupportFaq from '../components/support/SupportFaq';
import { MAX_BODY, MAX_SUBJECT, createTicket, type SupportRequestContext } from '../services/supportTicket.service';
import { logger } from '@/utils/logger';
import { useAuthStore } from '../stores/authStore';
import { resetWelcomeCards } from '@/utils/firstRun';

/** The page the ticket is about, unless a caller (the chat widget) says otherwise. */
const DEFAULT_PAGE_PATH = '/dashboard/support';

const TOPICS = [
  { value: 'technical', label: 'Technical Issue' },
  { value: 'transaction', label: 'Transaction Help' },
  { value: 'documents', label: 'Document Upload/Verification' },
  { value: 'account', label: 'Account & Profile' },
  { value: 'payment', label: 'Payment & Billing' },
  { value: 'other', label: 'Other' },
];

const FIELD =
  'w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white';
const LABEL = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2';
const CARD = 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6';

/**
 * The topic the user picked is their own account of what this is about. Jev
 * decides the stored category, so the topic rides in the body where both the
 * triage model and whoever answers can see it.
 */
function composeBody(topic: string, message: string): string {
  const label = TOPICS.find((t) => t.value === topic)?.label;
  return label ? `Topic: ${label}\n\n${message.trim()}` : message.trim();
}

const DashboardSupportPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<{ principal: string; id: string } | null>(null);
  const [formData, setFormData] = useState({ topic: '', subject: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasReset, setHasReset] = useState(false);

  // Clearing the flag is what makes the dashboard show the cards again on arrival,
  // so this navigates rather than rendering a second copy of the modal here.
  const handleShowWelcomeGuide = (): void => {
    resetWelcomeCards(useAuthStore.getState().principalId);
    setHasReset(true);
    navigate('/dashboard');
  };

  useEffect(() => {
    const authState = useAuthStore.getState();
    const principalId = authState.principalId;
    if (!principalId || !authState.isAuthenticated) {
      navigate('/login');
      return;
    }
    setUser({ principal: principalId, id: principalId });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    // Router state when the chat widget sent them here; the plain page has none.
    const context = (location.state ?? {}) as SupportRequestContext;
    try {
      const ticket = await createTicket({
        subject: formData.subject.trim(),
        body: composeBody(formData.topic, formData.message),
        pagePath: context.pagePath ?? DEFAULT_PAGE_PATH,
        transactionId: context.transactionId,
        stage: context.stage,
        source: 'form',
      });
      navigate(`/dashboard/support/tickets/${ticket.id}`);
    } catch (err) {
      logger.error('Error submitting support request:', err);
      setError('We could not raise your ticket. Please try again, or email info@propxchain.com.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>): void => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <DashboardHeader user={user} title="PropXchain" subtitle="Support Center" />

      <div className="flex">
        <DashboardSidebar activeRoute="/dashboard/support" />

        <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">Support Center</h2>
                <p className="text-gray-600 dark:text-gray-400">We're here to help! Get answers or submit a support request.</p>
              </div>
              <Link
                to="/dashboard/support/tickets"
                className="inline-flex min-h-11 items-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                My tickets
              </Link>
            </div>

            <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="lg:col-span-1">
                <div className={`${CARD} mb-6`}>
                  <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Contact Options</h3>

                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gray-700">
                        <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Email Support</h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">info@propxchain.com</p>
                        <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">Response within 24 hours</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-green-600">
                        <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Documentation</h4>
                        <a
                          href="/how-it-works"
                          className="inline-flex min-h-11 items-center text-sm text-gray-700 underline underline-offset-2 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                        >
                          Browse knowledge base
                        </a>
                        <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">Find answers quickly</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* New to PropXchain — re-open the first-run explainer */}
                <div className={CARD}>
                  <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">New to PropXchain?</h3>
                  <p className="mb-4 text-sm text-gray-700 dark:text-gray-300">
                    Run through the short guide to how a move works, from listing to completion.
                  </p>
                  <button
                    onClick={handleShowWelcomeGuide}
                    className="min-h-[44px] w-full rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-blue-700"
                  >
                    {hasReset ? 'Opening on your dashboard…' : 'Show me the guide again'}
                  </button>
                </div>

                {/* Blocking issues are flagged by triage, not by a phone line —
                    the copy says what actually happens to the ticket. */}
                <div className="mt-6 rounded-lg border border-red-700 bg-gradient-to-br from-red-900 to-red-800 p-6">
                  <h3 className="mb-2 text-lg font-semibold text-white">Something holding up your move?</h3>
                  <p className="mb-4 text-sm text-red-100">
                    Say so in your message. Tickets that block an active transaction go to the top of our queue.
                  </p>
                  <button
                    type="button"
                    onClick={() => document.getElementById('support-subject')?.focus()}
                    className="min-h-[44px] w-full rounded-lg bg-white px-4 py-2 font-semibold text-red-900 transition-colors hover:bg-red-50"
                  >
                    Raise it now
                  </button>
                </div>
              </div>

              <div className="lg:col-span-2">
                <div className={CARD}>
                  <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Submit a Support Request</h3>
                  <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                    We'll reply to the email address on your account, and the whole thread stays on your ticket.
                  </p>

                  {error && (
                    <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200">
                      {error}
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label htmlFor="support-topic" className={LABEL}>
                        Topic <span className="text-red-600 dark:text-red-400">*</span>
                      </label>
                      <select id="support-topic" name="topic" value={formData.topic} onChange={handleChange} required className={FIELD}>
                        <option value="">Select a topic...</option>
                        {TOPICS.map((topic) => (
                          <option key={topic.value} value={topic.value}>
                            {topic.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="support-subject" className={LABEL}>
                        Subject <span className="text-red-600 dark:text-red-400">*</span>
                      </label>
                      <input
                        id="support-subject"
                        type="text"
                        name="subject"
                        value={formData.subject}
                        onChange={handleChange}
                        required
                        maxLength={MAX_SUBJECT}
                        className={FIELD}
                        placeholder="A one-line summary, e.g. TA6 form won't save"
                      />
                    </div>

                    <div>
                      <label htmlFor="support-message" className={LABEL}>
                        Message <span className="text-red-600 dark:text-red-400">*</span>
                      </label>
                      <textarea
                        id="support-message"
                        name="message"
                        value={formData.message}
                        onChange={handleChange}
                        required
                        rows={6}
                        maxLength={MAX_BODY}
                        className={`${FIELD} resize-none`}
                        placeholder="Please describe your issue in detail..."
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full rounded-lg bg-gray-700 px-6 py-3 font-semibold text-white transition-colors hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {submitting ? (
                        <span className="flex items-center justify-center gap-2">
                          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                          Submitting...
                        </span>
                      ) : (
                        'Submit Support Request'
                      )}
                    </button>
                  </form>
                </div>
              </div>
            </div>

            <SupportFaq />
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardSupportPage;
