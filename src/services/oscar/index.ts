// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

// Main Oscar chat service
export { oscarService } from './oscarService';

// Oscar document analysis service
export {
  oscarDocumentAnalysis,
  OSCAR_SUPPORTED_TYPES,
  mapToOscarType
} from './oscarDocumentAnalysis.service';

// Re-export types
export type {
  OscarIssue,
  DataMismatch,
  OscarAnalysisResult,
  TransactionContext,
  OscarDocumentType
} from './oscarDocumentAnalysis.service';
