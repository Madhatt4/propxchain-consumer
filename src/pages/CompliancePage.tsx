import React from 'react';
import { useNavigate } from 'react-router-dom';

import { Logo } from '@/components/brand/Logo';

const CompliancePage: React.FC = () => {
  const navigate = useNavigate();

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
          <h1 className="text-4xl font-bold text-black dark:text-[#F1F5F9] mb-4">Compliance & Regulations</h1>
          <p className="text-xl text-gray-700 dark:text-[#CBD5E1] max-w-3xl mx-auto">
            PropXchain operates in full compliance with UK property law, blockchain regulations, and data protection requirements.
          </p>
        </div>
      </section>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* UK Property Law Compliance */}
        <section className="bg-white dark:bg-[#0F1729] border border-gray-200 dark:border-[#1E293B] rounded-xl shadow-lg p-8 md:p-12 mb-8">
          <h2 className="text-3xl font-bold text-black dark:text-[#F1F5F9] mb-6">UK Property Law Compliance</h2>
          <p className="text-gray-700 dark:text-[#CBD5E1] mb-6">
            PropXchain is designed to comply with all relevant UK property legislation and conveyancing requirements.
          </p>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="border border-gray-200 dark:border-[#1E293B] rounded-lg p-6">
              <h3 className="text-xl font-bold text-black dark:text-[#F1F5F9] mb-3">Land Registration Act 2002</h3>
              <p className="text-gray-700 dark:text-[#CBD5E1] mb-3">
                Our platform integrates with HM Land Registry systems and maintains compliance with land registration requirements.
              </p>
              <ul className="space-y-2 text-gray-700 dark:text-[#CBD5E1]">
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-black dark:text-[#F1F5F9] mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Electronic document submission
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-black dark:text-[#F1F5F9] mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Title deed verification
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-black dark:text-[#F1F5F9] mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Property boundaries and rights
                </li>
              </ul>
            </div>

            <div className="border border-gray-200 dark:border-[#1E293B] rounded-lg p-6">
              <h3 className="text-xl font-bold text-black dark:text-[#F1F5F9] mb-3">Building Safety Act 2022</h3>
              <p className="text-gray-700 dark:text-[#CBD5E1] mb-3">
                Full compliance with building safety requirements for high-rise residential buildings.
              </p>
              <ul className="space-y-2 text-gray-700 dark:text-[#CBD5E1]">
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-black dark:text-[#F1F5F9] mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  EWS1 form handling
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-black dark:text-[#F1F5F9] mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Building safety certificates
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-black dark:text-[#F1F5F9] mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Cladding documentation
                </li>
              </ul>
            </div>

            <div className="border border-gray-200 dark:border-[#1E293B] rounded-lg p-6">
              <h3 className="text-xl font-bold text-black dark:text-[#F1F5F9] mb-3">Leasehold Reform Act 2023</h3>
              <p className="text-gray-700 dark:text-[#CBD5E1] mb-3">
                Up-to-date compliance with latest leasehold reforms and shared ownership requirements.
              </p>
              <ul className="space-y-2 text-gray-700 dark:text-[#CBD5E1]">
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-black dark:text-[#F1F5F9] mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Ground rent documentation
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-black dark:text-[#F1F5F9] mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Service charge transparency
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-black dark:text-[#F1F5F9] mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Lease extension procedures
                </li>
              </ul>
            </div>

            <div className="border border-gray-200 dark:border-[#1E293B] rounded-lg p-6">
              <h3 className="text-xl font-bold text-black dark:text-[#F1F5F9] mb-3">Law Society Standards</h3>
              <p className="text-gray-700 dark:text-[#CBD5E1] mb-3">
                Adherence to Law Society of England and Wales conveyancing protocols.
              </p>
              <ul className="space-y-2 text-gray-700 dark:text-[#CBD5E1]">
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-black dark:text-[#F1F5F9] mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  TA6 form compliance
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-black dark:text-[#F1F5F9] mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Property information forms
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-black dark:text-[#F1F5F9] mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Fixtures and fittings lists
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* AML and KYC Compliance */}
        <section className="bg-white dark:bg-[#0F1729] border border-gray-200 dark:border-[#1E293B] rounded-xl shadow-lg p-8 md:p-12 mb-8">
          <h2 className="text-3xl font-bold text-black dark:text-[#F1F5F9] mb-6">Anti-Money Laundering (AML) & KYC</h2>
          <p className="text-gray-700 dark:text-[#CBD5E1] mb-6">
            PropXchain implements robust AML and Know Your Customer (KYC) procedures in accordance with UK regulations.
          </p>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="border border-gray-200 dark:border-[#1E293B] rounded-lg p-6">
              <div className="w-12 h-12 bg-black rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-black dark:text-[#F1F5F9] mb-2">Identity Verification</h3>
              <p className="text-gray-700 dark:text-[#CBD5E1]">
                All users must complete identity verification using government-issued ID and proof of address.
              </p>
            </div>

            <div className="border border-gray-200 dark:border-[#1E293B] rounded-lg p-6">
              <div className="w-12 h-12 bg-black rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-black dark:text-[#F1F5F9] mb-2">Source of Funds</h3>
              <p className="text-gray-700 dark:text-[#CBD5E1]">
                Buyers must provide proof of funds and evidence of legitimate source for property purchase.
              </p>
            </div>

            <div className="border border-gray-200 dark:border-[#1E293B] rounded-lg p-6">
              <div className="w-12 h-12 bg-black rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-black dark:text-[#F1F5F9] mb-2">Ongoing Monitoring</h3>
              <p className="text-gray-700 dark:text-[#CBD5E1]">
                Continuous monitoring of transactions for suspicious activity and regulatory compliance.
              </p>
            </div>
          </div>

          <div className="mt-6 p-6 bg-gray-50 dark:bg-[#0B1120] border border-gray-200 dark:border-[#1E293B] rounded-lg">
            <h3 className="text-lg font-bold text-black dark:text-[#F1F5F9] mb-2">Money Laundering Regulations 2017</h3>
            <p className="text-gray-700 dark:text-[#CBD5E1]">
              PropXchain is committed to preventing money laundering and terrorist financing. We comply with all requirements of the Money Laundering, Terrorist Financing and Transfer of Funds (Information on the Payer) Regulations 2017.
            </p>
          </div>
        </section>

        {/* Data Protection */}
        <section className="bg-white dark:bg-[#0F1729] border border-gray-200 dark:border-[#1E293B] rounded-xl shadow-lg p-8 md:p-12 mb-8">
          <h2 className="text-3xl font-bold text-black dark:text-[#F1F5F9] mb-6">Data Protection & Privacy</h2>

          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div>
              <h3 className="text-xl font-bold text-black dark:text-[#F1F5F9] mb-3">UK GDPR Compliance</h3>
              <p className="text-gray-700 dark:text-[#CBD5E1] mb-4">
                Full compliance with UK General Data Protection Regulation (UK GDPR) and Data Protection Act 2018.
              </p>
              <ul className="space-y-2 text-gray-700 dark:text-[#CBD5E1]">
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-black dark:text-[#F1F5F9] mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Lawful basis for data processing
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-black dark:text-[#F1F5F9] mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Data subject rights protection
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-black dark:text-[#F1F5F9] mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Privacy by design principles
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-black dark:text-[#F1F5F9] mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Data breach notification procedures
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-xl font-bold text-black dark:text-[#F1F5F9] mb-3">Security Measures</h3>
              <p className="text-gray-700 dark:text-[#CBD5E1] mb-4">
                Industry-leading security to protect personal and transaction data.
              </p>
              <ul className="space-y-2 text-gray-700 dark:text-[#CBD5E1]">
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-black dark:text-[#F1F5F9] mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  AES-256 encryption for documents
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-black dark:text-[#F1F5F9] mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Internet Identity authentication
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-black dark:text-[#F1F5F9] mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Blockchain immutability
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-black dark:text-[#F1F5F9] mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Regular security audits
                </li>
              </ul>
            </div>
          </div>

          <div className="p-6 bg-gray-50 dark:bg-[#0B1120] border border-gray-200 dark:border-[#1E293B] rounded-lg">
            <p className="text-gray-700 dark:text-[#CBD5E1]">
              <strong>ICO Registration:</strong> PropXchain handles personal data as a data controller under UK GDPR and is registered with the UK Information Commissioner's Office (ICO), registration reference <strong>ZC206687</strong>.
            </p>
          </div>
        </section>

        {/* Blockchain Compliance */}
        <section className="bg-white dark:bg-[#0F1729] border border-gray-200 dark:border-[#1E293B] rounded-xl shadow-lg p-8 md:p-12">
          <h2 className="text-3xl font-bold text-black dark:text-[#F1F5F9] mb-6">Blockchain & Technology Compliance</h2>

          <div className="space-y-6">
            <div className="border border-gray-200 dark:border-[#1E293B] rounded-lg p-6">
              <h3 className="text-xl font-bold text-black dark:text-[#F1F5F9] mb-3">Internet Computer Protocol (ICP)</h3>
              <p className="text-gray-700 dark:text-[#CBD5E1] mb-4">
                PropXchain is built on the Internet Computer blockchain, a decentralized network governed by the DFINITY Foundation.
              </p>
              <ul className="space-y-2 text-gray-700 dark:text-[#CBD5E1]">
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-black dark:text-[#F1F5F9] mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Decentralized infrastructure
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-black dark:text-[#F1F5F9] mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Cryptographic verification
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-black dark:text-[#F1F5F9] mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Transparent audit trails
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-black dark:text-[#F1F5F9] mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Immutable record keeping
                </li>
              </ul>
            </div>

            <div className="border border-gray-200 dark:border-[#1E293B] rounded-lg p-6">
              <h3 className="text-xl font-bold text-black dark:text-[#F1F5F9] mb-3">Electronic Signatures</h3>
              <p className="text-gray-700 dark:text-[#CBD5E1] mb-4">
                Our electronic signature system complies with the UK Electronic Communications Act 2000 and eIDAS regulation.
              </p>
              <p className="text-gray-700 dark:text-[#CBD5E1]">
                Digital signatures on PropXchain are legally binding and enforceable in UK property transactions.
              </p>
            </div>

            <div className="border border-gray-200 dark:border-[#1E293B] rounded-lg p-6">
              <h3 className="text-xl font-bold text-black dark:text-[#F1F5F9] mb-3">Smart Contracts</h3>
              <p className="text-gray-700 dark:text-[#CBD5E1]">
                All smart contracts are audited for security and compliance. Contract logic is transparent and verifiable on the blockchain.
              </p>
            </div>
          </div>
        </section>

        {/* Contact Section */}
        <section className="mt-12 bg-black text-white rounded-xl shadow-lg p-8 md:p-12 text-center">
          <h2 className="text-3xl font-bold mb-4">Questions About Compliance?</h2>
          <p className="text-gray-300 mb-6 max-w-2xl mx-auto">
            Our compliance team is here to answer any questions about our regulatory adherence and legal framework.
          </p>
          <button
            onClick={() => navigate('/support')}
            className="px-8 py-3 bg-white dark:bg-[#0F1729] text-black dark:text-[#F1F5F9] rounded-lg hover:bg-gray-200 dark:hover:bg-[#1E293B] font-medium text-lg"
          >
            Contact Compliance Team
          </button>
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

export default CompliancePage;
