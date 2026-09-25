// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import { useState, useEffect } from 'react';
import type { ReactElement } from 'react';
import { SiteBadge } from './SiteBadge';
import { BuildMilestoneStrip } from './BuildMilestoneStrip';

/** Pending invite token key set by the reservation flow (wave 1b.9) */
const INVITE_TOKEN_KEY = 'propxchain_pending_invite_token';

/** Site context stored alongside the invite token */
const SITE_CONTEXT_KEY = 'propxchain_site_context';

interface SiteContext {
  siteId: string;
  siteName: string;
  plotId: string;
}

interface SiteContextBannerProps {
  /** site_id from the transaction metadata, if available */
  transactionSiteId?: string;
  /** site name from the transaction metadata, if available */
  transactionSiteName?: string;
  /** plot ID from the transaction metadata, if available */
  transactionPlotId?: string;
}

/**
 * Reads site context from transaction metadata or localStorage.
 * Returns null when no site context exists (standard transaction).
 */
function resolveSiteContext(props: SiteContextBannerProps): SiteContext | null {
  // Priority 1: transaction metadata
  if (props.transactionSiteId && props.transactionSiteName) {
    return {
      siteId: props.transactionSiteId,
      siteName: props.transactionSiteName,
      plotId: props.transactionPlotId ?? '',
    };
  }

  // Priority 2: localStorage from reservation flow
  try {
    const hasInviteToken = Boolean(localStorage.getItem(INVITE_TOKEN_KEY));
    const raw = localStorage.getItem(SITE_CONTEXT_KEY);
    if (hasInviteToken && raw) {
      const parsed: unknown = JSON.parse(raw);
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        'siteId' in parsed &&
        'siteName' in parsed
      ) {
        const ctx = parsed as Record<string, unknown>;
        return {
          siteId: String(ctx.siteId ?? ''),
          siteName: String(ctx.siteName ?? ''),
          plotId: String(ctx.plotId ?? ''),
        };
      }
    }
  } catch {
    // Malformed localStorage — treat as no site context
  }

  return null;
}

/**
 * Conditionally renders the site badge and reserved plot panel
 * when the transaction originated from a developer platform reservation.
 *
 * When no site context exists, renders nothing (zero impact on existing flow).
 */
export function SiteContextBanner(props: SiteContextBannerProps): ReactElement | null {
  const [siteContext, setSiteContext] = useState<SiteContext | null>(null);

  useEffect(() => {
    setSiteContext(resolveSiteContext(props));
  }, [props.transactionSiteId, props.transactionSiteName, props.transactionPlotId]);

  if (!siteContext) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3 mb-4">
      {/* Site badge */}
      <div>
        <SiteBadge siteName={siteContext.siteName} />
      </div>

      {/* Reserved plot panel — imported when ReservedPlotPanel is available (wave 1b.10) */}
      {/* TODO: Uncomment when ReservedPlotPanel is built
      {siteContext.plotId && (
        <ReservedPlotPanel plotId={siteContext.plotId} />
      )}
      */}

      {/* Build milestone strip (wave 1c.4) */}
      {siteContext.plotId && siteContext.siteId && (
        <BuildMilestoneStrip plotId={siteContext.plotId} siteId={siteContext.siteId} />
      )}
    </div>
  );
}
