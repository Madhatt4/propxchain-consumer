// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import { logger } from '@/utils/logger';

/**
 * Safely parse JSON with a fallback value.
 * Prevents app crashes from malformed localStorage/sessionStorage data.
 */
export function safeJsonParse<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    logger.warn('Failed to parse JSON, using fallback');
    return fallback;
  }
}
