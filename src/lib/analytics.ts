/**
 * Google Analytics 4 page_view reporting for the SPA. The gtag.js loader and
 * config live statically in index.html (Google's detector reads raw HTML) with
 * send_page_view off, because gtag fires once per full load and every React
 * Router navigation after that would otherwise be invisible.
 */

type GtagFn = (...args: unknown[]) => void;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: GtagFn;
  }
}

/** Reports a SPA navigation. No-op when gtag is absent (dev builds, blockers). */
export function trackPageView(path: string, title?: string): void {
  if (typeof window.gtag !== 'function') return;
  window.gtag('event', 'page_view', {
    page_path: path,
    page_location: window.location.origin + path,
    ...(title ? { page_title: title } : {}),
  });
}

/** How an account was created. Matches GA4's recommended sign_up `method`. */
export type SignUpMethod = 'email' | 'google' | 'azure';

/**
 * Reports a new account (GA4 recommended event `sign_up`). Fired once, at the
 * moment the account is created, never on later sign-ins. Carries no personal
 * data — only the method.
 */
export function trackSignUp(method: SignUpMethod): void {
  if (typeof window.gtag !== 'function') return;
  window.gtag('event', 'sign_up', { method });
}

/**
 * Reports a new waitlist entry (custom event `join_waitlist`). Duplicates are
 * not reported. Carries no personal data — only where the form was and the
 * role picked.
 */
export function trackWaitlistJoin(source: string | null | undefined, role: string | null | undefined): void {
  if (typeof window.gtag !== 'function') return;
  window.gtag('event', 'join_waitlist', {
    waitlist_source: source ?? 'unknown',
    waitlist_role: role ?? 'unknown',
  });
}
