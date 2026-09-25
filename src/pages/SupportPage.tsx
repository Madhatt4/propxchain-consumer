import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { icpService } from '../services/icp.service';
import { logger } from '@/utils/logger';
import { Logo } from '@/components/brand/Logo';

const SupportPage: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      await icpService.submitSupportRequest(
        formData.name,
        formData.email,
        formData.subject,
        formData.message
      );

      alert('✅ Support request submitted successfully!\n\nWe will get back to you at ' + formData.email + ' within 24 hours.');
      setFormData({ name: '', email: '', subject: '', message: '' });
    } catch (error) {
      logger.error('Error submitting support request:', error);
      alert('Error submitting support request. Please try again or email us directly at info@propxchain.com');
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const faqs = [
    {
      question: 'How do I get started with PropXchain?',
      answer: 'Click the "Get Started" button to register using Internet Identity. Once authenticated, you can access your dashboard and begin a new property transaction.'
    },
    {
      question: 'What is Internet Identity authentication?',
      answer: 'Internet Identity is a blockchain-based authentication system that doesn\'t require passwords. You can use biometrics, security keys, or other devices to securely access your account.'
    },
    {
      question: 'How long does the conveyancing process take?',
      answer: 'PropXchain keeps every party on the same live transaction and records each milestone as it happens, so progress is visible and nothing waits in an email queue. Completion time still depends on your conveyancer and your local authority searches.'
    },
    {
      question: 'Is my data secure on the blockchain?',
      answer: 'Yes. All personal documents are encrypted with AES-256 encryption before storage. Only transaction hashes are stored on the public blockchain, not the documents themselves.'
    },
    {
      question: 'What are the fees for using PropXchain?',
      answer: 'Buyers and sellers can run a transaction free on the Starter tier and choose their own providers, with every price shown before they commit. The optional Premium tier adds a £75-per-transaction AI co-pilot. Your professional fees are set by the conveyancer and search providers you choose.'
    },
    {
      question: 'Can I invite my solicitor to the platform?',
      answer: 'Yes! You can invite solicitors, buyers, and sellers to collaborate on your transaction. Each party will have role-based access to relevant information.'
    },
    {
      question: 'What types of properties are supported?',
      answer: 'PropXchain supports all UK property types including freehold, leasehold, new builds, shared ownership, and more.'
    },
    {
      question: 'Is PropXchain legally compliant?',
      answer: 'Yes. PropXchain complies with all UK property law including the Land Registration Act 2002, Building Safety Act 2022, and Money Laundering Regulations 2017.'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0B1120]">
      {/* Header */}
      <header className="bg-white dark:bg-[#0F1729] shadow-sm border-b border-gray-200 dark:border-[#1E293B]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center cursor-pointer" onClick={() => navigate('/')}>
              <Logo variant="mark" tone="onLight" to={null} className="h-11 w-auto" />
            </div>
            <nav className="hidden md:flex space-x-8">
              <button
                onClick={() => navigate('/features')}
                className="text-gray-700 dark:text-[#CBD5E1] hover:text-black dark:hover:text-[#F1F5F9]"
              >
                Features
              </button>
              <button
                onClick={() => navigate('/how-it-works')}
                className="text-gray-700 dark:text-[#CBD5E1] hover:text-black dark:hover:text-[#F1F5F9]"
              >
                How It Works
              </button>
              <button
                onClick={() => navigate('/about')}
                className="text-gray-700 dark:text-[#CBD5E1] hover:text-black dark:hover:text-[#F1F5F9]"
              >
                About
              </button>
            </nav>
            <div className="flex space-x-4">
              <button
                onClick={() => navigate('/login')}
                className="px-4 py-2 text-black dark:text-[#F1F5F9] hover:text-gray-700 dark:hover:text-[#CBD5E1] font-medium"
              >
                Login
              </button>
              <button
                onClick={() => navigate('/register')}
                className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 dark:ring-1 dark:ring-[#334155] font-medium"
              >
                Get Started
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-white dark:bg-[#0F1729] border-b border-gray-200 dark:border-[#1E293B]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
          <h1 className="text-4xl font-bold text-black dark:text-[#F1F5F9] mb-4">Support Center</h1>
          <p className="text-xl text-gray-700 dark:text-[#CBD5E1] max-w-3xl mx-auto">
            We're here to help! Get answers to common questions or submit a support request.
          </p>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Contact Options */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white dark:bg-[#0F1729] border border-gray-200 dark:border-[#1E293B] rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-black dark:text-[#F1F5F9] mb-4">Contact Options</h3>

              <div className="space-y-4">
                <div className="flex items-start">
                  <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-semibold text-black dark:text-[#F1F5F9]">Email Support</h4>
                    <p className="text-sm text-gray-700 dark:text-[#CBD5E1]">info@propxchain.com</p>
                    <p className="text-xs text-gray-600 dark:text-[#94A3B8] mt-1">Response within 24 hours</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-semibold text-black dark:text-[#F1F5F9]">Live Chat</h4>
                    <p className="text-sm text-gray-700 dark:text-[#CBD5E1]">Available Monday-Friday</p>
                    <p className="text-xs text-gray-600 dark:text-[#94A3B8] mt-1">9:00 AM - 5:00 PM GMT</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-semibold text-black dark:text-[#F1F5F9]">Documentation</h4>
                    <p className="text-sm text-gray-700 dark:text-[#CBD5E1]">Browse our knowledge base</p>
                    <button className="text-xs text-black dark:text-[#F1F5F9] underline mt-1">View Docs</button>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-black text-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold mb-2">Need Urgent Help?</h3>
              <p className="text-gray-300 text-sm mb-4">
                For critical issues affecting active transactions, contact our priority support line.
              </p>
              <button className="w-full px-4 py-2 bg-white dark:bg-[#0F1729] text-black dark:text-[#F1F5F9] rounded-lg hover:bg-gray-200 dark:hover:bg-[#1E293B] font-medium">
                Priority Support
              </button>
            </div>
          </div>

          {/* Support Form */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-[#0F1729] border border-gray-200 dark:border-[#1E293B] rounded-xl shadow-lg p-8">
              <h2 className="text-2xl font-bold text-black dark:text-[#F1F5F9] mb-6">Submit a Support Request</h2>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-black dark:text-[#F1F5F9] mb-2">
                    Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 dark:border-[#334155] rounded-lg focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent"
                    placeholder="Your full name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-black dark:text-[#F1F5F9] mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 dark:border-[#334155] rounded-lg focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent"
                    placeholder="your.email@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-black dark:text-[#F1F5F9] mb-2">
                    Subject *
                  </label>
                  <select
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 dark:border-[#334155] rounded-lg focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent"
                  >
                    <option value="">Select a topic...</option>
                    <option value="account">Account & Authentication</option>
                    <option value="transaction">Transaction Support</option>
                    <option value="documents">Document Upload Issues</option>
                    <option value="payment">Payment & Billing</option>
                    <option value="technical">Technical Issues</option>
                    <option value="compliance">Compliance & Legal</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-black dark:text-[#F1F5F9] mb-2">
                    Message *
                  </label>
                  <textarea
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    required
                    rows={6}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-[#334155] rounded-lg focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent"
                    placeholder="Please describe your issue in detail..."
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 dark:ring-1 dark:ring-[#334155] font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Submitting...' : 'Submit Support Request'}
                </button>
              </form>
            </div>

            {/* FAQs */}
            <div className="mt-8 bg-white dark:bg-[#0F1729] border border-gray-200 dark:border-[#1E293B] rounded-xl shadow-lg p-8">
              <h2 className="text-2xl font-bold text-black dark:text-[#F1F5F9] mb-6">Frequently Asked Questions</h2>

              <div className="space-y-6">
                {faqs.map((faq, index) => (
                  <div key={index} className="border-b border-gray-200 dark:border-[#1E293B] pb-6 last:border-0">
                    <h3 className="text-lg font-semibold text-black dark:text-[#F1F5F9] mb-2">{faq.question}</h3>
                    <p className="text-gray-700 dark:text-[#CBD5E1]">{faq.answer}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-gray-300">&copy; 2025 PropXchain. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default SupportPage;
