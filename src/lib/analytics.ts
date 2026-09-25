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
