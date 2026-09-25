import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView } from '@/lib/analytics';

/** Mounts inside <Router>; reports each route change as a GA4 page_view. */
export function AnalyticsTracker(): null {
  const { pathname, search } = useLocation();

  useEffect(() => {
    trackPageView(pathname + search, document.title);
  }, [pathname, search]);

  return null;
}
