// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import type { Principal } from '@propxchain/core-client';

/**
 * Shape of a single admin grant returned by
 * `icpService.userManagement.listAdmins()` (Candid `AdminRecord`).
 */
export interface AdminRecord {
  principal: Principal;
  role: { super: null } | { regular: null };
  grantedBy: Principal;
  grantedAt: bigint;
  note: [] | [string];
}
