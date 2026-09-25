/**
 * Postbuild prerender for static marketing routes.
 *
 * Clones dist/index.html (keeping Vite's hashed asset paths intact) and
 * swaps the title, meta description, OG/Twitter tags, canonical, and the
 * <main id="seo-fallback"> body for each route. Output: dist/{route}/index.html.
 *
 * Humans with JS are served the SPA at the real path /route by BrowserRouter; the pre-React
 * script in index.html. Bots without JS read the route-specific content.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FAQ_GROUPS, buildFaqJsonLd } from '../src/pages/marketing/faqData.mjs';

import { resourcePages } from './prerender-resources.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, '..', 'dist');
const template = readFileSync(join(DIST, 'index.html'), 'utf8');

const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// /faq body is generated from the same data module the React page
// renders, so the prerendered Q&As, the SPA accordion, and the FAQPage
// JSON-LD can never drift apart.
const faqMain = `<main id="seo-fallback" role="main" aria-label="PropXchain frequently asked questions — summary">
<p class="muted">Loading PropXchain…</p>
<h1>PropXchain — frequently asked questions</h1>
<p>Selling, buying and completing on PropXchain — what it costs, who does the legal work, and what actually gets recorded.</p>
${FAQ_GROUPS.map(
  (group) => `
<section aria-labelledby="${group.id}">
  <h2 id="${group.id}">${escapeHtml(group.title)}</h2>
${group.items.map((item) => `  <h3>${escapeHtml(item.q)}</h3>\n  <p>${escapeHtml(item.a)}</p>`).join('\n')}
</section>`,
).join('\n')}

<p>Still have questions? <a href="/support">Talk to us</a> or <a href="/register">create a free account</a>.</p>
</main>`;

const pages = [
  {
    route: 'how-it-works',
    title: 'How PropXchain Works — Six-Step Conveyancing Guide',
    description: 'From account creation to completion in six steps: Internet Identity sign-up, property wizard, document upload, multi-party collaboration, digital exchange, and completion — every step recorded to a tamper-evident ledger.',
    main: `<main id="seo-fallback" role="main" aria-label="How PropXchain works — summary">
<p class="muted">Loading PropXchain…</p>
<h1>How PropXchain works for you</h1>
<p>From account creation to completion in six simple steps. Every step stays on a shared, verifiable record.</p>

<section aria-labelledby="steps">
  <h2 id="steps">The six steps</h2>
  <h3>1. Create your account</h3>
  <p>Sign up using Internet Identity — passwordless, no passwords, no personal data stored centrally. Your identity is created instantly and you're straight into the dashboard.</p>

  <h3>2. Start your transaction</h3>
  <p>Launch the Property Wizard. Oscar, our AI assistant, guides you through the 6-phase process. Select your property type, enter the address and details, and Oscar adapts the process to your situation.</p>

  <h3>3. Complete the wizard</h3>
  <p>Work through each phase with Oscar's help — property details, TA6 form, legal compliance checks, financial terms, contract generation. Save progress and return anytime.</p>

  <h3>4. Upload documents</h3>
  <p>Upload proof of ID, address and funds. Oscar reviews for issues instantly. Every upload is timestamped to a verifiable record.</p>

  <h3>5. Collaborate with all parties</h3>
  <p>Oscar coordinates between buyers, sellers and solicitors automatically. Invite all stakeholders with one click. Real-time updates for everyone. No more chasing for responses.</p>

  <h3>6. Exchange and complete</h3>
  <p>All parties sign digitally with qualified electronic signatures. The contract is recorded to a tamper-evident ledger.</p>
</section>

<section aria-labelledby="why">
  <h2 id="why">Why this works</h2>
  <ul>
    <li><strong>Fewer blind spots</strong> than traditional conveyancing.</li>
    <li><strong>24/7 AI support</strong> — Oscar never sleeps.</li>
    <li><strong>Zero missed communications</strong> — everything tracked.</li>
    <li><strong>Every step on a verifiable record</strong> — independently checkable.</li>
  </ul>
</section>

<p>Ready to get started? <a href="/register">Create your free account</a>.</p>
</main>`,
  },
  {
    route: 'features',
    title: 'PropXchain Features — the shared transaction platform',
    description: 'Everything you need for modern UK conveyancing: Oscar AI assistant, Internet Identity auth, a verifiable transaction record, document checks, guided form completion, and multi-party collaboration.',
    main: `<main id="seo-fallback" role="main" aria-label="PropXchain features — summary">
<p class="muted">Loading PropXchain…</p>
<h1>Everything you need for modern conveyancing</h1>
<p>PropXchain puts Oscar AI, your HM Land Registry title and every party's view of the transaction in one place — so the process runs on a shared record instead of a chain of emails.</p>

<section aria-labelledby="features">
  <h2 id="features">Platform features</h2>

  <h3>Oscar AI assistant</h3>
  <p>Your intelligent conveyancing companion that understands context and guides you through every step. 24/7 instant answers, proactive issue detection, automated document analysis, smart recommendations.</p>

  <h3>Smart communication</h3>
  <p>Oscar coordinates between all parties, ensuring nothing falls through the cracks. Unified communication hub, automatic stakeholder updates, real-time notifications — no more email chains.</p>

  <h3>Verifiable record</h3>
  <p>Every transaction milestone is written as a tamper-evident entry anyone can check independently. Documents stay with you; only a cryptographic fingerprint is recorded, so the audit trail is trustworthy without exposing your data.</p>

  <h3>Internet Identity authentication</h3>
  <p>Sign in with Internet Identity — a passwordless, biometric or hardware-key login with no shared secrets to leak. Your access is isolated to your device; the platform never holds a copy of your credentials.</p>

  <h3>Document verification</h3>
  <p>Secure document uploads with cryptographic proof and timestamp verification. Encrypted storage, automatic checks, version control and a full audit trail.</p>

  <h3>Guided transaction wizard</h3>
  <p>A step-by-step wizard covering each phase of the transaction — TA6 and TA10 form completion, document checks, and shared review — so nothing is missed and every party sees the same status.</p>

  <h3>Multi-party collaboration</h3>
  <p>Connect buyers, sellers and solicitors in a transparent chain view. Real-time collaboration tools, role-based permissions, shared document access, full transaction-chain visibility.</p>

  <h3>Legal compliance</h3>
  <p>Built-in compliance for the Building Safety Act 2022, listed buildings, leasehold reforms and more. Automatic regulatory checks at every step.</p>
</section>

<p>Ready to experience these features? <a href="/register">Get started for free</a>.</p>
</main>`,
  },
  {
    route: 'pricing',
    title: 'PropXchain Pricing — Free to Start, £75 AI Co-pilot Optional',
    description: 'Start your UK property sale free — no platform fee. Pick your own providers and see every price before you commit. Add the optional £75 AI co-pilot to read your title and searches in plain English and tailor your conveyancer quote.',
    main: `<main id="seo-fallback" role="main" aria-label="PropXchain pricing — summary">
<p class="muted">Loading PropXchain…</p>
<h1>Start free. Add AI when you want it.</h1>
<p>Pick your own providers and see every price up front. Upgrade to the £75 AI co-pilot whenever you like.</p>

<section aria-labelledby="starter-tier">
  <h2 id="starter-tier">Starter — free, no platform fee</h2>
  <p>Self-serve, pay-as-you-go. Everything you need to run your own transaction:</p>
  <ul>
    <li>On-chain transaction record and audit trail</li>
    <li>HM Land Registry title pull</li>
    <li>TA6 + TA10 digital forms</li>
    <li>Document vault and verification</li>
    <li>Buyer invite and progress tracker</li>
    <li>Conveyancer panel access</li>
  </ul>
</section>

<section aria-labelledby="premium-tier">
  <h2 id="premium-tier">Premium — £75 per transaction</h2>
  <p>Everything in Starter, plus an AI co-pilot for the whole transaction:</p>
  <ul>
    <li>AI reads your HMLR title — issues flagged, summarised in plain English</li>
    <li>AI reads your search results — the material issues pulled out for you</li>
    <li>A complexity-aware conveyancer quote request — often a tighter price</li>
    <li>AI next-step cards guide you through every stage</li>
    <li>Priority support</li>
  </ul>
</section>

<section aria-labelledby="other-costs">
  <h2 id="other-costs">Other costs (full transparency)</h2>
  <p>Conveyancers estimate you directly and PropXchain never marks that up. Searches are bought through PropXchain at the price shown.</p>
  <ul>
    <li><strong>Property searches: £50–£450</strong> — you pick the provider and pay the price shown.</li>
    <li><strong>Conveyancer (reserved legal acts):</strong> quoted directly per transaction — compare and choose from the panel.</li>
    <li><strong>Stamp duty:</strong> calculated by HMRC, varies by property price.</li>
  </ul>
  <p>You control all payments. No hidden fees.</p>
</section>

<section aria-labelledby="faq">
  <h2 id="faq">Frequently asked questions</h2>

  <h3>Is it really free to start?</h3>
  <p>Yes. Starter has no platform fee. You run your own transaction, pick your own providers, and see every price before you commit.</p>

  <h3>What does the £75 Premium tier add?</h3>
  <p>An AI co-pilot for the whole transaction. It reads your HM Land Registry title and search results in plain English, flags the issues that matter, and turns the real complexity of your transaction into a tailored conveyancer quote request.</p>

  <h3>What about solicitor or conveyancer fees?</h3>
  <p>The conveyancer quotes you directly per transaction. PropXchain never marks up their fee. You compare and choose from the panel, or invite your own.</p>

  <h3>Are there any hidden fees?</h3>
  <p>No. Starter is free. Premium is £75 per transaction for the AI co-pilot. Everything else — searches, your conveyancer — is priced up front, before you commit.</p>
</section>

<p>Ready to start? Create your free account in two minutes. <a href="/register">Start free</a>.</p>
</main>`,
  },
  {
    route: 'sell-my-house',
    title: 'Sell My House Online — Free to Start, No Estate Agent | PropXchain',
    description: 'Sell your house online free — no platform fee, no estate agent markup. See every price up front, add the optional £75 AI co-pilot, complete in weeks. Start your sale in two minutes.',
    main: `<main id="seo-fallback" role="main" aria-label="Sell my house online with PropXchain — summary">
<p class="muted">Loading PropXchain…</p>
<h1>Sell your house online — free to start</h1>
<p>The simple, fast way to sell your house in the UK. No platform fee. No estate agent. No hidden markup. Complete in weeks, not months.</p>

<section aria-labelledby="why">
  <h2 id="why">Why sell your house with PropXchain</h2>
  <ul>
    <li><strong>Free to start</strong> — no platform fee, no monthly fees, no listing fees. Add the optional £75 AI co-pilot whenever you like.</li>
    <li><strong>Save £2,000+ vs traditional</strong> — a typical UK sale costs £1,500–£2,500 in agent and conveyancing admin fees. PropXchain cuts the admin middleman.</li>
    <li><strong>Weeks, not months</strong> — UK conveyancing averages 20–24 weeks. PropXchain sellers complete in weeks because everyone sees the same live transaction.</li>
    <li><strong>You stay in control</strong> — order your own searches, invite your own buyer, pick your own CLC-verified conveyancer from the panel.</li>
    <li><strong>Blockchain-backed audit trail</strong> — every milestone timestamped on the Internet Computer, verifiable by buyer, lender and regulator.</li>
  </ul>
</section>

<section aria-labelledby="how">
  <h2 id="how">How to sell your house online with PropXchain</h2>
  <ol>
    <li><strong>List your house</strong> — add the address, Oscar AI pulls HM Land Registry title automatically.</li>
    <li><strong>Complete the TA6 and TA10</strong> forms with Oscar's guidance. Save progress, come back anytime.</li>
    <li><strong>Invite your buyer</strong> — or let us match you. The buyer uses PropXchain free.</li>
    <li><strong>Order searches directly</strong> — local authority, drainage, environmental. No solicitor markup.</li>
    <li><strong>Appoint a conveyancer</strong> from the CLC-verified panel — quoted directly, never marked up.</li>
    <li><strong>Exchange and complete</strong> with tmSign qualified electronic signatures and FCA-regulated escrow.</li>
  </ol>
</section>

<section aria-labelledby="faq">
  <h2 id="faq">Sell your house FAQ</h2>
  <h3>How much does it cost to sell my house with PropXchain?</h3>
  <p>Free to start — no platform fee. You pay approximately £50–£450 for searches (bought through PropXchain) and your conveyancer's quoted fee. The optional AI co-pilot is £75 per transaction. No estate agent fee.</p>
  <h3>Do I need an estate agent?</h3>
  <p>No. PropXchain is seller-led — you manage the listing, the buyer communication, and the progress. If you already have a buyer, it's the fastest, cheapest way to complete.</p>
  <h3>How long does it take to sell a house online?</h3>
  <p>With a willing buyer and both sides using PropXchain, completions routinely happen in 4–8 weeks rather than the UK average of 20+.</p>
</section>

<p>Ready to sell your house? <a href="/register">Start your sale free</a>. Need a conveyancer first? <a href="/find-a-conveyancer">Find one here</a>.</p>
</main>`,
  },
  {
    route: 'find-a-conveyancer',
    title: 'Find a Conveyancer Online — Quoted Direct, CLC Verified | PropXchain',
    description: 'Find an online conveyancer for your UK property purchase or sale. CLC-verified firms quote you directly on your actual transaction — no markup, no hidden costs, no endless phone calls.',
    main: `<main id="seo-fallback" role="main" aria-label="Find a conveyancer with PropXchain — summary">
<p class="muted">Loading PropXchain…</p>
<h1>Find a conveyancer — quoted on your actual transaction</h1>
<p>Every conveyancer on PropXchain's panel is CLC-verified, quotes you directly per transaction with no PropXchain markup, and uses the same shared live transaction view so you always know where things stand.</p>

<section aria-labelledby="why">
  <h2 id="why">Why use a PropXchain conveyancer</h2>
  <ul>
    <li><strong>A quote on the real work</strong> — conveyancers quote your actual transaction, not a one-size-fits-all rate padded for unknown risk. No hourly billing, no surprise invoices.</li>
    <li><strong>CLC-verified only</strong> — every firm is checked against the Council for Licensed Conveyancers register before joining the panel.</li>
    <li><strong>Online-first</strong> — everything runs inside PropXchain. No courier dance, no faxed redemption statements, no missed calls.</li>
    <li><strong>Shared live view</strong> — your conveyancer sees the same transaction you see. You both see what the other side's conveyancer sees. No chasing.</li>
    <li><strong>Blockchain audit trail</strong> — every action is timestamped on the Internet Computer. If anything is ever disputed, the record is cryptographically verifiable.</li>
  </ul>
</section>

<section aria-labelledby="how">
  <h2 id="how">How to find and appoint a conveyancer</h2>
  <ol>
    <li><strong>Create a PropXchain account</strong> — free, Internet Identity, no password.</li>
    <li><strong>Start or join a transaction</strong> — whether you're buying or selling.</li>
    <li><strong>Browse the panel and compare quotes</strong> — filter by region, response time, and specialisation.</li>
    <li><strong>Appoint in one click</strong> — the conveyancer gets the shared workspace and pulls your documents automatically.</li>
    <li><strong>Pay your conveyancer direct</strong> — at the price they quoted. PropXchain never takes a cut.</li>
  </ol>
</section>

<section aria-labelledby="vs">
  <h2 id="vs">PropXchain conveyancer vs traditional high-street</h2>
  <h3>Traditional high-street conveyancer</h3>
  <p>£600–£1,500 for a standard sale or purchase. Hourly billing on top. Paper-based workflow. You chase for updates by phone. Response time measured in days.</p>
  <h3>PropXchain panel conveyancer</h3>
  <p>A direct quote on your actual transaction, with the routine work already handled inside the platform. Real-time status, in-app messaging, a verifiable audit. Response time measured in hours.</p>
</section>

<section aria-labelledby="faq">
  <h2 id="faq">Find a conveyancer FAQ</h2>
  <h3>Is an online conveyancer as good as a high-street one?</h3>
  <p>Yes — the legal work is identical, and CLC verification is the same regulator that licenses high-street firms. Online firms are often faster because they don't duplicate work that the platform already handles.</p>
  <h3>Can I use my own conveyancer instead of the panel?</h3>
  <p>You can invite your existing solicitor to the transaction. They'll see the same shared view. Panel quotes apply only if you choose from the panel.</p>
  <h3>What does the conveyancer's quote cover?</h3>
  <p>The three reserved legal acts that only a licensed conveyancer can perform: exchange of contracts, transfer of title, and completion. Everything else — searches, forms, document handling — is managed by you inside PropXchain, which is why quotes are often tighter than high-street rates.</p>
</section>

<p>Ready to find a conveyancer? <a href="/register">Create a free account</a>. Selling a house? <a href="/sell-my-house">Start here</a>.</p>
</main>`,
  },
  {
    route: 'about',
    title: 'About PropXchain — the live property transaction platform',
    description: 'PropXchain is the online platform for buying and selling homes in England and Wales — every step of the transaction in one live view, with a verifiable record of each milestone. Built by PropXchain Ltd, Sandy, Bedfordshire.',
    main: `<main id="seo-fallback" role="main" aria-label="About PropXchain — summary">
<p class="muted">Loading PropXchain…</p>
<h1>A clearer way to move home</h1>
<p>PropXchain puts buyers, sellers, conveyancers and estate agents on the same live transaction — so nothing hides in email chains and every milestone is recorded as it happens.</p>

<section aria-labelledby="mission">
  <h2 id="mission">Making property transactions effortless</h2>
  <p>The UK property transaction process has remained largely unchanged for decades. We believe this is unacceptable in the digital age.</p>
  <p>PropXchain's mission is to make moving home clearer and less fragile — by giving everyone the same view of the transaction and an Oscar AI assistant that explains each step in plain English:</p>
  <ul>
    <li><strong>One view:</strong> every party works from the same live transaction.</li>
    <li><strong>Plain English:</strong> Oscar explains each step and what it means for you.</li>
    <li><strong>Transparency:</strong> a verifiable record of each milestone, not a black box.</li>
    <li><strong>Privacy:</strong> your documents stay with you; only a fingerprint is recorded.</li>
    <li><strong>Independence:</strong> we coordinate the professionals — we don't replace them.</li>
    <li><strong>Accessibility:</strong> built to be usable by everyone in the chain.</li>
  </ul>
</section>

<section aria-labelledby="icp">
  <h2 id="icp">How the record works</h2>
  <p>Each transaction milestone is written as a tamper-evident entry that anyone can verify independently. Documents stay with you; only a cryptographic fingerprint is recorded, so the audit trail is trustworthy without exposing your data.</p>
  <h3>Verifiable</h3>
  <p>Every step carries its own proof of when it happened and by whom — checkable without asking us.</p>
  <h3>Private by design</h3>
  <p>Personal data stays off the public record; only hashes are written, in line with GDPR.</p>
  <h3>Resilient</h3>
  <p>The platform runs on infrastructure built to stay available, with no single point of failure in the service.</p>
</section>

<section aria-labelledby="problem">
  <h2 id="problem">The problem</h2>
  <ul>
    <li>Average 150+ days to complete a transaction</li>
    <li>High costs per transaction</li>
    <li>Manual, paper-based processes</li>
    <li>Lack of transparency between parties</li>
    <li>High risk of transaction fall-through</li>
    <li>Complex legal compliance requirements</li>
  </ul>
  <h2 id="solution">Our solution</h2>
  <ul>
    <li>One live transaction, visible to every party, with Oscar AI explaining each step</li>
    <li>You keep control of your providers and their published rates — no hidden platform markup</li>
    <li>A shared, verifiable record of every milestone</li>
    <li>Complete transparency with real-time updates</li>
    <li>Fewer surprises, because everyone sees the same status</li>
    <li>Coordinated with your conveyancer, who remains responsible for the legal work</li>
  </ul>
</section>

<section aria-labelledby="who">
  <h2 id="who">Who we serve</h2>
  <h3>Buyers and sellers</h3>
  <p>Streamlined process, complete transparency, and significant cost savings.</p>
  <h3>Solicitors</h3>
  <p>Efficient workflow, automated compliance and enhanced client service.</p>
  <h3>Estate agents</h3>
  <p>Faster completions, reduced fall-throughs, happier clients.</p>
</section>

<p>PropXchain Ltd is registered in England and Wales (Companies House 17018978), based in Sandy, Bedfordshire. <a href="/register">Start your transaction</a>.</p>
</main>`,
  },
  {
    route: 'faq',
    title: 'PropXchain FAQ — Pricing, Conveyancers, Security & What Gets Recorded',
    description: 'Answers to the most common PropXchain questions: free Starter tier, the optional £75 AI co-pilot, search costs, CLC-verified conveyancers, e-signing, AML checks, and what actually gets recorded.',
    jsonLd: buildFaqJsonLd(),
    main: faqMain,
  },
  ...resourcePages,
];

let written = 0;
for (const page of pages) {
  let html = template;

  // Swap <title>
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${page.title}</title>`);
  // Swap meta description
  html = html.replace(/<meta name="description" content="[^"]*"/, `<meta name="description" content="${page.description}"`);
  // Swap OG + Twitter title + description + url
  html = html.replace(/<meta property="og:title" content="[^"]*"/, `<meta property="og:title" content="${page.title}"`);
  html = html.replace(/<meta property="og:description" content="[^"]*"/, `<meta property="og:description" content="${page.description}"`);
  html = html.replace(/<meta property="og:url" content="[^"]*"/, `<meta property="og:url" content="https://propxchain.com/${page.route}"`);
  html = html.replace(/<meta name="twitter:title" content="[^"]*"/, `<meta name="twitter:title" content="${page.title}"`);
  html = html.replace(/<meta name="twitter:description" content="[^"]*"/, `<meta name="twitter:description" content="${page.description}"`);
  html = html.replace(/<meta name="twitter:url" content="[^"]*"/, `<meta name="twitter:url" content="https://propxchain.com/${page.route}"`);
  // Swap canonical
  html = html.replace(/<link rel="canonical" href="[^"]*"/, `<link rel="canonical" href="https://propxchain.com/${page.route}"`);

  // Inject optional route-specific structured data (e.g. FAQPage) into the head
  if (page.jsonLd) {
    if (page.jsonLd['@type'] === 'FAQPage') {
      // Google allows one FAQPage block per page — drop the template's site-wide one
      html = html.replace(
        /<script type="application\/ld\+json">(?:(?!<\/script>)[\s\S])*?"@type"\s*:\s*"FAQPage"[\s\S]*?<\/script>\s*/,
        '',
      );
    }
    const json = JSON.stringify(page.jsonLd).replace(/</g, '\\u003C');
    html = html.replace('</head>', `<script type="application/ld+json">${json}</script>\n  </head>`);
  }

  // Swap the static fallback <main>
  const mainRegex = /<main id="seo-fallback"[\s\S]*?<\/main>/;
  if (!mainRegex.test(html)) {
    throw new Error(`Prerender template missing <main id="seo-fallback"> — cannot substitute for /${page.route}`);
  }
  html = html.replace(mainRegex, page.main);

  const outDir = join(DIST, page.route);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'index.html'), html);
  written++;
  console.log(`  ✓ dist/${page.route}/index.html  (${html.length} bytes)`);
}
console.log(`Prerendered ${written} marketing routes.`);
