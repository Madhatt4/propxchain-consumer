import React from 'react';
import { useNavigate } from 'react-router-dom';

import { Logo } from '@/components/brand/Logo';

const PrivacyPolicyPage: React.FC = () => {
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
          <h1 className="legal-title">Privacy Policy</h1>
          <p className="legal-meta">Effective date · 1 May 2026</p>
          <p className="legal-subtle">Data controller: PropXchain Ltd, a company registered in England and Wales (Company No. 17018978).</p>

          <div className="legal-banner">
            <p>
              <strong>Pre-launch notice.</strong> The Platform is currently a waitlist sign-up only. The personal data we process today is limited to waitlist information (name, email, role) and standard website analytics. Sections of this Policy relating to live property transactions, identity verification, and on-chain document storage describe how we will process data once those features launch and will be re-issued for your review at that time.
            </p>
          </div>

          <div className="legal-content space-y-8">
            <section>
              <h2 className="text-2xl font-bold text-black mb-4">1. Who we are</h2>
              <p className="mb-4">
                PropXchain Ltd ("PropXchain", "we", "our", "us"), a company registered in England and Wales with company number 17018978, is the data controller for personal data processed through this website and the PropXchain platform (together, "the Platform"). We are committed to protecting your privacy and handling your personal data in accordance with the UK General Data Protection Regulation (UK GDPR) and the Data Protection Act 2018.
              </p>
              <p>
                This policy applies to all users of PropXchain and covers information collected through our website, application, and related services. For data protection questions or to exercise your rights, contact us at <strong>privacy@propxchain.com</strong>.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mb-4">2. Information We Collect</h2>

              <h3 className="text-xl font-semibold text-black mb-2">2.1 Information You Provide</h3>
              <p className="mb-2">We collect information that you voluntarily provide when using our Platform:</p>
              <ul className="list-disc pl-6 space-y-2 mb-4">
                <li><strong>Account Information:</strong> Name, email address, user type (buyer/seller/solicitor)</li>
                <li><strong>Identity Verification:</strong> Documents for KYC/AML compliance (ID, proof of address)</li>
                <li><strong>Property Information:</strong> Property details, addresses, transaction data</li>
                <li><strong>Financial Information:</strong> Proof of funds, deposit amounts (we do not store payment card details)</li>
                <li><strong>Documents:</strong> Contracts, title deeds, certificates, and other conveyancing documents</li>
                <li><strong>Communications:</strong> Messages, support requests, and correspondence</li>
              </ul>

              <h3 className="text-xl font-semibold text-black mb-2">2.2 Information Collected Automatically</h3>
              <p className="mb-2">When you access the Platform, we automatically collect:</p>
              <ul className="list-disc pl-6 space-y-2 mb-4">
                <li><strong>Usage Data:</strong> Pages visited, features used, time spent on Platform</li>
                <li><strong>Device Information:</strong> Browser type, operating system, IP address</li>
                <li><strong>Blockchain Data:</strong> Transaction hashes, timestamps, wallet addresses</li>
                <li><strong>Cookies:</strong> Session data and user preferences</li>
              </ul>

              <h3 className="text-xl font-semibold text-black mb-2">2.3 Information from Third Parties</h3>
              <p className="mb-2">We may receive information from:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Internet Identity authentication service</li>
                <li>Identity verification providers</li>
                <li>Land Registry (for property verification)</li>
                <li>Other parties involved in your transaction</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mb-4">3. How We Use Your Information</h2>
              <p className="mb-2">We use collected information for the following purposes:</p>

              <h3 className="text-xl font-semibold text-black mb-2 mt-4">3.1 Platform Operation</h3>
              <ul className="list-disc pl-6 space-y-2 mb-4">
                <li>Provide, operate, and maintain the Platform</li>
                <li>Process property transactions</li>
                <li>Authenticate users via Internet Identity</li>
                <li>Store and verify documents on blockchain</li>
                <li>Generate smart contracts and transaction records</li>
              </ul>

              <h3 className="text-xl font-semibold text-black mb-2">3.2 Legal Compliance</h3>
              <ul className="list-disc pl-6 space-y-2 mb-4">
                <li>Verify identity for KYC/AML requirements</li>
                <li>Comply with UK property law and regulations</li>
                <li>Prevent fraud and money laundering</li>
                <li>Respond to legal requests and enforce our Terms</li>
              </ul>

              <h3 className="text-xl font-semibold text-black mb-2">3.3 Communication</h3>
              <ul className="list-disc pl-6 space-y-2 mb-4">
                <li>Send transaction updates and notifications</li>
                <li>Provide customer support</li>
                <li>Send administrative information and updates</li>
                <li>Respond to inquiries and requests</li>
              </ul>

              <h3 className="text-xl font-semibold text-black mb-2">3.4 Improvement and Analytics</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>Analyse Platform usage and performance</li>
                <li>Improve features and user experience</li>
                <li>Develop new services</li>
                <li>Conduct research and analytics</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mb-4">4. Blockchain and Data Storage</h2>

              <h3 className="text-xl font-semibold text-black mb-2">4.1 Internet Computer Blockchain</h3>
              <p className="mb-4">
                PropXchain is built on the Internet Computer Protocol (ICP). Certain transaction data is permanently recorded on the blockchain, including:
              </p>
              <ul className="list-disc pl-6 space-y-2 mb-4">
                <li>Transaction milestones and timestamps</li>
                <li>Document hashes (not the documents themselves)</li>
                <li>Smart contract data</li>
                <li>Completion records</li>
              </ul>
              <p className="mb-4">
                <strong>Important:</strong> Blockchain records are immutable and cannot be deleted. However, personal data is encrypted and pseudonymized.
              </p>

              <h3 className="text-xl font-semibold text-black mb-2">4.2 Document Encryption</h3>
              <p>
                All uploaded documents are encrypted using industry-standard encryption (AES-256) before storage. Only authorized transaction participants can decrypt and access documents.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mb-4">5. How We Share Your Information</h2>
              <p className="mb-2">We share your information only in the following circumstances:</p>

              <h3 className="text-xl font-semibold text-black mb-2 mt-4">5.1 Transaction Participants</h3>
              <p className="mb-4">
                Information is shared with other parties involved in your property transaction (buyers, sellers, solicitors) as necessary to complete the conveyancing process.
              </p>

              <h3 className="text-xl font-semibold text-black mb-2">5.2 Service Providers</h3>
              <p className="mb-4">
                We work with third-party service providers for:
              </p>
              <ul className="list-disc pl-6 space-y-2 mb-4">
                <li>Identity verification (KYC/AML)</li>
                <li>Cloud hosting and storage</li>
                <li>Analytics and monitoring</li>
                <li>Customer support</li>
              </ul>

              <h3 className="text-xl font-semibold text-black mb-2">5.3 Legal Requirements</h3>
              <p className="mb-2">We may disclose information when required by law or to:</p>
              <ul className="list-disc pl-6 space-y-2 mb-4">
                <li>Comply with legal obligations</li>
                <li>Respond to court orders or government requests</li>
                <li>Protect our rights and property</li>
                <li>Prevent fraud or illegal activity</li>
              </ul>

              <h3 className="text-xl font-semibold text-black mb-2">5.4 Business Transfers</h3>
              <p>
                If PropXchain is involved in a merger, acquisition, or sale of assets, your information may be transferred as part of that transaction.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mb-4">6. Data Retention</h2>
              <p className="mb-4">
                We retain your information for as long as necessary to:
              </p>
              <ul className="list-disc pl-6 space-y-2 mb-4">
                <li>Provide our services</li>
                <li>Comply with legal obligations (minimum 6 years for property records)</li>
                <li>Resolve disputes and enforce agreements</li>
                <li>Maintain blockchain records (permanent)</li>
              </ul>
              <p>
                You may request deletion of your account, but blockchain records cannot be removed due to the immutable nature of distributed ledgers.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mb-4">7. Your Rights (UK GDPR)</h2>
              <p className="mb-2">Under UK data protection law, you have the following rights:</p>

              <ul className="list-disc pl-6 space-y-2 mb-4">
                <li><strong>Right to Access:</strong> Request a copy of your personal data</li>
                <li><strong>Right to Rectification:</strong> Correct inaccurate or incomplete data</li>
                <li><strong>Right to Erasure:</strong> Request deletion of your data (subject to legal retention requirements)</li>
                <li><strong>Right to Restrict Processing:</strong> Limit how we use your data</li>
                <li><strong>Right to Data Portability:</strong> Receive your data in a structured format</li>
                <li><strong>Right to Object:</strong> Object to processing of your data</li>
                <li><strong>Right to Withdraw Consent:</strong> Withdraw consent for data processing</li>
              </ul>

              <p className="mt-4">
                To exercise these rights, contact us at: <strong>privacy@propxchain.com</strong>
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mb-4">8. Security</h2>
              <p className="mb-4">
                We implement industry-standard security measures to protect your information:
              </p>
              <ul className="list-disc pl-6 space-y-2 mb-4">
                <li>End-to-end encryption for documents</li>
                <li>Internet Identity for passwordless authentication</li>
                <li>Secure blockchain storage on Internet Computer</li>
                <li>Regular security audits and monitoring</li>
                <li>Access controls and authentication</li>
              </ul>
              <p>
                However, no method of transmission over the internet is 100% secure. We cannot guarantee absolute security.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mb-4">9. Cookies and Tracking</h2>
              <p className="mb-4">
                We use cookies and similar technologies to:
              </p>
              <ul className="list-disc pl-6 space-y-2 mb-4">
                <li>Maintain your session</li>
                <li>Remember your preferences</li>
                <li>Analyse Platform usage</li>
                <li>Improve user experience</li>
              </ul>
              <p>
                You can control cookies through your browser settings. Disabling cookies may affect Platform functionality.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mb-4">10. International Data Transfers</h2>
              <p>
                Your data may be processed in countries outside the UK. We ensure appropriate safeguards are in place to protect your information in accordance with UK GDPR requirements.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mb-4">11. Children's Privacy</h2>
              <p>
                PropXchain is not intended for individuals under 18 years of age. We do not knowingly collect information from children. If you believe we have collected information from a child, please contact us immediately.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mb-4">12. Changes to This Policy</h2>
              <p>
                We may update this Privacy Policy from time to time. We will notify you of material changes via email or through the Platform. Your continued use after such changes constitutes acceptance.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mb-4">13. Contact Us</h2>
              <p className="mb-4">
                For questions about this Privacy Policy or to exercise your data rights:
              </p>
              <ul className="space-y-2">
                <li><strong>Email (data protection):</strong> privacy@propxchain.com</li>
                <li><strong>Email (general):</strong> info@propxchain.com</li>
                <li><strong>Data controller:</strong> PropXchain Ltd</li>
                <li><strong>Companies House registration:</strong> 17018978</li>
                <li><strong>Registered jurisdiction:</strong> England and Wales</li>
              </ul>
              <p className="mt-4">
                You also have the right to lodge a complaint with the UK Information Commissioner's Office (ICO) about how we handle your personal data. The ICO's contact details are at <a href="https://ico.org.uk/make-a-complaint/" target="_blank" rel="noopener noreferrer" className="text-black underline">ico.org.uk/make-a-complaint</a>, by phone on 0303 123 1113, or by post to Information Commissioner's Office, Wycliffe House, Water Lane, Wilmslow, Cheshire SK9 5AF.
              </p>
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

export default PrivacyPolicyPage;
