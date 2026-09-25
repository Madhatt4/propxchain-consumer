// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Survey Document Service
 *
 * Stores a survey report that the BUYER uploads themselves, and anchors its
 * SHA-256 hash on-chain.
 *
 * Why the buyer uploads it rather than the surveyor sending it to us: a
 * surveyor's duty of care runs to the client who commissioned and paid for the
 * report, and their terms exclude third-party reliance. The buyer already holds
 * their own copy and may share it within their own transaction, so this route
 * needs no reliance arrangement with any surveyor. It also works whichever
 * surveyor the buyer used — including one they found themselves, outside any
 * PropXchain panel — which a partner feed never could.
 *
 * What the on-chain anchor does and does not prove: it evidences that THIS FILE
 * existed in THIS transaction at THIS time, and makes later tampering
 * detectable. It is NOT proof that a surveyor issued it — a consumer upload
 * carries no issuer signature. Never present it in the UI as a verified survey.
 *
 * GDPR routing — a survey report names the occupier and pictures the interior,
 * so it is PII and follows `Off+hash`: bytes OFF-CHAIN in Supabase, only the
 * hash ON-CHAIN. Erasing the off-chain file satisfies the right to erasure and
 * leaves the on-chain hash a meaningless anchor.
 *
 * Reuses the `Off+hash` upload contract in `fundingDocument.service.ts` (same
 * bucket, same proof + verification registration) under its own storage folder.
 */

import {
  fundingDocumentService,
  type FundingDocumentRecord,
} from './fundingDocument.service';
import { validatePdf, type FileRejection } from '../utils/pdfValidation';

/** `documentTypes.ts` storageKey for DOCUMENT_TYPES.SURVEY_REPORT. */
export const SURVEY_REPORT_DOC_TYPE = 'surveyReport';

/** Storage sub-folder under `transactions/<id>/`. */
const SURVEY_FOLDER = 'survey';

/** Survey reports are routinely 40+ pages with photographs. */
export const MAX_SURVEY_BYTES = 25 * 1024 * 1024;

export type SurveyDocumentRecord = FundingDocumentRecord;

export interface UploadSurveyReportOptions {
  /** Canonical transaction key in "tx_<n>" form. */
  transactionId: string;
  /** Property id if known; 0 is tolerated — access falls back to tx membership. */
  propertyId?: number;
}

/**
 * Validate and store a buyer-supplied survey report.
 *
 * Rejects anything that is not a real PDF before a byte reaches storage: the
 * file is untrusted consumer input, and the extension proves nothing.
 *
 * @throws Error with a user-facing message on validation, auth, upload, or
 *   access-denial failure.
 */
export async function uploadSurveyReport(
  file: File,
  opts: UploadSurveyReportOptions,
): Promise<SurveyDocumentRecord> {
  const rejection: FileRejection | null = await validatePdf(file, MAX_SURVEY_BYTES);
  if (rejection) {
    throw new Error(rejection.reason);
  }

  return fundingDocumentService.uploadFundingDocument(file, {
    transactionId: opts.transactionId,
    propertyId: opts.propertyId,
    documentType: SURVEY_REPORT_DOC_TYPE,
    folder: SURVEY_FOLDER,
  });
}

export const surveyDocumentService = { uploadSurveyReport };
export default surveyDocumentService;
