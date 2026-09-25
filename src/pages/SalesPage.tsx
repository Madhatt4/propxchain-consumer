import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { icpService } from '../services/icp.service';
import { logger } from '@/utils/logger';
import { Logo } from '@/components/brand/Logo';

const SalesPage: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    phone: '',
    userType: '',
    volume: '',
    message: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      await icpService.submitSalesInquiry(
        formData.name,
        formData.email,
        formData.company,
        formData.phone,
        formData.userType,
        formData.volume,
        formData.message
      );

      alert('✅ Sales inquiry submitted successfully!\n\nOur sales team will contact you at ' + formData.email + ' within 1 business day.');
      setFormData({ name: '', email: '', company: '', phone: '', userType: '', volume: '', message: '' });
    } catch (error) {
      logger.error('Error submitting sales inquiry:', error);
      alert('Error submitting inquiry. Please try again or email us directly at sales@propxchain.com');
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
      <section className="bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-5xl font-bold mb-6">Transform Your Conveyancing Business</h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-8">
            Join leading solicitors, estate agents, and property professionals who are revolutionizing transactions with PropXchain.
          </p>
          <div className="flex justify-center gap-4">
            <button
              onClick={() => document.getElementById('contact-form')?.scrollIntoView({ behavior: 'smooth' })}
              className="px-8 py-3 bg-white dark:bg-[#0F1729] text-black dark:text-[#F1F5F9] rounded-lg hover:bg-gray-200 dark:hover:bg-[#1E293B] font-medium text-lg"
            >
              Schedule Demo
            </button>
            <button
              onClick={() => navigate('/features')}
              className="px-8 py-3 bg-transparent border-2 border-white text-white rounded-lg hover:bg-white dark:hover:bg-[#0F1729] hover:text-black dark:hover:text-[#F1F5F9] font-medium text-lg transition-all"
            >
              View Features
            </button>
          </div>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Solutions for Different Users */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-black dark:text-[#F1F5F9] mb-8 text-center">Solutions for Every Professional</h2>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white dark:bg-[#0F1729] border border-gray-200 dark:border-[#1E293B] rounded-xl shadow-lg p-8">
              <div className="w-16 h-16 bg-black rounded-lg flex items-center justify-center mb-6">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-black dark:text-[#F1F5F9] mb-4">Solicitors & Conveyancers</h3>
              <p className="text-gray-700 dark:text-[#CBD5E1] mb-4">
                Streamline your conveyancing practice with blockchain-backed documentation, automated workflows, and instant compliance checks.
              </p>
              <ul className="space-y-2 text-gray-700 dark:text-[#CBD5E1]">
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-black dark:text-[#F1F5F9] mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Handle 3x more transactions
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-black dark:text-[#F1F5F9] mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Automated AML/KYC checks
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-black dark:text-[#F1F5F9] mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Instant document verification
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-black dark:text-[#F1F5F9] mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Full audit trail on blockchain
                </li>
              </ul>
            </div>

            <div className="bg-white dark:bg-[#0F1729] border border-gray-200 dark:border-[#1E293B] rounded-xl shadow-lg p-8">
              <div className="w-16 h-16 bg-black rounded-lg flex items-center justify-center mb-6">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-black dark:text-[#F1F5F9] mb-4">Estate Agents & Developers</h3>
              <p className="text-gray-700 dark:text-[#CBD5E1] mb-4">
                Offer faster completions to attract more buyers and sellers. Reduce fall-throughs with transparent, blockchain-verified transactions.
              </p>
              <ul className="space-y-2 text-gray-700 dark:text-[#CBD5E1]">
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-black dark:text-[#F1F5F9] mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  7-day completions
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-black dark:text-[#F1F5F9] mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Reduced fall-through rates
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-black dark:text-[#F1F5F9] mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Real-time chain visibility
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-black dark:text-[#F1F5F9] mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  White-label solutions available
                </li>
              </ul>
            </div>

            <div className="bg-white dark:bg-[#0F1729] border border-gray-200 dark:border-[#1E293B] rounded-xl shadow-lg p-8">
              <div className="w-16 h-16 bg-black rounded-lg flex items-center justify-center mb-6">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-black dark:text-[#F1F5F9] mb-4">Enterprise & High Volume</h3>
              <p className="text-gray-700 dark:text-[#CBD5E1] mb-4">
                Custom solutions for organizations processing hundreds of transactions per month. API access, dedicated support, and volume pricing.
              </p>
              <ul className="space-y-2 text-gray-700 dark:text-[#CBD5E1]">
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-black dark:text-[#F1F5F9] mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Custom API integration
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-black dark:text-[#F1F5F9] mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Dedicated account manager
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-black dark:text-[#F1F5F9] mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Volume-based pricing
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-black dark:text-[#F1F5F9] mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  24/7 priority support
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-black dark:text-[#F1F5F9] mb-4 text-center">Simple, Transparent Pricing</h2>
          <p className="text-gray-600 dark:text-[#94A3B8] text-center mb-8">Starter is free — pick your own providers and see every price up front. Premium is £75 per transaction for the AI co-pilot.</p>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Starter - Free + HMLR fees */}
            <div className="bg-white dark:bg-[#0F1729] border border-gray-200 dark:border-[#1E293B] rounded-xl shadow-lg p-8">
              <h3 className="text-2xl font-bold text-black dark:text-[#F1F5F9] mb-2">Starter</h3>
              <p className="text-gray-700 dark:text-[#CBD5E1] mb-6">Self-serve. Pick your own providers and see every price up front. No platform fee.</p>
              <div className="mb-6">
                <span className="text-4xl font-bold text-black dark:text-[#F1F5F9]">Free</span>
                <span className="text-gray-700 dark:text-[#CBD5E1]"> pay providers direct</span>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-black dark:text-[#F1F5F9] mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-700 dark:text-[#CBD5E1]">Transaction tracking + on-chain audit</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-black dark:text-[#F1F5F9] mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-700 dark:text-[#CBD5E1]">HM Land Registry title pull — £7, names the registered owner</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-black dark:text-[#F1F5F9] mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-700 dark:text-[#CBD5E1]">Document vault + verification</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-black dark:text-[#F1F5F9] mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-700 dark:text-[#CBD5E1]">Conveyancer panel access</span>
                </li>
              </ul>
              <button
                onClick={() => navigate('/register')}
                className="w-full px-6 py-3 border-2 border-black text-black rounded-lg hover:bg-black hover:text-white font-medium transition-all"
              >
                Get Started Free
              </button>
            </div>

            {/* Premium - £75 */}
            <div className="bg-black text-white rounded-xl shadow-xl p-8 relative">
              <div className="absolute top-0 right-0 bg-white dark:bg-[#0F1729] text-black dark:text-[#F1F5F9] px-4 py-1 rounded-bl-lg rounded-tr-lg text-sm font-semibold">
                POPULAR
              </div>
              <h3 className="text-2xl font-bold mb-2">Premium</h3>
              <p className="text-gray-300 mb-6">An AI co-pilot for the whole transaction, on top of everything in Starter.</p>
              <div className="mb-6">
                <span className="text-4xl font-bold">£75</span>
                <span className="text-gray-300">/transaction</span>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-white mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Everything in Starter</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-white mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>AI reads your HMLR title in plain English</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-white mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>AI reads your search results, issues flagged</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-white mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Complexity-aware conveyancer quote request</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-white mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>AI next-step cards + priority support</span>
                </li>
              </ul>
              <button
                onClick={() => navigate('/register')}
                className="w-full px-6 py-3 bg-white dark:bg-[#0F1729] text-black dark:text-[#F1F5F9] rounded-lg hover:bg-gray-200 dark:hover:bg-[#1E293B] font-medium"
              >
                Get Started
              </button>
            </div>

          </div>
        </section>

        {/* Contact Form */}
        <section id="contact-form" className="bg-white dark:bg-[#0F1729] border border-gray-200 dark:border-[#1E293B] rounded-xl shadow-lg p-8 md:p-12">
          <h2 className="text-3xl font-bold text-black dark:text-[#F1F5F9] mb-6 text-center">Get in Touch with Sales</h2>
          <p className="text-gray-700 dark:text-[#CBD5E1] text-center mb-8 max-w-2xl mx-auto">
            Schedule a demo, discuss pricing, or learn how PropXchain can transform your conveyancing business.
          </p>

          <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-black dark:text-[#F1F5F9] mb-2">Name *</label>
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
                <label className="block text-sm font-medium text-black dark:text-[#F1F5F9] mb-2">Email *</label>
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
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-black dark:text-[#F1F5F9] mb-2">Company/Firm</label>
                <input
                  type="text"
                  name="company"
                  value={formData.company}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-[#334155] rounded-lg focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent"
                  placeholder="Your organisation"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-black dark:text-[#F1F5F9] mb-2">Phone</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-[#334155] rounded-lg focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent"
                  placeholder="Your phone number"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-black dark:text-[#F1F5F9] mb-2">User Type *</label>
                <select
                  name="userType"
                  value={formData.userType}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 dark:border-[#334155] rounded-lg focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent"
                >
                  <option value="">Select your role...</option>
                  <option value="solicitor">Solicitor/Conveyancer</option>
                  <option value="estate-agent">Estate Agent</option>
                  <option value="developer">Property Developer</option>
                  <option value="enterprise">Enterprise/High Volume</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-black dark:text-[#F1F5F9] mb-2">Expected Volume</label>
                <select
                  name="volume"
                  value={formData.volume}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-[#334155] rounded-lg focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent"
                >
                  <option value="">Transactions per month...</option>
                  <option value="1-5">1-5 transactions</option>
                  <option value="6-20">6-20 transactions</option>
                  <option value="21-50">21-50 transactions</option>
                  <option value="50+">50+ transactions</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-black dark:text-[#F1F5F9] mb-2">Message</label>
              <textarea
                name="message"
                value={formData.message}
                onChange={handleChange}
                rows={5}
                className="w-full px-4 py-2 border border-gray-300 dark:border-[#334155] rounded-lg focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent"
                placeholder="Tell us about your requirements..."
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full px-8 py-3 bg-black text-white rounded-lg hover:bg-gray-800 dark:ring-1 dark:ring-[#334155] font-medium text-lg disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {submitting ? 'Submitting...' : 'Submit Inquiry'}
            </button>
          </form>
        </section>
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

export default SalesPage;
