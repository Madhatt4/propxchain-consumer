// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * /resources/getting-started/how-to-sign-in — how each of PropXchain's five
 * account types registers, and the three ways to sign back in once you have
 * an account. Facts verified against the live pages (LoginPage.tsx,
 * RegisterPage.tsx, RegisterConveyancerPage.tsx, RegisterDeveloperPage.tsx,
 * RegisterEstateAgentPage.tsx) rather than written from memory.
 * Prerender twin: scripts/prerender-resources.mjs (keep facts in sync).
 */

import React from 'react';
import ResourceLayout from './ResourceLayout';
import { Callout, GuideH2, GuideH3, GuideList, GuideP, Term } from './guideElements';
import { getRequiredArticle } from './resourcesMeta';

const meta = getRequiredArticle('getting-started', 'how-to-sign-in');

const LEDE =
  'Sellers, buyers, conveyancers, developers and estate agents each register through a different door on PropXchain. Here is what each one asks for, and the three ways to sign back in once you have an account.';

const HowToSignInGuide: React.FC = () => (
  <ResourceLayout
    meta={meta}
    lede={LEDE}
    productLink={{
      to: '/register',
      lead: 'Ready to create an account?',
      label: 'Go to registration',
    }}
  >
    <GuideH2>Signing in, once you have an account</GuideH2>
    <GuideP>
      The same three methods work for every account type. Go to{' '}
      <Term>propxchain.com/login</Term> and choose one.
    </GuideP>
    <GuideList
      items={[
        <>
          <Term>Continue with Google</Term> or <Term>Continue with Microsoft</Term> &mdash; one
          click, no password to remember. If the address you sign in with already has a
          PropXchain account, you are signed straight in; nothing new is created.
        </>,
        <>
          <Term>Continue with email</Term> &mdash; enter the email and password you registered
          with.
        </>,
        <>
          <Term>Continue with Internet Identity</Term> &mdash; passkey-based decentralised
          sign-in, for anyone who registered that way. It is a separate identity from an
          email or Google account, not interchangeable with either.
        </>,
      ]}
    />
    <Callout label="Forgotten which one you used?">
      Try email first. If that address already has an account, PropXchain tells you rather
      than creating a duplicate, and &ldquo;Forgot password&rdquo; on the sign-in screen
      resets it.
    </Callout>

    <GuideH2>Registering, by account type</GuideH2>
    <GuideP>
      Start at <Term>propxchain.com/register</Term>. Sellers and buyers use that page
      directly; conveyancers, developers and estate agents each have their own door,
      linked from it.
    </GuideP>

    <GuideH3>Property sellers &mdash; free</GuideH3>
    <GuideList
      items={[
        <>Go to propxchain.com/register.</>,
        <>
          Choose <Term>Continue with Google</Term>, <Term>Continue with Microsoft</Term>, or{' '}
          <Term>Register with email</Term>.
        </>,
        <>
          On the email path: enter your name, email, a password (minimum 8 characters), and
          select <Term>Property seller</Term> under &ldquo;I am a&hellip;&rdquo;.
        </>,
        <>
          Click <Term>Create account</Term>. A verification email arrives within a minute
          &mdash; click the link to activate, then sign in.
        </>,
      ]}
    />
    <GuideP>
      No business or ID lookup at this stage &mdash; verification is the standard
      email-confirmation link.
    </GuideP>

    <GuideH3>Property buyers &mdash; free</GuideH3>
    <GuideList
      items={[
        <>
          Same page and same steps as sellers &mdash; propxchain.com/register &rarr;{' '}
          <Term>Register with email</Term>.
        </>,
        <>
          Select <Term>Property buyer</Term> under &ldquo;I am a&hellip;&rdquo; instead of
          seller.
        </>,
      ]}
    />
    <GuideP>Buyers use PropXchain completely free, for as long as they use it.</GuideP>

    <GuideH3>Conveyancers &amp; solicitors &mdash; panel application</GuideH3>
    <GuideList
      items={[
        <>Go to propxchain.com/register/conveyancer.</>,
        <>
          Enter your firm&rsquo;s <Term>CLC practice ID</Term> (find it on the Council for
          Licensed Conveyancers register at clc-uk.org). PropXchain looks the firm up
          automatically and fills in the name.
        </>,
        <>
          If the firm is not found in PropXchain&rsquo;s snapshot of the register, you can
          still continue &mdash; the account is marked <em>unverified</em> and checked
          manually within 24 hours.
        </>,
        <>
          Enter your email, a password, and confirm it. Click{' '}
          <Term>Apply to the panel</Term>.
        </>,
        <>A verification email arrives &mdash; click the link, then sign in.</>,
      ]}
    />

    <GuideH3>Property developers &mdash; business verified</GuideH3>
    <GuideList
      items={[
        <>Go to propxchain.com/register/developer.</>,
        <>
          Enter your <Term>Companies House number</Term> &mdash; PropXchain looks the
          company up live and fills in the name, status and address.
        </>,
        <>
          A dissolved company blocks sign-up at this step; a network hiccup lets you
          continue unverified instead.
        </>,
        <>
          Enter your email, a password, and confirm it. Click{' '}
          <Term>Create your developer account</Term>.
        </>,
        <>A verification email arrives &mdash; click the link, then sign in.</>,
      ]}
    />

    <GuideH3>Estate agents &mdash; business details</GuideH3>
    <GuideList
      items={[
        <>Go to propxchain.com/register/estate-agent.</>,
        <>
          Enter your agency name, branch, redress scheme (<Term>PRS</Term> or{' '}
          <Term>TPO</Term>) and membership number.
        </>,
        <>Companies House number is optional here &mdash; it will not block sign-up either way.</>,
        <>Enter your email, a password, and confirm it, then create the account.</>,
        <>A verification email arrives &mdash; click the link, then sign in.</>,
      ]}
    />

    <Callout label="One account per email">
      Registering again with an address that already has a PropXchain account &mdash;
      through any of the five doors, by email or by Google/Microsoft &mdash; never creates
      a second one. Email registration shows &ldquo;An account with this email already
      exists&rdquo;; Google or Microsoft signs you straight into the existing account
      instead.
    </Callout>
  </ResourceLayout>
);

export default HowToSignInGuide;
