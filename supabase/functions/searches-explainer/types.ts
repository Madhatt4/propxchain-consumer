// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Wire types for the searches-explainer function. Structurally mirrors the
 * client's LocationSearchAnalysis rather than importing it — an edge function
 * cannot reach into src/.
 */

export interface AnalysisRecommendation {
  searchTypeId: string;
  reason: string;
  priority: 'required' | 'recommended' | 'optional';
  confidence: 'high' | 'medium' | 'low';
}

export interface ExplainerAnalysis {
  localAuthorityName: string;
  transactionType: string;
  capabilities: string[];
  recommendations: AnalysisRecommendation[];
  notNeeded: string[];
}

export interface ExplainerRequest {
  cacheKey: string;
  analysis: ExplainerAnalysis;
}

export interface ExplainerResponse {
  narration: string[] | null;
}
