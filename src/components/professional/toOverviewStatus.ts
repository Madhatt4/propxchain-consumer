// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Translate a portal's own status vocabulary into the transaction vocabulary
 * ProfessionalOverviewPanel speaks.
 *
 * The panel accepts `active | exchanged | completion_initiated |
 * blockchain_completed | land_registry_registered` and silently falls back to
 * 'active' for anything it does not recognise. That fallback is why this
 * exists as a named, tested function rather than an inline ternary: a wrong
 * guess does not throw, it quietly misreports the panel's stats, because
 * `derivePhase` reads this status alongside the ledger milestones.
 *
 * Both the estate-agent listing statuses (`AgentListingStatus`) and the
 * builder's `plots.current_legal_status` land on the same two real
 * equivalents, so they share this rather than keeping two copies that could
 * drift apart:
 *
 *   - 'exchanged'  -> 'exchanged'
 *   - 'completed'  -> 'blockchain_completed'
 *
 * Everything else — an agent's 'draft' / 'for_sale' / 'under_offer' /
 * 'sold_stc' / 'withdrawn', a plot with no legal status yet — is genuinely
 * pre-exchange. 'active' there is accurate, not a default.
 */
export function toOverviewStatus(status: string | null | undefined): string {
  if (status === 'exchanged') return 'exchanged';
  if (status === 'completed') return 'blockchain_completed';
  return 'active';
}
