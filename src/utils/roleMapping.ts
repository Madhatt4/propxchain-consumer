// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import type { SimplifiedRole } from '../types/splitPanel.types';
import { logger } from '@/utils/logger';

/**
 * Normalizes userType from various formats to a consistent lowercase string
 *
 * Handles:
 * - Falsy values (null, undefined, empty string) -> ''
 * - Candid variant objects like { platform_admin: null } -> 'platform_admin'
 * - Plain strings -> lowercase trimmed string
 *
 * @param userType - Raw userType from canister or auth store
 * @returns Normalized lowercase string
 */
export function normalizeUserType(userType: unknown): string {
  // Handle falsy values
  if (!userType) {
    return '';
  }

  // Handle Candid variant objects (e.g., { platform_admin: null })
  if (typeof userType === 'object' && userType !== null) {
    const keys = Object.keys(userType);
    if (keys.length > 0) {
      return keys[0].trim().toLowerCase();
    }
    return '';
  }

  // Handle plain strings
  return String(userType).trim().toLowerCase();
}

/**
 * Buyer role types - users primarily involved in purchasing property
 */
const BUYER_TYPES = new Set([
  'buyer',
  'diy_buyer',
  'assisted_buyer',
  'conveyancer_managed',
]);

/**
 * Seller role types - users primarily involved in selling property
 */
const SELLER_TYPES = new Set([
  'seller',
  'diy_seller',
  'assisted_seller',
]);

/**
 * Agent types - property professionals who act on behalf of sellers
 * Mapped to 'seller' role as they represent seller interests
 */
const AGENT_TYPES = new Set([
  'estate_agent',
  'property_developer',
]);

/**
 * Solicitor role types - legal professionals managing transactions
 */
const SOLICITOR_TYPES = new Set([
  'solicitor_platform_only',
  'solicitor_transparent',
  'solicitor_client_linked',
  'solicitor_managed',
  'conveyancer_transparent',
  'mortgage_broker',
]);

/**
 * Admin types - platform administrators
 * Mapped to 'solicitor' role as they have full access like legal professionals
 */
const ADMIN_TYPES = new Set([
  'admin',
  'platform_admin',
  'platform_support',
]);

/**
 * Maps a UserType to a simplified role category
 *
 * Role mapping:
 * - buyer: buyer, diy_buyer, assisted_buyer, conveyancer_managed
 * - seller: seller, diy_seller, assisted_seller, estate_agent, property_developer
 * - solicitor: solicitor_*, conveyancer_transparent, mortgage_broker, admin, platform_admin, platform_support
 * - null: unknown or empty type
 *
 * @param userType - Raw userType (can be Candid variant object or string)
 * @returns SimplifiedRole ('buyer' | 'seller' | 'solicitor' | null)
 */
export function mapUserTypeToRole(userType: unknown): SimplifiedRole {
  const normalized = normalizeUserType(userType);

  // Handle empty/unknown types
  if (!normalized) {
    return null;
  }

  // Check each category
  if (BUYER_TYPES.has(normalized)) {
    return 'buyer';
  }

  if (SELLER_TYPES.has(normalized)) {
    return 'seller';
  }

  // Agents act on behalf of sellers
  if (AGENT_TYPES.has(normalized)) {
    return 'seller';
  }

  if (SOLICITOR_TYPES.has(normalized)) {
    return 'solicitor';
  }

  // Admins have full access like solicitors
  if (ADMIN_TYPES.has(normalized)) {
    return 'solicitor';
  }

  // Log warning for unknown types and default to buyer
  logger.warn(
    `[roleMapping] Unknown userType: "${normalized}". Defaulting to 'buyer'. ` +
    `Consider adding this type to the appropriate category.`
  );
  return 'buyer';
}
