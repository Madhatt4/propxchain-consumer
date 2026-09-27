// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { useEffect } from 'react';

/**
 * Adds <meta name="robots" content="noindex"> while the calling component is
 * mounted. Private pages are served from the same SPA shell as marketing, so
 * without this Google indexed /dashboard (seen in Search Console).
 */
export function useNoIndex(): void {
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex';
    document.head.appendChild(meta);
    return () => {
      meta.remove();
    };
  }, []);
}
