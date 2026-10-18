// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import type { PrerenderPage } from './prerender-resources.mjs';

/** Every prerendered route: the marketing pages followed by the /resources pages. */
export const pages: (PrerenderPage & { jsonLd?: Record<string, unknown> })[];
