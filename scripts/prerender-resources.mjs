/**
 * Prerender entries for the /resources section.
 *
 * Imported by prerender-marketing.mjs and spread into its `pages`
 * array. Kept separate so the guides content (long-form) doesn't
 * bloat the main script and so concurrent edits merge cleanly.
 *
 * Article JSON-LD is embedded inside each <main> block — body
 * placement is valid for structured data and avoids touching the
 * prerender loop. SPA twins live in src/pages/resources/ (keep facts
 * in sync).
 */

const SITE = 'https://propxchain.com';
const ORG = { '@type': 'Organization', name: 'PropXchain Ltd', url: SITE };

function articleJsonLd({ route, title, description, published, modified }) {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    inLanguage: 'en-GB',
    datePublished: published,
    dateModified: modified,
    author: ORG,
    publisher: ORG,
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE}/${route}` },
  });
}

// BreadcrumbList helps Google render a breadcrumb trail in the SERP and clarifies
// the Home > Resources > {category} > {page} hierarchy for the deep /resources/* URLs.
function breadcrumbJsonLd(crumbs) {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: `${SITE}${c.path}`,
    })),
  });
}

function appendToMain(main, ...jsonStrings) {
  const scripts = jsonStrings
    .map((j) => `<script type="application/ld+json">${j}</script>`)
    .join('\n');
  return main.replace('</main>', `${scripts}\n</main>`);
}

// Wrap a single guide: Article + BreadcrumbList (Home > Guides > {crumb}), both
// embedded in the <main> body — valid placement that avoids touching the
// prerender loop. `crumb` is the short breadcrumb leaf name (matches the H1).
function withJsonLd(page) {
  const crumbs = [
    { name: 'Home', path: '/' },
    { name: 'Help & Support', path: '/resources' },
    { name: page.catName, path: `/resources/${page.category}` },
    { name: page.crumb, path: `/${page.route}` },
  ];
  return {
    ...page,
    main: appendToMain(page.main, articleJsonLd(page), breadcrumbJsonLd(crumbs)),
  };
}

export const resourcePages = [
  {
    route: 'resources',
    title: 'Help & Support — Plain-English Home Moving Guides · PropXchain',
    description: 'Plain-English guides to selling and buying a home in England and Wales, organised by where you are in the transaction: selling, buying, searches, and where the industry is heading. No jargon, no sales pitch.',
    main: `<main id="seo-fallback" role="main" aria-label="PropXchain Help &amp; Support — hub">
<p class="muted">Loading PropXchain…</p>
<h1>Help &amp; Support</h1>
<p>You sell a house a handful of times in a lifetime; the industry does it every day and rarely stops to explain itself. These guides cover the parts of an England &amp; Wales transaction people most often ask about, organised by where you are in the transaction — without the jargon and without the sales pitch.</p>

  <h2><a href="/resources/getting-started">Getting Started</a></h2>
  <p>Registering and signing in, whichever kind of account you need.</p>
  <h3><a href="/resources/getting-started/how-to-sign-in">How to sign in, by account type</a></h3>
  <p>Sellers, buyers, conveyancers, developers and estate agents each register through a different door. What each one asks for, and the three ways to sign back in once you have an account.</p>

  <h2><a href="/resources/selling">Selling</a></h2>
  <p>The seller-side journey, from listing to completion.</p>
  <h3><a href="/resources/selling/what-is-a-property-pack">What is a sales pack?</a></h3>
  <p>Title register, searches, TA6, EPC: the documents every buyer eventually needs, gathered before you list rather than after you accept an offer. The government calls it a sales pack — you may know it as a property pack. Why upfront information sells houses faster, and what actually goes in one.</p>
  <h3><a href="/resources/selling/property-information-forms-explained">TA6, TA10 and TA7 explained</a></h3>
  <p>The three forms every seller fills in, what each one asks, why your answers are legally binding representations rather than opinions, and the questions people most often get wrong.</p>

  <h2><a href="/resources/buying">Buying</a></h2>
  <p>The buyer-side journey, from agreement in principle to keys.</p>
  <h3><a href="/resources/buying/how-long-does-conveyancing-take">How long does conveyancing take?</a></h3>
  <p>A realistic stage-by-stage timeline for England and Wales, the delays that genuinely cost weeks (searches, chains, enquiry ping-pong), and what sellers and buyers can do to shorten the wait.</p>

  <h2><a href="/resources/searches-and-legal">Searches &amp; Legal</a></h2>
  <p>The technical middle of the transaction, where most delay happens.</p>
  <h3><a href="/resources/searches-and-legal/property-searches-explained">Property searches explained</a></h3>
  <p>Local authority, drainage, environmental, coal: the searches a conveyancer orders before you can exchange, what each one actually tells you, why the list changes depending on where the house is, and how long they stay valid.</p>

  <h2><a href="/resources/industry-and-reform">Industry &amp; Reform</a></h2>
  <p>Where home moving is heading: data, reform, and upfront information.</p>
  <h3><a href="/resources/industry-and-reform/baspi-explained">BASPI explained</a></h3>
  <p>The Buyer's and Seller's Property Information form is the industry's blueprint for upfront information. What it covers, how it relates to the TA6 and material information rules, and where home moving is heading.</p>
<p>More sections are coming — probate and inherited property, auction, and the reform agenda. Looking for what it costs instead? See <a href="/pricing">pricing</a>, or <a href="/register">start your transaction free</a>.</p>
</main>`.replace(
      '</main>',
      `<script type="application/ld+json">${breadcrumbJsonLd([{ name: 'Home', path: '/' },
        { name: 'Help & Support', path: '/resources' },])}</script>\n</main>`,
    ),
  },
  {
    route: 'resources/getting-started',
    title: 'Getting Started Guides · PropXchain',
    description: 'Registering and signing in, whichever kind of account you need.',
    main: `<main id="seo-fallback" role="main" aria-label="PropXchain Getting Started guides">
<p class="muted">Loading PropXchain…</p>
<h1>Getting Started</h1>
<p>Registering and signing in, whichever kind of account you need.</p>
  <h2><a href="/resources/getting-started/how-to-sign-in">How to sign in, by account type</a></h2>
  <p>Sellers, buyers, conveyancers, developers and estate agents each register through a different door. What each one asks for, and the three ways to sign back in once you have an account.</p>
</main>`.replace(
      '</main>',
      `<script type="application/ld+json">${breadcrumbJsonLd([{ name: 'Home', path: '/' },
        { name: 'Help & Support', path: '/resources' },
        { name: 'Getting Started', path: '/resources/getting-started' },])}</script>
</main>`,
    ),
  },
  {
    route: 'resources/selling',
    title: 'Selling Guides · PropXchain',
    description: 'The seller-side journey, from listing to completion.',
    main: `<main id="seo-fallback" role="main" aria-label="PropXchain Selling guides">
<p class="muted">Loading PropXchain…</p>
<h1>Selling</h1>
<p>The seller-side journey, from listing to completion.</p>
  <h2><a href="/resources/selling/what-is-a-property-pack">What is a sales pack?</a></h2>
  <p>Title register, searches, TA6, EPC: the documents every buyer eventually needs, gathered before you list rather than after you accept an offer. The government calls it a sales pack — you may know it as a property pack. Why upfront information sells houses faster, and what actually goes in one.</p>
  <h2><a href="/resources/selling/property-information-forms-explained">TA6, TA10 and TA7 explained</a></h2>
  <p>The three forms every seller fills in, what each one asks, why your answers are legally binding representations rather than opinions, and the questions people most often get wrong.</p>
</main>`.replace(
      '</main>',
      `<script type="application/ld+json">${breadcrumbJsonLd([{ name: 'Home', path: '/' },
        { name: 'Help & Support', path: '/resources' },
        { name: 'Selling', path: '/resources/selling' },])}</script>\n</main>`,
    ),
  },
  {
    route: 'resources/buying',
    title: 'Buying Guides · PropXchain',
    description: 'The buyer-side journey, from agreement in principle to keys.',
    main: `<main id="seo-fallback" role="main" aria-label="PropXchain Buying guides">
<p class="muted">Loading PropXchain…</p>
<h1>Buying</h1>
<p>The buyer-side journey, from agreement in principle to keys.</p>
  <h2><a href="/resources/buying/how-long-does-conveyancing-take">How long does conveyancing take?</a></h2>
  <p>A realistic stage-by-stage timeline for England and Wales, the delays that genuinely cost weeks (searches, chains, enquiry ping-pong), and what sellers and buyers can do to shorten the wait.</p>
</main>`.replace(
      '</main>',
      `<script type="application/ld+json">${breadcrumbJsonLd([{ name: 'Home', path: '/' },
        { name: 'Help & Support', path: '/resources' },
        { name: 'Buying', path: '/resources/buying' },])}</script>\n</main>`,
    ),
  },
  {
    route: 'resources/searches-and-legal',
    title: 'Searches & Legal Guides · PropXchain',
    description: 'The technical middle of the transaction, where most delay happens.',
    main: `<main id="seo-fallback" role="main" aria-label="PropXchain Searches &amp; Legal guides">
<p class="muted">Loading PropXchain…</p>
<h1>Searches &amp; Legal</h1>
<p>The technical middle of the transaction, where most delay happens.</p>
  <h2><a href="/resources/searches-and-legal/property-searches-explained">Property searches explained</a></h2>
  <p>Local authority, drainage, environmental, coal: the searches a conveyancer orders before you can exchange, what each one actually tells you, why the list changes depending on where the house is, and how long they stay valid.</p>
</main>`.replace(
      '</main>',
      `<script type="application/ld+json">${breadcrumbJsonLd([{ name: 'Home', path: '/' },
        { name: 'Help & Support', path: '/resources' },
        { name: 'Searches & Legal', path: '/resources/searches-and-legal' },])}</script>\n</main>`,
    ),
  },
  {
    route: 'resources/industry-and-reform',
    title: 'Industry & Reform Guides · PropXchain',
    description: 'Where home moving is heading: data, reform, and upfront information.',
    main: `<main id="seo-fallback" role="main" aria-label="PropXchain Industry &amp; Reform guides">
<p class="muted">Loading PropXchain…</p>
<h1>Industry &amp; Reform</h1>
<p>Where home moving is heading: data, reform, and upfront information.</p>
  <h2><a href="/resources/industry-and-reform/baspi-explained">BASPI explained</a></h2>
  <p>The Buyer's and Seller's Property Information form is the industry's blueprint for upfront information. What it covers, how it relates to the TA6 and material information rules, and where home moving is heading.</p>
</main>`.replace(
      '</main>',
      `<script type="application/ld+json">${breadcrumbJsonLd([{ name: 'Home', path: '/' },
        { name: 'Help & Support', path: '/resources' },
        { name: 'Industry & Reform', path: '/resources/industry-and-reform' },])}</script>\n</main>`,
    ),
  },
  withJsonLd({
    route: 'resources/getting-started/how-to-sign-in',
    category: 'getting-started',
    catName: 'Getting Started',
    published: '2026-09-04',
    modified: '2026-09-04',
    crumb: 'How to sign in, by account type',
    title: 'How to Sign In to PropXchain — Sellers, Buyers, Conveyancers, Developers, Agents · PropXchain',
    description: 'Sellers, buyers, conveyancers, developers and estate agents each register through a different door. What each one asks for, and the three ways to sign back in once you have an account.',
    main: `<main id="seo-fallback" role="main" aria-label="How to sign in, by account type — guide">
<p class="muted">Loading PropXchain…</p>
<h1>How to sign in, by account type</h1>
<p>Sellers, buyers, conveyancers, developers and estate agents each register through a different door on PropXchain. Here is what each one asks for, and the three ways to sign back in once you have an account.</p>

<section aria-labelledby="si-signin">
  <h2 id="si-signin">Signing in, once you have an account</h2>
  <p>The same three methods work for every account type. Go to propxchain.com/login and choose one.</p>
  <ul>
    <li><strong>Continue with Google</strong> or <strong>Continue with Microsoft</strong> — one click, no password to remember. If the address you sign in with already has a PropXchain account, you are signed straight in; nothing new is created.</li>
    <li><strong>Continue with email</strong> — enter the email and password you registered with.</li>
    <li><strong>Continue with Internet Identity</strong> — passkey-based decentralised sign-in, for anyone who registered that way. A separate identity from an email or Google account, not interchangeable with either.</li>
  </ul>
  <p>Forgotten which one you used? Try email first — if that address already has an account, PropXchain tells you rather than creating a duplicate, and "Forgot password" on the sign-in screen resets it.</p>
</section>

<section aria-labelledby="si-register">
  <h2 id="si-register">Registering, by account type</h2>
  <p>Start at propxchain.com/register. Sellers and buyers use that page directly; conveyancers, developers and estate agents each have their own door, linked from it.</p>

  <h3>Property sellers — free</h3>
  <ul>
    <li>Go to propxchain.com/register.</li>
    <li>Choose Continue with Google, Continue with Microsoft, or Register with email.</li>
    <li>On the email path: enter your name, email, a password (minimum 8 characters), and select Property seller under "I am a&hellip;".</li>
    <li>Click Create account. A verification email arrives within a minute — click the link to activate, then sign in.</li>
  </ul>
  <p>No business or ID lookup at this stage — verification is the standard email-confirmation link.</p>

  <h3>Property buyers — free</h3>
  <ul>
    <li>Same page and same steps as sellers — propxchain.com/register &rarr; Register with email.</li>
    <li>Select Property buyer under "I am a&hellip;" instead of seller.</li>
  </ul>
  <p>Buyers use PropXchain completely free, for as long as they use it.</p>

  <h3>Conveyancers &amp; solicitors — panel application</h3>
  <ul>
    <li>Go to propxchain.com/register/conveyancer.</li>
    <li>Enter your firm's CLC practice ID (find it on the Council for Licensed Conveyancers register at clc-uk.org). PropXchain looks the firm up automatically and fills in the name.</li>
    <li>If the firm is not found in PropXchain's snapshot of the register, you can still continue — the account is marked unverified and checked manually within 24 hours.</li>
    <li>Enter your email, a password, and confirm it. Click Apply to the panel.</li>
    <li>A verification email arrives — click the link, then sign in.</li>
  </ul>

  <h3>Property developers — business verified</h3>
  <ul>
    <li>Go to propxchain.com/register/developer.</li>
    <li>Enter your Companies House number — PropXchain looks the company up live and fills in the name, status and address.</li>
    <li>A dissolved company blocks sign-up at this step; a network hiccup lets you continue unverified instead.</li>
    <li>Enter your email, a password, and confirm it. Click Create your developer account.</li>
    <li>A verification email arrives — click the link, then sign in.</li>
  </ul>

  <h3>Estate agents — business details</h3>
  <ul>
    <li>Go to propxchain.com/register/estate-agent.</li>
    <li>Enter your agency name, branch, redress scheme (PRS or TPO) and membership number.</li>
    <li>Companies House number is optional here — it will not block sign-up either way.</li>
    <li>Enter your email, a password, and confirm it, then create the account.</li>
    <li>A verification email arrives — click the link, then sign in.</li>
  </ul>
</section>

<p>One account per email: registering again with an address that already has a PropXchain account — through any of the five doors, by email or by Google/Microsoft — never creates a second one. Email registration shows "An account with this email already exists"; Google or Microsoft signs you straight into the existing account instead.</p>

<p>See also <a href="/register">start your transaction free</a>.</p>
</main>`,
  }),
  withJsonLd({
    route: 'resources/selling/what-is-a-property-pack',
    category: 'selling',
    catName: 'Selling',
    published: '2026-06-12',
    modified: '2026-08-14',
    crumb: 'What is a sales pack?',
    title: 'What Is a Sales Pack? Upfront Property Information Explained · PropXchain',
    description: 'A sales pack (also called a property pack) gathers the title register, searches, TA6 and EPC before a house is listed, so buyers see the full picture on day one. What goes in one, why upfront information speeds up sales, and how PropXchain assembles yours.',
    main: `<main id="seo-fallback" role="main" aria-label="What is a sales pack — guide">
<p class="muted">Loading PropXchain…</p>
<h1>What is a sales pack?</h1>
<p>Most house sales start with a listing and end with a scramble for documents. A sales pack flips that order: the information a buyer will eventually demand is gathered before anyone makes an offer.</p>

<section aria-labelledby="pp-idea">
  <h2 id="pp-idea">The idea in one paragraph</h2>
  <p>A sales pack — the term used in the government's June 2026 Home Buying and Selling Reform Roadmap; also called a property pack, upfront information or material information — is a bundle of the documents and facts about a property that every buyer's conveyancer and lender will ask for sooner or later. In a traditional sale they are collected after an offer is accepted, one request at a time, while everyone waits. In a pack-led sale the seller collects them before listing, so a serious buyer can see the full picture on day one.</p>
</section>

<section aria-labelledby="pp-contents">
  <h2 id="pp-contents">What goes in a sales pack</h2>
  <h3>Title register and title plan</h3>
  <p>The official HM Land Registry record of ownership, boundaries, and anything attached to the title: mortgages, restrictions, rights of way, covenants. Pulling it early surfaces problems while there is still time to fix them calmly.</p>
  <h3>Property searches</h3>
  <p>Enquiries made to public bodies: the local authority search (planning, building control, road schemes), the drainage and water search, and the environmental search (flood risk, contaminated land, ground stability). Searches typically cost around £50–£450 as a set.</p>
  <h3>Seller's property information (TA6 and material information)</h3>
  <p>The TA6 is the Law Society's property information form: disputes, alterations and consents, guarantees, boundaries, flooding, parking. Alongside it sits the industry push for material information in listings, so facts that affect a buyer's decision are disclosed at the point of marketing. The blueprint for this is the BASPI form — see <a href="/resources/industry-and-reform/baspi-explained">BASPI explained</a>.</p>
  <h3>Energy Performance Certificate (EPC)</h3>
  <p>A legal requirement when marketing a property in England and Wales, valid for ten years.</p>
  <h3>The supporting cast</h3>
  <ul>
    <li>Fittings and contents form (TA10): what stays and what goes.</li>
    <li>Guarantees and certificates: FENSA, gas and electrical safety, building regulations sign-off.</li>
    <li>Leasehold information where relevant: the lease, ground rent and service charges, and the management pack.</li>
  </ul>
  <p>Nothing in a sales pack is extra work invented for the seller: every item is something the buyer's side will require anyway. The pack just moves the effort to the start of the sale.</p>
</section>

<section aria-labelledby="pp-why">
  <h2 id="pp-why">Why upfront information sells houses faster</h2>
  <ul>
    <li><strong>Fewer surprises, fewer fall-throughs.</strong> Sales most often collapse when something unexpected surfaces late. A pack surfaces it on day one, while it is a discussion rather than a crisis.</li>
    <li><strong>Serious offers from informed buyers.</strong> A buyer who has read the title, searches and TA6 before offering is far less likely to renegotiate or walk away after the survey.</li>
    <li><strong>Conveyancers start with answers.</strong> The legal work begins from a complete file, which shortens the enquiry stage that eats most of the calendar — see <a href="/resources/buying/how-long-does-conveyancing-take">how long conveyancing takes</a>.</li>
  </ul>
</section>

<section aria-labelledby="pp-propxchain">
  <h2 id="pp-propxchain">How PropXchain assembles your pack</h2>
  <p>Add your address and PropXchain pulls your HM Land Registry title automatically. Guided, plain-English TA6 and TA10 forms auto-save as you go. You order searches from the provider you choose, through PropXchain, at the price shown up front. Everything lives in one shared transaction view with an on-chain audit trail, so your buyer and conveyancer see the same pack you do.</p>
  <p>All of that is on the free Starter tier — no platform fee. The optional £75 AI co-pilot reads your title and search results in plain English, flags the issues that matter, and tailors your conveyancer quote request. See <a href="/pricing">pricing</a> or <a href="/sell-my-house">how to sell your house online</a>.</p>
</section>

<p>Ready to start your pack? <a href="/register">Create your free account</a>.</p>
</main>`,
  }),
  withJsonLd({
    route: 'resources/buying/how-long-does-conveyancing-take',
    category: 'buying',
    catName: 'Buying',
    published: '2026-06-12',
    modified: '2026-06-12',
    crumb: 'How long does conveyancing take?',
    title: 'How Long Does Conveyancing Take in the UK? A Realistic Timeline · PropXchain',
    description: 'A realistic stage-by-stage conveyancing timeline for England and Wales: instruction, searches, enquiries, exchange and completion. What causes the big delays — chains, slow searches, enquiry ping-pong — and how to speed it up.',
    main: `<main id="seo-fallback" role="main" aria-label="How long does conveyancing take — guide">
<p class="muted">Loading PropXchain…</p>
<h1>How long does conveyancing take?</h1>
<p>The honest answer is "it depends what goes wrong". For a straightforward freehold sale or purchase with a willing buyer and seller, conveyancing in England and Wales typically takes several months from offer acceptance to completion. A clean, well-prepared transaction can move considerably faster; a long chain or a complicated leasehold can take far longer. Almost none of the calendar is legal work taking its natural course — most of it is waiting.</p>

<section aria-labelledby="ct-stages">
  <h2 id="ct-stages">The stages, in order</h2>
  <h3>1. Instruction and identity checks</h3>
  <p>Both sides appoint a conveyancer, sign terms, and complete identity and anti-money-laundering checks. Days if everyone responds quickly; weeks if paperwork drifts.</p>
  <h3>2. Draft contract and seller's forms</h3>
  <p>The seller's conveyancer obtains the title from HM Land Registry and prepares the draft contract pack, including the TA6 and TA10. If the seller prepared these in advance (see <a href="/resources/selling/what-is-a-property-pack">what is a sales pack</a>), this stage is nearly instant.</p>
  <h3>3. Searches</h3>
  <p>The buyer's side orders local authority, drainage and water, and environmental searches (typically £50–£450 as a set). Turnaround varies enormously by council — days in some areas, weeks in others. One of the most common single sources of delay, and one of the easiest to start early.</p>
  <h3>4. Survey and mortgage offer</h3>
  <p>The buyer commissions a survey and, if borrowing, waits for the lender's valuation and formal mortgage offer.</p>
  <h3>5. Enquiries</h3>
  <p>The buyer's conveyancer raises written questions to the seller's side. Each round trip can take days or weeks, and an incomplete answer spawns another round. This ping-pong is where transactions quietly lose a month or more.</p>
  <h3>6. Exchange of contracts</h3>
  <p>Once enquiries are settled and the mortgage offer is in place, contracts are exchanged: the deal becomes legally binding and the completion date is fixed. In a chain, every transaction must exchange together.</p>
  <h3>7. Completion and registration</h3>
  <p>Usually one to two weeks after exchange, the money moves, keys are released, and the buyer's conveyancer registers the new owner with HM Land Registry.</p>
</section>

<section aria-labelledby="ct-delays">
  <h2 id="ct-delays">What causes the big delays</h2>
  <ul>
    <li><strong>Chains</strong> — your sale moves at the speed of the slowest connected transaction.</li>
    <li><strong>Slow searches</strong> — council turnaround you cannot control; the order date you can.</li>
    <li><strong>Enquiry ping-pong</strong> — vague information up front guarantees more questions later.</li>
    <li><strong>Leasehold paperwork</strong> — management packs are chargeable and frequently slow.</li>
    <li><strong>Mortgage hiccups</strong> — expired offers, down-valuations, late evidence requests.</li>
    <li><strong>No shared visibility</strong> — when updates travel by phone between five parties, problems are spotted late.</li>
  </ul>
</section>

<section aria-labelledby="ct-speed">
  <h2 id="ct-speed">How to speed it up</h2>
  <ul>
    <li><strong>Prepare before you list</strong> — title pulled, TA6 and TA10 completed, certificates gathered.</li>
    <li><strong>Order searches early</strong> — don't wait for milestones that don't legally depend on each other.</li>
    <li><strong>Instruct your conveyancer at listing, not at offer</strong> — see <a href="/find-a-conveyancer">find a conveyancer</a>; panel firms quote directly per transaction.</li>
    <li><strong>Respond same-day</strong> — fast answers compound across the whole timeline.</li>
    <li><strong>Share one live view</strong> — when all parties see the same transaction state, chasing disappears and blockers surface the day they happen.</li>
  </ul>
</section>

<section aria-labelledby="ct-propxchain">
  <h2 id="ct-propxchain">Where PropXchain fits</h2>
  <p>Your transaction lives in one shared, real-time view: HM Land Registry title pulled at the start, guided forms stored as you complete them, searches tracked to the transaction, every milestone timestamped on-chain. The Starter tier is free with no platform fee; the optional £75 AI co-pilot reads your title and search results in plain English and flags issues before they become enquiries. See <a href="/pricing">pricing</a> or <a href="/sell-my-house">selling your house online</a>.</p>
</section>

<p>Ready to take the waiting out of your move? <a href="/register">Start free</a>.</p>
</main>`,
  }),
  withJsonLd({
    route: 'resources/industry-and-reform/baspi-explained',
    category: 'industry-and-reform',
    catName: 'Industry & Reform',
    published: '2026-06-12',
    modified: '2026-06-12',
    crumb: 'BASPI explained',
    title: 'BASPI Explained: the Buyer’s and Seller’s Property Information Form · PropXchain',
    description: 'BASPI is the Buyer’s and Seller’s Property Information form from the Home Buying and Selling Group: the industry blueprint for upfront information. What it covers, how it relates to the TA6 and material information rules, and where home moving is heading.',
    main: `<main id="seo-fallback" role="main" aria-label="BASPI explained — guide">
<p class="muted">Loading PropXchain…</p>
<h1>BASPI explained</h1>
<p>BASPI is the Buyer's and Seller's Property Information form, developed by the Home Buying and Selling Group (HBSG) — a cross-industry group of conveyancers, estate agents, lenders, surveyors and proptech firms working with government to make home moving faster and less prone to collapse. Its ambition: capture all the information about a property once, at the start of marketing, in a single dataset every party can rely on.</p>

<section aria-labelledby="ba-covers">
  <h2 id="ba-covers">What the form covers</h2>
  <h3>Part 1: what the seller knows</h3>
  <ul>
    <li>Ownership and tenure: freehold, leasehold, shared ownership.</li>
    <li>Disputes, complaints and notices affecting the property.</li>
    <li>Alterations and building work, and whether consents and certificates exist.</li>
    <li>Specialist issues: flooding, Japanese knotweed, asbestos, drainage, rights of way.</li>
    <li>Leasehold detail: ground rent, service charges, the managing agent.</li>
    <li>Utilities, services, parking and council tax band.</li>
  </ul>
  <h3>Part 2: the legal pack</h3>
  <ul>
    <li>Title information and supporting documents.</li>
    <li>Energy Performance Certificate and other required certificates.</li>
    <li>Guarantees, warranties and planning documentation.</li>
  </ul>
  <p>Part 1 is the seller's own disclosure; Part 2 is the supporting evidence a conveyancer assembles. Together they amount to a <a href="/resources/selling/what-is-a-property-pack">sales pack</a>: everything a buyer's side needs, gathered before an offer rather than after it.</p>
</section>

<section aria-labelledby="ba-ta6">
  <h2 id="ba-ta6">How BASPI relates to the TA6</h2>
  <p>The TA6 is the Law Society's property information form, traditionally completed after a sale is agreed. The two overlap heavily by design: BASPI was built as the umbrella dataset for the whole industry, and recent editions of the TA6 have aligned with the material information a listing is expected to disclose. A seller who has completed a BASPI-shaped dataset has already answered substantially what the TA6 asks — the difference is when. Every week of difference is conveyancing time saved or lost (see <a href="/resources/buying/how-long-does-conveyancing-take">how long conveyancing takes</a>).</p>
</section>

<section aria-labelledby="ba-material">
  <h2 id="ba-material">Material information: Parts A, B and C</h2>
  <p>Guidance published by National Trading Standards (through its Estate and Letting Agency Team, NTSELAT) set out what estate agents should disclose in listings, in three parts:</p>
  <ul>
    <li><strong>Part A:</strong> material to every property: price, tenure, council tax band, and for leaseholds the ground rent and service charges.</li>
    <li><strong>Part B:</strong> applies to most properties: utilities, heating, broadband, parking, building safety.</li>
    <li><strong>Part C:</strong> applies where relevant: flood risk, restrictive covenants, rights of way, accessibility, coastal erosion.</li>
  </ul>
  <p>The legal footing for disclosure has since moved to the Digital Markets, Competition and Consumers Act 2024, which replaced the older consumer protection regulations. The direction of travel has not changed: omitting information a buyer needs is a consumer-protection issue, and the A/B/C framing remains the clearest map of what buyers should expect to see upfront.</p>
</section>

<section aria-labelledby="ba-heading">
  <h2 id="ba-heading">Where this is all heading</h2>
  <p>The HBSG also backs the Property Data Trust Framework, a data standard that lets verified property information move digitally between platforms, agents, conveyancers and lenders instead of being retyped at every step. The destination: information collected once, verified at source, trusted by everyone downstream.</p>
  <p>That is the model PropXchain is built on. Guided forms capture your property information once, your HM Land Registry title is pulled automatically, and everything lives in one shared view with an on-chain audit trail. Starter is free with no platform fee; the optional £75 AI co-pilot reads your title and searches in plain English and tailors your conveyancer quote request. See <a href="/pricing">pricing</a> or <a href="/sell-my-house">selling your house online</a>.</p>
</section>

<p>Get ahead of where the industry is going. <a href="/register">Start free</a>.</p>
</main>`,
  }),
  withJsonLd({
    route: 'resources/searches-and-legal/property-searches-explained',
    category: 'searches-and-legal',
    catName: 'Searches & Legal',
    published: '2026-06-12',
    modified: '2026-08-21',
    title: 'Property Searches Explained: What They Are and Which You Need · PropXchain',
    description:
      'Local authority, drainage, environmental, coal: the searches a conveyancer orders before you can exchange, what each one actually tells you, why the list changes depending on where the house is, and how long they stay valid.',
    main: `<main id="seo-fallback" role="main" aria-label="Property searches explained">
<p class="muted">Loading PropXchain…</p>
<h1>Property searches explained</h1>
<p>Searches are the part of buying a house nobody explains. They arrive as a line on an invoice with an acronym attached, and most people pay without ever learning what they bought. Here is what each one actually does, and why the list is different for a house in Barnsley and a house in Bedfordshire.</p>

<section aria-labelledby="ps-what">
  <h2 id="ps-what">What a search actually is</h2>
  <p>A property search is a question put to an organisation that holds records about land — the council, the water company, the Coal Authority — and the written answer that comes back. It is a records check, not an inspection; nobody visits the house.</p>
  <p>The party really asking is usually the buyer's lender. A mortgage is secured against the property, so the lender wants to know the council has no plans to drive a road through the garden before it releases the money. That is why searches are effectively compulsory on a mortgaged purchase and optional on a cash one.</p>
</section>

<section aria-labelledby="ps-core">
  <h2 id="ps-core">The four almost every property needs</h2>
  <h3>Local authority search (LLC1 + CON29)</h3>
  <p>The LLC1 lists charges registered against the property. The CON29 answers a standard set of questions about planning permissions, building control, nearby road schemes and public footpaths.</p>
  <h3>Drainage and water (CON29DW)</h3>
  <p>Confirms whether the property is connected to public water and sewers or relies on a private supply or septic tank, and whether a public sewer runs under the garden.</p>
  <h3>Environmental search</h3>
  <p>Checks contaminated land, landfill history, flood risk and radon. Under contaminated land rules a current owner can be liable for cleaning up pollution somebody else caused.</p>
  <h3>Land Registry title search</h3>
  <p>The official register and plan: who owns it, where the boundaries run, what rights cross it, and what charges are secured against it.</p>
</section>

<section aria-labelledby="ps-location">
  <h2 id="ps-location">Why the list changes with location</h2>
  <p>Those four apply almost everywhere. The rest depend on what the ground has been used for: coal mining (CON29M) over former coalfields, brine and salt extraction chiefly in Cheshire, tin and metalliferous mining in Cornwall and west Devon, and chancel repair liability in some parishes. Two identical houses in Sandy and Barnsley need different search lists.</p>
</section>

<section aria-labelledby="ps-who">
  <h2 id="ps-who">Who supplies what</h2>
  <p>No single company does all of it. The local authority search and drainage and water come from a search provider with a direct line to the council and the water company — OneSearch and tmGroup both do this, and sell them together as a pack.</p>
  <p>The environmental, flood, planning and mining reports come from a data company instead, and are bought individually and added on top of whichever pack you choose. Note that the coal report, CON29M, is a different product from the CON29 local authority enquiries despite the near-identical name.</p>
</section>

<section aria-labelledby="ps-bundle">
  <h2 id="ps-bundle">Bundle, or one at a time?</h2>
  <p>Within a single provider, a bundle is usually cheaper when you need most of what is in it, and worse value when you need two items out of six. Across providers the question does not really arise — they are doing different jobs. A search you do not need is not a safety net — it is a document nobody will read, and every provider will happily sell you one.</p>
</section>

<section aria-labelledby="ps-timing">
  <h2 id="ps-timing">How long they take, and how long they last</h2>
  <p>Turnarounds run from instant for the title register to ten working days for a slow council. Most searches are treated as valid for six months, so a chain that drags on can mean paying for some of them twice. Ordering early is one of the few delays a seller can remove before a buyer even appears.</p>
</section>

<p>See also <a href="/resources/selling/what-is-a-property-pack">what is a sales pack</a>, or <a href="/register">start your transaction free</a>.</p>
</main>`,
  }),
  withJsonLd({
    route: 'resources/selling/property-information-forms-explained',
    category: 'selling',
    catName: 'Selling',
    published: '2026-06-12',
    modified: '2026-08-21',
    title: 'TA6, TA10 and TA7 Explained: the Seller’s Property Information Forms · PropXchain',
    description:
      'The three forms every seller fills in, what each one asks, why your answers are legally binding representations rather than opinions, and the questions people most often get wrong.',
    main: `<main id="seo-fallback" role="main" aria-label="TA6, TA10 and TA7 explained">
<p class="muted">Loading PropXchain…</p>
<h1>TA6, TA10 and TA7 explained</h1>
<p>Three forms stand between accepting an offer and a buyer who stops asking questions. They look like paperwork and they are not: what you write on them is a set of statements your buyer is entitled to rely on, and getting one wrong can follow you long after you have moved out.</p>

<section aria-labelledby="ti-why">
  <h2 id="ti-why">Why these forms exist</h2>
  <p>English property sales run on caveat emptor — buyer beware. The seller is not obliged to volunteer everything they know, so the buyer's solicitor asks instead. These forms are the Law Society's standard set of questions, so every sale asks the same things in the same order.</p>
  <p>Your answers become the basis of the enquiries the buyer's solicitor raises. Thin or evasive answers do not make the questions go away — they turn one form into three weeks of correspondence.</p>
</section>

<section aria-labelledby="ti-ta6">
  <h2 id="ti-ta6">TA6 — Property Information</h2>
  <p>The long one. Boundaries and who maintains them, disputes and complaints, notices you have received, alterations and whether they had consent, guarantees, services, and rights of way.</p>
  <p>The questions people get wrong: disputes (a running disagreement counts even if nothing formal happened), alterations (conservatories, knocked-through walls and replacement windows all need paperwork), flooding (this asks about the property, not the postcode), and Japanese knotweed (if you are unsure what it looks like, "not known" is the honest answer).</p>
</section>

<section aria-labelledby="ti-ta10">
  <h2 id="ti-ta10">TA10 — Fittings and Contents</h2>
  <p>Room by room, what stays and what goes. It reads as trivial and it is the single most common source of completion-day arguments — light fittings taken down on the morning of the move, curtains the buyer assumed were included, a shed that turned out to be going with the seller.</p>
</section>

<section aria-labelledby="ti-ta7">
  <h2 id="ti-ta7">TA7 — Leasehold Information</h2>
  <p>Leasehold and share-of-freehold sales only. Service charges, ground rent, the managing agent, the lease terms and any major works planned. Most of these answers come from the freeholder or managing agent rather than from you, so requesting the management pack the week you list rather than the week you accept an offer routinely saves a fortnight.</p>
</section>

<section aria-labelledby="ti-binding">
  <h2 id="ti-binding">What "legally binding" actually means here</h2>
  <p>Your answers are representations: statements the buyer relies on when deciding to proceed and what to pay. If one turns out to be untrue and the buyer relied on it, they may have a claim for misrepresentation — and that survives completion.</p>
  <p>The remedy is simple: answer what you know, and where you do not know, say so. "Not known" is a permitted answer and it is not a weakness. What creates liability is a confident answer that turns out to be wrong.</p>
</section>

<section aria-labelledby="ti-docs">
  <h2 id="ti-docs">What to gather before you start</h2>
  <ul>
    <li>FENSA or CERTASS certificates for replacement windows and doors</li>
    <li>Building regulations completion certificates for structural work, and planning permissions where needed</li>
    <li>Guarantees: damp proofing, timber treatment, roofing, cavity wall insulation, underpinning</li>
    <li>Boiler service records, gas safety and electrical installation certificates</li>
    <li>For leasehold: the lease, recent service charge statements and any Section 20 notices</li>
  </ul>
</section>

<p>See also <a href="/resources/industry-and-reform/baspi-explained">BASPI explained</a> and <a href="/resources/selling/what-is-a-property-pack">what is a sales pack</a>, or <a href="/register">start your transaction free</a>.</p>
</main>`,
  }),
];
