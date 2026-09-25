// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * PropXchain Wallet — types and slot definitions.
 *
 * A wallet document is a user's own PII file (AML/SoF, identity, mortgage
 * offer, proof of ownership) held in owner-only Supabase Storage under
 * wallet/<auth.uid>/…, with only its SHA-256 hash anchored on-chain
 * (principal-scoped, no transaction). Filenames are never stored server-side.
 */
import { z } from 'zod';

/**
 * The wallet slots. The id doubles as the on-chain `docType`. Four pinned slots
 * plus two user-named custom slots. A slot holds MANY files. Custom slot names
 * are never written on-chain: a user's own label can carry personal data.
 */
export const VAULT_SLOT_IDS = [
  'amlSourceOfFunds',
  'proofOfId',
  'decisionInPrinciple',
  'mortgageOffer',
  'proofOfOwnership',
  'custom1',
  'custom2',
] as const;
export type VaultSlotId = (typeof VAULT_SLOT_IDS)[number];

export interface VaultSlot {
  /** Stable id; also used verbatim as the canister `docType`. */
  id: VaultSlotId;
  /**
   * Human label shown in the UI. For a custom slot this is a default the user
   * can rename locally — a custom name is stored on-device and NEVER anchored.
   */
  label: string;
  /**
   * The label sent on-chain as the file's generic `fileName`. For pinned slots
   * this equals `label`; for custom slots it is a fixed generic constant so a
   * user's free-text slot name can never leak on-chain (ADR 0003).
   */
  onChainLabel: string;
  /** One-line helper shown under the label. */
  description: string;
  /** True for the two user-named custom slots. */
  custom?: boolean;
  /** When true, the UI appends a "(buyers)" note. */
  buyersOnlyNote?: boolean;
}

/** Generic on-chain label for every custom-slot file (never the user's name). */
export const CUSTOM_SLOT_ONCHAIN_LABEL = 'Custom document';

export const VAULT_SLOTS: readonly VaultSlot[] = [
  {
    id: 'amlSourceOfFunds',
    label: 'AML / Source of Funds',
    onChainLabel: 'AML / Source of Funds',
    description: 'Your anti-money-laundering check or proof of where your funds come from.',
  },
  {
    id: 'proofOfId',
    label: 'Proof of Identity',
    onChainLabel: 'Proof of Identity',
    description: 'Passport, driving licence, or national ID.',
  },
  {
    // Buyer Pack (spec 2026-09-05, decision 9): a DIP and an offer are separate
    // ticks, so they need separate slots.
    id: 'decisionInPrinciple',
    label: 'Decision in Principle',
    onChainLabel: 'Decision in Principle',
    description: "Your lender's decision or agreement in principle, before the full offer.",
    buyersOnlyNote: true,
  },
  {
    id: 'mortgageOffer',
    label: 'Mortgage Offer',
    onChainLabel: 'Mortgage Offer',
    description: "Your lender's formal mortgage offer.",
    buyersOnlyNote: true,
  },
  {
    id: 'proofOfOwnership',
    label: 'Proof of Ownership',
    onChainLabel: 'Proof of Ownership',
    description: 'Title register, official copy or deeds for a property you own.',
  },
  {
    id: 'custom1',
    label: 'Custom Slot 1',
    onChainLabel: CUSTOM_SLOT_ONCHAIN_LABEL,
    description: 'A document of your choosing — give the slot a name.',
    custom: true,
  },
  {
    id: 'custom2',
    label: 'Custom Slot 2',
    onChainLabel: CUSTOM_SLOT_ONCHAIN_LABEL,
    description: 'A second document of your choosing — give the slot a name.',
    custom: true,
  },
] as const;

/** A stored wallet document as surfaced to the UI. Never carries a filename. */
export interface VaultDocument {
  /** wallet_documents row id. */
  id: string;
  slotId: VaultSlotId;
  /** document_storage proof id (on-chain anchor). */
  blockchainId: number;
  /** SHA-256 hex. */
  fileHash: string;
  fileSize: number;
  mimeType: string;
  /** ISO timestamp. */
  uploadedAt: string;
  /** Storage object path: wallet/<uid>/<slotId>-<hash12><ext>. */
  objectPath: string;
  /**
   * Optional user-typed label (≤60 chars) shown only to the owner and used as
   * the download filename. Never on-chain, never in a path, never shown to
   * grantees (decision 18). Not the original filename — that is never stored.
   */
  label?: string;
}

/** Max length of a user-typed wallet file label. */
export const WALLET_LABEL_MAX = 60;

/** Runtime validation of a VaultDocument before it is trusted/returned. */
export const vaultDocumentSchema = z.object({
  id: z.string().min(1),
  slotId: z.enum(VAULT_SLOT_IDS),
  blockchainId: z.number().int().nonnegative(),
  fileHash: z.string().regex(/^[a-fA-F0-9]{64}$/, 'expected a 64-char SHA-256 hex'),
  fileSize: z.number().int().positive(),
  mimeType: z.string().min(1),
  uploadedAt: z.string().min(1),
  objectPath: z.string().min(1),
  label: z.string().min(1).max(60).optional(),
});

export type ValidatedVaultDocument = z.infer<typeof vaultDocumentSchema>;

/** Storage bucket that holds wallet/ and shared/ objects. */
export const WALLET_BUCKET: string =
  import.meta.env.VITE_HMLR_DOCUMENTS_BUCKET ?? 'propxchain-documents';

export const EXT_BY_MIME: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
};

/** wallet/<uid>/<slotId>-<hash12><ext> — the 2nd segment MUST be the owner uid (RLS). */
export function walletObjectPath(
  userId: string,
  slotId: VaultSlotId,
  fileHash: string,
  mimeType: string,
): string {
  const ext = EXT_BY_MIME[mimeType] ?? '';
  return `wallet/${userId}/${slotId}-${fileHash.slice(0, 12)}${ext}`;
}
