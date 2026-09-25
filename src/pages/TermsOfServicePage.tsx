import React from 'react';
import { useNavigate } from 'react-router-dom';

import { Logo } from '@/components/brand/Logo';

const TermsOfServicePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen legal-page">
      <style>{`
        .legal-page { background: #FAFAF8; color: #1A1A1A; font-family: 'DM Sans', system-ui, -apple-system, sans-serif; }
        .legal-header { background: #FFFFFF; border-bottom: 1px solid #E5E7EB; }
        .legal-logo { font-family: 'Fraunces', serif; font-weight: 700; letter-spacing: -0.02em; color: #1A1A1A; text-decoration: none; font-size: 1.4rem; cursor: pointer; }
        .legal-logo .x { color: #0D9488; }
        .legal-back { font-family: 'Geist Mono', 'DM Mono', ui-monospace, monospace; font-size: 0.7rem; letter-spacing: 0.08em; text-transform: uppercase; color: #6B7280; text-decoration: none; cursor: pointer; }
        .legal-back:hover { color: #0D9488; }
        .legal-card { background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 12px; }
        .legal-title { font-family: 'Fraunces', serif; font-size: 2.4rem; font-weight: 700; letter-spacing: -0.02em; color: #1A1A1A; margin-bottom: 0.5rem; }
        .legal-meta { font-family: 'Geist Mono', 'DM Mono', ui-monospace, monospace; font-size: 0.68rem; letter-spacing: 0.08em; text-transform: uppercase; color: #6B7280; margin-bottom: 0.4rem; }
        .legal-subtle { font-size: 0.85rem; color: #6B7280; margin-bottom: 2rem; }
        .legal-banner { background: #F0F5F0; border-left: 3px solid #84A98C; padding: 1rem 1.2rem; border-radius: 4px; margin-bottom: 2.4rem; }
        .legal-banner p { color: #1A1A1A; font-size: 0.9rem; line-height: 1.65; margin: 0; }
        .legal-banner strong { color: #0D9488; font-weight: 600; }
        .legal-content h2 { font-family: 'Fraunces', serif; font-size: 1.55rem; font-weight: 700; color: #1A1A1A; margin-bottom: 1rem; letter-spacing: -0.015em; }
        .legal-content h3 { font-family: 'Fraunces', serif; font-size: 1.15rem; font-weight: 600; color: #1A1A1A; margin-bottom: 0.5rem; }
        .legal-content p, .legal-content li { color: #374151; line-height: 1.75; }
        .legal-content strong { color: #1A1A1A; font-weight: 600; }
        .legal-content a { color: #0D9488; text-decoration: underline; text-decoration-color: rgba(13,148,136,0.4); text-underline-offset: 2px; }
        .legal-content a:hover { text-decoration-color: #0D9488; }
        .legal-footer { background: #FFFFFF; border-top: 1px solid #E5E7EB; margin-top: 4rem; }
        .legal-footer-text { font-size: 0.78rem; color: #6B7280; }
        .legal-footer a { font-size: 0.78rem; color: #6B7280; text-decoration: none; }
        .legal-footer a:hover { color: #0D9488; }
      `}</style>

      {/* Header — minimal: logo + back link only, no auth CTAs */}
      <header className="legal-header">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex justify-between items-center">
          <a href="/" className="legal-logo" onClick={(e) => { e.preventDefault(); navigate('/'); }} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <Logo variant="mark" tone="onLight" to={null} className="h-10 w-auto" />
          </a>
          <a href="/" className="legal-back" onClick={(e) => { e.preventDefault(); navigate('/'); }}>
            ← Back to home
          </a>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="legal-card p-8 md:p-12">
          <h1 className="legal-title">Terms of Service</h1>
          <p className="legal-meta">Effective date · 1 May 2026</p>
          <p className="legal-subtle">Operator: PropXchain Ltd, a company registered in England and Wales (Company No. 17018978).</p>

          <div className="legal-banner">
            <p>
              <strong>Pre-launch notice.</strong> The Platform is currently a waitlist sign-up only. No live property transactions have launched. These Terms apply to your use of the Platform in its present form. Updated Terms governing live conveyancing transactions, fees, and exchange of contracts will be issued before commercial launch and will require your acceptance at that time.
            </p>
          </div>

          <div className="legal-content space-y-8">
            <section>
              <h2 className="text-2xl font-bold text-black mb-4">1. Agreement to Terms</h2>
              <p className="mb-4">
                By accessing and using PropXchain ("the Platform"), provided by PropXchain Ltd ("PropXchain", "we", "our", "us"), a company registered in England and Wales with company number 17018978, you accept and agree to be bound by the terms and provisions of this agreement. If you do not agree to these Terms of Service, please do not use the Platform.
              </p>
              <p>
                PropXchain is a blockchain-based property conveyancing platform built on the Internet Computer Protocol (ICP). These terms apply to all users of the Platform, including buyers, sellers, solicitors, and other participants in property transactions.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mb-4">2. Use of the Platform</h2>
              <h3 className="text-xl font-semibold text-black mb-2">2.1 Eligibility</h3>
              <p className="mb-4">
                You must be at least 18 years old and legally capable of entering into binding contracts to use this Platform. By using PropXchain, you represent and warrant that you meet these requirements.
              </p>

              <h3 className="text-xl font-semibold text-black mb-2">2.2 Account Registration</h3>
              <p className="mb-4">
                To access certain features of the Platform, you must register using Internet Identity authentication. You are responsible for:
              </p>
              <ul className="list-disc pl-6 space-y-2 mb-4">
                <li>Maintaining the security of your Internet Identity credentials</li>
                <li>All activities that occur under your account</li>
                <li>Notifying us immediately of any unauthorized use</li>
                <li>Providing accurate, current, and complete information</li>
              </ul>

              <h3 className="text-xl font-semibold text-black mb-2">2.3 Prohibited Uses</h3>
              <p className="mb-2">You agree not to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Use the Platform for any illegal purpose or in violation of any laws</li>
                <li>Upload false, misleading, or fraudulent information</li>
                <li>Attempt to gain unauthorized access to the Platform or other users' accounts</li>
                <li>Interfere with or disrupt the Platform's operation</li>
                <li>Use the Platform to transmit malware or harmful code</li>
                <li>Impersonate another person or entity</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mb-4">3. Property Transactions</h2>
              <h3 className="text-xl font-semibold text-black mb-2">3.1 Platform Role</h3>
              <p className="mb-4">
                PropXchain provides a technology platform to facilitate property conveyancing. We are not a party to any property transaction and do not act as:
              </p>
              <ul className="list-disc pl-6 space-y-2 mb-4">
                <li>A solicitor, legal advisor, or conveyancer</li>
                <li>An estate agent or property broker</li>
                <li>A financial advisor or mortgage broker</li>
                <li>A guarantor of any transaction</li>
              </ul>

              <h3 className="text-xl font-semibold text-black mb-2">3.2 Legal Compliance</h3>
              <p className="mb-4">
                All property transactions conducted through the Platform must comply with UK property law, including but not limited to:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Land Registration Act 2002</li>
                <li>Building Safety Act 2022</li>
                <li>Money Laundering Regulations 2017</li>
                <li>Anti-money laundering (AML) requirements</li>
                <li>Know Your Customer (KYC) regulations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mb-4">4. Blockchain and Data</h2>
              <h3 className="text-xl font-semibold text-black mb-2">4.1 Blockchain Records</h3>
              <p className="mb-4">
                Transaction data, documents, and milestones are recorded on the Internet Computer blockchain. You acknowledge that:
              </p>
              <ul className="list-disc pl-6 space-y-2 mb-4">
                <li>Blockchain records are immutable and permanent</li>
                <li>Certain transaction data may be publicly visible</li>
                <li>Personal data is encrypted and stored securely</li>
                <li>We cannot delete or modify blockchain records once created</li>
              </ul>

              <h3 className="text-xl font-semibold text-black mb-2">4.2 Document Storage</h3>
              <p>
                Documents uploaded to the Platform are encrypted and stored on decentralized storage. You retain ownership of your documents and grant PropXchain a license to store and process them for the purpose of facilitating your transaction.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mb-4">5. Fees and Payments</h2>
              <p className="mb-4">
                PropXchain charges fees for use of the Platform. All fees applicable to an order are shown to you before you confirm and pay, and you will not be charged more than the amount displayed at the point of purchase. We may change our fees from time to time; changes will not affect orders you have already placed, and for any recurring fee we will give you at least 30 days' notice.
              </p>
              <p className="mb-4">
                <strong>Property searches (PropXchain as merchant of record).</strong> When you order regulated property searches (for example local authority, drainage, environmental or similar searches) through the Platform, you purchase them from PropXchain as merchant of record, and we commission them from a third-party regulated search provider on your behalf. The price shown at checkout includes PropXchain's margin for arranging and delivering the searches. Your contract for the search order is with PropXchain and PropXchain is responsible to you for that order; the underlying search product remains that of the third-party provider.
              </p>
              <p className="mb-4">
                <strong>Official pass-through charges.</strong> Some items are official fees set by third parties (for example HM Land Registry). Where we collect these from you, we pass them through at the applicable official rate plus a fixed handling fee of £7, which is shown separately at checkout.
              </p>
              <p className="mb-4">
                <strong>Conveyancing fees.</strong> Conveyancing services are provided by the regulated conveyancer you choose, under a separate contract directly between you and that conveyancer, and you pay their fees directly to them. PropXchain is not a party to that contract, does not set those fees, and receives no referral fee, commission or markup on your conveyancer's charges.
              </p>
              <p className="mb-4">
                <strong>Refunds and cancellation.</strong> You may have the right to cancel certain orders within 14 days under the Consumer Contracts Regulations 2013. Where you ask us to begin arranging a search or other service straight away, you acknowledge that once that service has been supplied (for example once a search has been commissioned from the provider) you lose the right to cancel it, and the fee is non-refundable to the extent the service has been performed. Official third-party fees already incurred on your behalf are non-refundable. Except as set out here or as required by law, fees are non-refundable.
              </p>
              <p>
                <strong>Payments.</strong> Payments are processed by our third-party payment provider (Stripe). PropXchain does not store your full card details. Paying through the Platform is also subject to the payment provider's terms.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mb-4">6. Intellectual Property</h2>
              <p className="mb-4">
                The Platform, including all content, features, and functionality, is owned by PropXchain and is protected by UK and international copyright, trademark, and other intellectual property laws.
              </p>
              <p>
                You may not reproduce, distribute, modify, or create derivative works of any part of the Platform without our express written permission.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mb-4">7. Disclaimers and Limitations</h2>
              <h3 className="text-xl font-semibold text-black mb-2">7.1 No Warranty</h3>
              <p className="mb-4">
                THE PLATFORM IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. WE DO NOT WARRANT THAT THE PLATFORM WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE.
              </p>

              <h3 className="text-xl font-semibold text-black mb-2">7.2 Limitation of Liability</h3>
              <p>
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, PROPXCHAIN SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF THE PLATFORM.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mb-4">8. Indemnification</h2>
              <p>
                You agree to indemnify and hold PropXchain harmless from any claims, damages, losses, liabilities, and expenses (including legal fees) arising from:
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Your use of the Platform</li>
                <li>Your violation of these Terms</li>
                <li>Your violation of any rights of another party</li>
                <li>Any property transaction you conduct</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mb-4">9. Termination</h2>
              <p className="mb-4">
                We reserve the right to suspend or terminate your access to the Platform at any time, with or without notice, for any reason, including violation of these Terms.
              </p>
              <p>
                Upon termination, your right to use the Platform will immediately cease. Blockchain records of your transactions will remain on the distributed ledger.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mb-4">10. Governing Law</h2>
              <p className="mb-4">
                These Terms shall be governed by and construed in accordance with the laws of England and Wales, without regard to conflict of law principles.
              </p>
              <p>
                Any disputes arising from these Terms or use of the Platform shall be subject to the exclusive jurisdiction of the courts of England and Wales.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mb-4">11. Changes to Terms</h2>
              <p className="mb-4">
                We reserve the right to modify these Terms at any time. We will notify users of material changes via email or through the Platform. Your continued use of the Platform after such modifications constitutes acceptance of the updated Terms.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mb-4">12. Contact Information</h2>
              <p className="mb-2">
                If you have questions about these Terms, please contact us:
              </p>
              <ul className="space-y-2 mt-4">
                <li><strong>Email (legal):</strong> legal@propxchain.com</li>
                <li><strong>Email (general):</strong> info@propxchain.com</li>
                <li><strong>Operator:</strong> PropXchain Ltd</li>
                <li><strong>Companies House registration:</strong> 17018978</li>
                <li><strong>VAT registration number:</strong> GB 524 6852 77</li>
                <li><strong>Registered jurisdiction:</strong> England and Wales</li>
              </ul>
            </section>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="legal-footer">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col md:flex-row md:justify-between gap-4">
          <div>
            <a href="/" className="legal-logo" style={{ fontSize: '1.1rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }} onClick={(e) => { e.preventDefault(); navigate('/'); }}>
              <Logo variant="mark" tone="onLight" to={null} className="h-10 w-auto" />
              </a>
            <p className="legal-footer-text" style={{marginTop: '0.4rem'}}>&copy; 2026 PropXchain Ltd · Company No. 17018978 · VAT GB 524 6852 77 · Registered in England &amp; Wales</p>
          </div>
          <div className="flex gap-5 items-center">
            <a href="/privacy" onClick={(e) => { e.preventDefault(); navigate('/privacy'); }}>Privacy</a>
            <a href="/terms" onClick={(e) => { e.preventDefault(); navigate('/terms'); }}>Terms</a>
            <a href="mailto:info@propxchain.com">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default TermsOfServicePage;
