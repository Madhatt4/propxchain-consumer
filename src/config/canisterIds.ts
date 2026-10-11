// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import { MAINNET_CANISTER_IDS, MAINNET_PLATFORM_CANISTER_IDS } from '@propxchain/core-client';
import deployManifest from '../../canister_ids.json';

/**
 * Every canister ID the app talks to, in one place.
 *
 * Platform canister IDs are published by `@propxchain/core-client`, which is
 * the only package that knows the canisters. This app's own frontend canister
 * comes from its deploy manifest (`canister_ids.json`), the file dfx deploys
 * with. Nothing here is a literal, so a recreated canister is fixed by
 * publishing a new core-client, not by editing this repo.
 *
 * A non-empty `VITE_*_CANISTER_ID` overrides the published ID, for pointing a
 * local build at other canisters.
 */
function withOverride(override: string | undefined, published: string): string {
  const trimmed = override?.trim();
  return trimmed ? trimmed : published;
}

const env = import.meta.env;

export const CANISTER_IDS = Object.freeze({
  property_registry: withOverride(env.VITE_PROPERTY_REGISTRY_CANISTER_ID, MAINNET_CANISTER_IDS.propertyRegistry),
  document_verification: withOverride(env.VITE_DOCUMENT_VERIFICATION_CANISTER_ID, MAINNET_CANISTER_IDS.documentVerification),
  transaction_manager: withOverride(env.VITE_TRANSACTION_MANAGER_CANISTER_ID, MAINNET_CANISTER_IDS.transactionManager),
  user_management: withOverride(env.VITE_USER_MANAGEMENT_CANISTER_ID, MAINNET_CANISTER_IDS.userManagement),
  document_storage: withOverride(env.VITE_DOCUMENT_STORAGE_CANISTER_ID, MAINNET_CANISTER_IDS.documentStorage),
  email_service: withOverride(env.VITE_EMAIL_SERVICE_CANISTER_ID, MAINNET_CANISTER_IDS.emailService),
  ledger_manager: withOverride(env.VITE_LEDGER_MANAGER_CANISTER_ID, MAINNET_CANISTER_IDS.ledgerManager),
  land_registry_integration: withOverride(env.VITE_LAND_REGISTRY_CANISTER_ID, MAINNET_CANISTER_IDS.landRegistryIntegration),
  message_manager: withOverride(env.VITE_MESSAGE_MANAGER_CANISTER_ID, MAINNET_PLATFORM_CANISTER_IDS.messageManager),
  entitlement: withOverride(env.VITE_ENTITLEMENT_CANISTER_ID, MAINNET_PLATFORM_CANISTER_IDS.entitlement),
  frontend: withOverride(env.VITE_ICP_CANISTER_ID, deployManifest.frontend.ic),
});

/** Mainnet property_logbook. logbook.service decides when to use it. */
export const MAINNET_LOGBOOK_CANISTER_ID: string = MAINNET_PLATFORM_CANISTER_IDS.propertyLogbook;

/** The dfx cycles wallet that funds the platform canisters. */
export const CYCLES_WALLET_ID: string = MAINNET_PLATFORM_CANISTER_IDS.cyclesWallet;
