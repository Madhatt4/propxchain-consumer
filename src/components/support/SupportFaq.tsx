// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The standing answers on the Support Center. Lifted out of
 * DashboardSupportPage so that page stays about raising and tracking a ticket.
 */
import React from 'react';

interface Faq {
  question: string;
  answer: string;
}

const FAQS: Faq[] = [
  {
    question: 'How do I upload documents?',
    answer: 'Navigate to the Documents page, select your transaction, and click "Upload" next to any required document.',
  },
  {
    question: 'What file formats are supported?',
    answer: 'We support PDF, JPG, and PNG files up to 10MB in size.',
  },
  {
    question: 'How long does verification take?',
    answer: 'Documents are typically verified within 24-48 hours by the relevant stakeholders.',
  },
  {
    question: 'Are my documents secure?',
    answer:
      'Yes. All documents are stored with end-to-end encryption, and a cryptographic fingerprint of each one is written to the audit trail.',
  },
];

const SupportFaq: React.FC = () => (
  <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
    <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Frequently Asked Questions</h3>
    <div className="space-y-4">
      {FAQS.map((faq, index) => (
        <div key={faq.question} className={index < FAQS.length - 1 ? 'border-b border-gray-200 pb-4 dark:border-gray-700' : ''}>
          <h4 className="mb-2 font-semibold text-gray-900 dark:text-white">{faq.question}</h4>
          <p className="text-sm text-gray-600 dark:text-gray-400">{faq.answer}</p>
        </div>
      ))}
    </div>
  </div>
);

export default SupportFaq;
