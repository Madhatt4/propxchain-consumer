// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Until 2026-11-11 the transaction_manager canister logged an `lr_submission`
 * event at completion for a Land Registry submission that never happened
 * (Madhatt4/Propxchain#422, card 20aa7377). The audit trail is append-only, so
 * those events stay. This flags them the same way the MCP audit tool does
 * (propxchain-mcp-server/src/tools/audit.ts, simulatedLrNote): the exact event
 * type and details text. The buyer's conveyancer's real record has different
 * details text, so it is never flagged.
 */

export const SIMULATED_LR_NOTE =
  "Simulated: written automatically at completion before 2026-11-11. No application was submitted to HM Land Registry and no confirmation number exists. PropXchain never lodges with HMLR; the buyer's conveyancer submits the registration application and records it as a later lr_submission event.";

const SIMULATED_DETAILS = 'Land Registry submission triggered';

/** True for one of the pre-2026-11-11 simulated submissions. */
export function isSimulatedLrSubmission(eventType: string, details: string): boolean {
  return eventType === 'lr_submission' && details === SIMULATED_DETAILS;
}

/** The note to show beside an audit event, or null when none applies. */
export function simulatedLrNote(eventType: string, details: string): string | null {
  return isSimulatedLrSubmission(eventType, details) ? SIMULATED_LR_NOTE : null;
}
