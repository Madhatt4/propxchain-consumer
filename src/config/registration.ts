// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Whether new consumer accounts can be created.
 *
 * This used to be a local const inside App.tsx, which meant it gated the
 * /register ROUTE but nothing else could see it. The login page therefore
 * kept offering "Get started" and "Create an account" while sign-ups were
 * closed — three links, all landing on "Sign-ups open at launch". A user who
 * could not get in was invited to register three times and refused three
 * times. Found walking the logged-out surface on 2026-07-30.
 *
 * Anything that offers registration must read THIS, so the offer and the
 * destination can never disagree again.
 *
 * Conveyancer and developer registration are separate routes and are NOT
 * gated by this flag — they are onboarded deliberately, not self-serve.
 */
export const IS_REGISTRATION_OPEN: boolean =
  import.meta.env.VITE_MAINTENANCE_MODE !== 'true';

/**
 * Where to send someone who wanted to sign up but can't yet.
 *
 * The Home Mover Report is the only consumer capture path that IS open
 * pre-launch, so a closed sign-up should route there rather than nowhere.
 */
export const PRELAUNCH_CAPTURE_PATH = '/#report';
