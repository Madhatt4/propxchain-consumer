import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { icpService } from '../services/icp.service';
import { logger } from '@/utils/logger';
import { Logo } from '@/components/brand/Logo';

const PartnersPage: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    website: '',
    partnerType: '',
    message: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      await icpService.submitPartnerInquiry(
        formData.name,
        formData.email,
        formData.company,
        formData.website,
        formData.partnerType,
        formData.message
      );

      alert('✅ Partnership inquiry submitted successfully!\n\nOur partnerships team will contact you at ' + formData.email + ' within 2 business days.');
      setFormData({ name: '', email: '', company: '', website: '', partnerType: '', message: '' });
    } catch (error) {
      logger.error('Error submitting partner inquiry:', error);
      alert('Error submitting inquiry. Please try again or email us directly at partners@propxchain.com');
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
          <h1 className="text-5xl font-bold mb-6">Partner with PropXchain</h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-8">
            Join our ecosystem of technology partners, integrators, and industry leaders revolutionizing UK property conveyancing.
          </p>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Partnership Types */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-black dark:text-[#F1F5F9] mb-8 text-center">Partnership Opportunities</h2>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white dark:bg-[#0F1729] border border-gray-200 dark:border-[#1E293B] rounded-xl shadow-lg p-8">
              <div className="w-16 h-16 bg-black rounded-lg flex items-center justify-center mb-6">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-black dark:text-[#F1F5F9] mb-4">Technology Partners</h3>
              <p className="text-gray-700 dark:text-[#CBD5E1] mb-4">
                Integrate PropXchain's blockchain conveyancing into your existing platform or service.
              </p>
              <ul className="space-y-2 text-gray-700 dark:text-[#CBD5E1] mb-6">
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-black dark:text-[#F1F5F9] mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  RESTful API access
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-black dark:text-[#F1F5F9] mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Comprehensive documentation
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-black dark:text-[#F1F5F9] mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  White-label options
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-black dark:text-[#F1F5F9] mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Technical support team
                </li>
              </ul>
              <button
                onClick={() => document.getElementById('partner-form')?.scrollIntoView({ behavior: 'smooth' })}
                className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 dark:ring-1 dark:ring-[#334155] font-medium"
              >
                Become a Tech Partner
              </button>
            </div>

            <div className="bg-white dark:bg-[#0F1729] border border-gray-200 dark:border-[#1E293B] rounded-xl shadow-lg p-8">
              <div className="w-16 h-16 bg-black rounded-lg flex items-center justify-center mb-6">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-black dark:text-[#F1F5F9] mb-4">Referral Partners</h3>
              <p className="text-gray-700 dark:text-[#CBD5E1] mb-4">
                Earn commissions by referring clients to PropXchain. Perfect for consultants, advisors, and industry professionals.
              </p>
              <ul className="space-y-2 text-gray-700 dark:text-[#CBD5E1] mb-6">
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-black dark:text-[#F1F5F9] mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Competitive commission structure
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-black dark:text-[#F1F5F9] mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Marketing materials provided
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-black dark:text-[#F1F5F9] mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Partner dashboard & tracking
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-black dark:text-[#F1F5F9] mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Monthly payouts
                </li>
              </ul>
              <button
                onClick={() => document.getElementById('partner-form')?.scrollIntoView({ behavior: 'smooth' })}
                className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 dark:ring-1 dark:ring-[#334155] font-medium"
              >
                Join Referral Program
              </button>
            </div>

            <div className="bg-white dark:bg-[#0F1729] border border-gray-200 dark:border-[#1E293B] rounded-xl shadow-lg p-8">
              <div className="w-16 h-16 bg-black rounded-lg flex items-center justify-center mb-6">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-black dark:text-[#F1F5F9] mb-4">Law Firms & Solicitors</h3>
              <p className="text-gray-700 dark:text-[#CBD5E1] mb-4">
                Become a PropXchain-certified conveyancing firm and access our network of blockchain-enabled transactions.
              </p>
              <ul className="space-y-2 text-gray-700 dark:text-[#CBD5E1] mb-6">
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-black dark:text-[#F1F5F9] mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Certified partner badge
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-black dark:text-[#F1F5F9] mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Listed in partner directory
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-black dark:text-[#F1F5F9] mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Training & onboarding
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-black dark:text-[#F1F5F9] mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Lead generation opportunities
                </li>
              </ul>
              <button
                onClick={() => document.getElementById('partner-form')?.scrollIntoView({ behavior: 'smooth' })}
                className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 dark:ring-1 dark:ring-[#334155] font-medium"
              >
                Become Certified Partner
              </button>
            </div>

            <div className="bg-white dark:bg-[#0F1729] border border-gray-200 dark:border-[#1E293B] rounded-xl shadow-lg p-8">
              <div className="w-16 h-16 bg-black rounded-lg flex items-center justify-center mb-6">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-black dark:text-[#F1F5F9] mb-4">PropTech Innovators</h3>
              <p className="text-gray-700 dark:text-[#CBD5E1] mb-4">
                Build the future of property technology together. Collaborate on blockchain innovation and Web3 integration.
              </p>
              <ul className="space-y-2 text-gray-700 dark:text-[#CBD5E1] mb-6">
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-black dark:text-[#F1F5F9] mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Joint product development
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-black dark:text-[#F1F5F9] mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Co-marketing opportunities
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-black dark:text-[#F1F5F9] mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Early access to features
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-black dark:text-[#F1F5F9] mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Strategic collaboration
                </li>
              </ul>
              <button
                onClick={() => document.getElementById('partner-form')?.scrollIntoView({ behavior: 'smooth' })}
                className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 dark:ring-1 dark:ring-[#334155] font-medium"
              >
                Explore Collaboration
              </button>
            </div>
          </div>
        </section>

        {/* Partner Benefits */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-black dark:text-[#F1F5F9] mb-8 text-center">Why Partner with PropXchain?</h2>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-20 h-20 bg-black rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-black dark:text-[#F1F5F9] mb-2">Growing Market</h3>
              <p className="text-gray-700 dark:text-[#CBD5E1]">
                Join the blockchain revolution in UK property. £1.3 trillion market transitioning to Web3 technology.
              </p>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 bg-black rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-black dark:text-[#F1F5F9] mb-2">Revenue Opportunity</h3>
              <p className="text-gray-700 dark:text-[#CBD5E1]">
                Competitive commissions, revenue sharing, and co-selling opportunities with growing customer base.
              </p>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 bg-black rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-black dark:text-[#F1F5F9] mb-2">Market Leadership</h3>
              <p className="text-gray-700 dark:text-[#CBD5E1]">
                Offer clients a verifiable, shared record of their transaction and position your firm at the front of a changing market.
              </p>
            </div>
          </div>
        </section>

        {/* Partner Form */}
        <section id="partner-form" className="bg-white dark:bg-[#0F1729] border border-gray-200 dark:border-[#1E293B] rounded-xl shadow-lg p-8 md:p-12">
          <h2 className="text-3xl font-bold text-black dark:text-[#F1F5F9] mb-6 text-center">Become a Partner</h2>
          <p className="text-gray-700 dark:text-[#CBD5E1] text-center mb-8 max-w-2xl mx-auto">
            Complete the form below and our partnerships team will be in touch to discuss opportunities.
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
                <label className="block text-sm font-medium text-black dark:text-[#F1F5F9] mb-2">Company/Organisation *</label>
                <input
                  type="text"
                  name="company"
                  value={formData.company}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 dark:border-[#334155] rounded-lg focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent"
                  placeholder="Your organisation"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-black dark:text-[#F1F5F9] mb-2">Website</label>
                <input
                  type="url"
                  name="website"
                  value={formData.website}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-[#334155] rounded-lg focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent"
                  placeholder="https://yourcompany.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-black dark:text-[#F1F5F9] mb-2">Partnership Type *</label>
              <select
                name="partnerType"
                value={formData.partnerType}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 dark:border-[#334155] rounded-lg focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent"
              >
                <option value="">Select partnership type...</option>
                <option value="technology">Technology Integration</option>
                <option value="referral">Referral Program</option>
                <option value="lawfirm">Law Firm Partnership</option>
                <option value="proptech">PropTech Collaboration</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-black dark:text-[#F1F5F9] mb-2">Tell us about your organisation</label>
              <textarea
                name="message"
                value={formData.message}
                onChange={handleChange}
                rows={5}
                className="w-full px-4 py-2 border border-gray-300 dark:border-[#334155] rounded-lg focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent"
                placeholder="Describe your company and what you're looking to achieve through partnership..."
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full px-8 py-3 bg-black text-white rounded-lg hover:bg-gray-800 dark:ring-1 dark:ring-[#334155] font-medium text-lg disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {submitting ? 'Submitting...' : 'Submit Partnership Inquiry'}
            </button>
          </form>
        </section>

        {/* CTA Section */}
        <section className="mt-16 bg-black text-white rounded-xl shadow-lg p-8 md:p-12 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Transform Property Conveyancing Together?</h2>
          <p className="text-gray-300 mb-6 max-w-2xl mx-auto">
            Join our growing network of partners and help shape the future of blockchain-powered property transactions.
          </p>
          <div className="flex justify-center gap-4">
            <button
              onClick={() => document.getElementById('partner-form')?.scrollIntoView({ behavior: 'smooth' })}
              className="px-8 py-3 bg-white dark:bg-[#0F1729] text-black dark:text-[#F1F5F9] rounded-lg hover:bg-gray-200 dark:hover:bg-[#1E293B] font-medium"
            >
              Apply Now
            </button>
            <button
              onClick={() => navigate('/about')}
              className="px-8 py-3 bg-transparent border-2 border-white text-white rounded-lg hover:bg-white dark:hover:bg-[#0F1729] hover:text-black dark:hover:text-[#F1F5F9] font-medium transition-all"
            >
              Learn More About Us
            </button>
          </div>
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

export default PartnersPage;
