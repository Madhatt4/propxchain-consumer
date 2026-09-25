// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import type { ReactElement } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

/**
 * Catch-all for unknown routes. Auth-aware so a logged-in user who hits a
 * stale link or typos a URL lands on their dashboard rather than being dumped
 * at the public marketing home — which makes them look logged-out and is
 * genuinely confusing.
 *
 * THE BUG THIS FILE EXISTS TO FIX: the original lived inline in App.tsx and
 * read `isAuthenticated` alone. The auth store restores ASYNCHRONOUSLY, so on
 * a hard page-load straight to an unknown route `isAuthenticated` is still
 * false on first render — and a signed-in user was sent to the marketing home,
 * the exact outcome the comment above says to avoid. The intent was right; the
 * implementation did not wait.
 *
 * Proven in production 2026-07-31 on a signed-in session:
 *
 *   hard-load /some-stale-link  ->  /           WRONG (token was in storage)
 *   dashboard, then client-nav  ->  /dashboard  right (auth already restored)
 *
 * Same code, different timing — which is why it survived: any test that
 * rendered with the store already settled would pass.
 *
 * Moved out of App.tsx so it can actually be tested.
 */
const NotFoundRedirect = (): ReactElement | null => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isInitialized = useAuthStore((s) => s.isInitialized);

  // Hold until the store has settled. Rendering nothing for that tick is
  // correct — this component only ever redirects, so there is no content to
  // flash and no layout to shift.
  if (!isInitialized) return null;

  return <Navigate to={isAuthenticated ? '/dashboard' : '/'} replace />;
};

export default NotFoundRedirect;
